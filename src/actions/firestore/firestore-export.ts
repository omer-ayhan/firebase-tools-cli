import chalk from 'chalk';
import * as admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { Writable } from 'stream';
import zlib from 'zlib';

type ExportCommandOptionsType = {
  exclude?: string[];
  subcollections?: boolean;
  output?: string;
  concurrency?: number;
  gzip?: boolean;
};

/** Write a string to a Writable stream, respecting backpressure. */
function writeToStream(stream: Writable, data: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (err: Error) => reject(err);
    stream.once('error', onError);

    // The write callback fires once the data has been accepted (or on error),
    // so we don't need a separate 'drain' listener.
    stream.write(data, (writeErr) => {
      stream.removeListener('error', onError);
      if (writeErr) reject(writeErr);
      else resolve();
    });
  });
}

/** Process items with at most `concurrency` tasks running simultaneously. */
async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  const queue = [...items];
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (queue.length > 0) {
        const item = queue.shift()!;
        await fn(item);
      }
    }
  );
  await Promise.all(workers);
}

export async function exportCollections(options: ExportCommandOptionsType) {
  try {
    const db = admin.firestore();
    const concurrency = options.concurrency ?? 5;
    const useGzip = options.gzip ?? false;

    console.log(chalk.blue('🔍 Starting Firestore export...\n'));

    const collections = await db.listCollections();
    console.log(
      chalk.cyan(`📁 Found ${collections.length} top-level collections\n`)
    );

    // Filter excluded collections up-front
    const filteredCollections = collections.filter((collection) => {
      if (options.exclude && options.exclude.includes(collection.id)) {
        console.log(
          chalk.yellow(`⏭️  Skipping excluded collection: ${collection.id}`)
        );
        return false;
      }
      return true;
    });

    // Set up output file with optional gzip compression
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputDir = options.output || './';
    const ext = useGzip ? 'json.gz' : 'json';
    const outputFile = path.join(
      outputDir,
      `firestore_export_${timestamp}.${ext}`
    );

    const fileStream = fs.createWriteStream(outputFile);
    let outputStream: Writable;
    if (useGzip) {
      const gzipStream = zlib.createGzip();
      gzipStream.pipe(fileStream);
      outputStream = gzipStream;
    } else {
      outputStream = fileStream;
    }

    // Counters (updated inside the serialised write lock, so no data races)
    let firstEntry = true;
    let totalDocsRead = 0;
    let totalSubDocsRead = 0;
    let collectionsProcessed = 0;

    // All writes to the output stream are serialized through this promise
    // chain so concurrent collection tasks never interleave their JSON chunks.
    let writeLock: Promise<void> = writeToStream(outputStream, '{');

    /**
     * Schedule a serialized write of one collection's data.
     * Resolves once the chunk has been flushed to the stream.
     *
     * Each collection is written as a raw JSON key/value pair appended to the
     * top-level object. Manual construction (rather than a single
     * JSON.stringify of the whole dataset) is intentional: it lets us stream
     * each collection to disk as soon as it finishes loading, keeping memory
     * usage proportional to the largest single collection rather than the
     * entire database.
     */
    const appendToStream = (
      collectionName: string,
      collectionData: { [docId: string]: any },
      subData: { [subPath: string]: { [docId: string]: any } }
    ): Promise<void> => {
      return new Promise<void>((resolve, reject) => {
        writeLock = writeLock.then(async () => {
          try {
            const prefix = firstEntry ? '' : ',';
            firstEntry = false;

            await writeToStream(
              outputStream,
              `${prefix}${JSON.stringify(collectionName)}:${JSON.stringify(
                collectionData
              )}`
            );

            for (const [subPath, subDocs] of Object.entries(subData)) {
              await writeToStream(
                outputStream,
                `,${JSON.stringify(subPath)}:${JSON.stringify(subDocs)}`
              );
            }

            resolve();
          } catch (err) {
            reject(err);
          }
        });
      });
    };

    // Process collections in parallel up to the configured concurrency limit
    await runWithConcurrency(
      filteredCollections,
      concurrency,
      async (collection) => {
        const collectionName = collection.id;
        console.log(chalk.blue(`📖 Reading collection: ${collectionName}`));

        try {
          const snapshot = await collection.get();
          console.log(chalk.gray(`   └── Documents found: ${snapshot.size}`));

          const collectionData: { [docId: string]: any } = {};
          const subData: { [subPath: string]: { [docId: string]: any } } = {};
          let collectionDocsRead = 0;
          let collectionSubDocsRead = 0;

          for (const doc of snapshot.docs) {
            collectionData[doc.id] = doc.data();
            collectionDocsRead++;

            // Subcollections are opt-in for performance
            if (options.subcollections) {
              const subcollections = await doc.ref.listCollections();
              for (const subcol of subcollections) {
                const subSnapshot = await subcol.get();
                const subPath = `${collectionName}__${doc.id}__${subcol.id}`;
                subData[subPath] = {};

                subSnapshot.forEach((subDoc) => {
                  subData[subPath][subDoc.id] = subDoc.data();
                  collectionSubDocsRead++;
                });

                console.log(
                  chalk.gray(
                    `       └── Subcollection ${collectionName}/${doc.id}/${subcol.id}: ${subSnapshot.size} documents`
                  )
                );
              }
            }
          }

          // Stream this collection's data to the output file
          await appendToStream(collectionName, collectionData, subData);

          totalDocsRead += collectionDocsRead;
          totalSubDocsRead += collectionSubDocsRead;
          collectionsProcessed++;

          const subText =
            collectionSubDocsRead > 0
              ? chalk.gray(` + ${collectionSubDocsRead} subdocuments`)
              : '';
          console.log(
            chalk.green(
              `   ✅ Collection ${collectionName} exported: ${collectionDocsRead} documents${subText}\n`
            )
          );
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error(
            chalk.red(`   ❌ Error reading collection ${collectionName}:`),
            errorMessage
          );
        }
      }
    );

    // Wait for all pending writes to finish, then close the JSON object
    await writeLock;
    await writeToStream(outputStream, '}');

    // Close the stream(s)
    await new Promise<void>((resolve, reject) => {
      outputStream.end((err?: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Summary
    console.log(chalk.blue('\n📊 Export Summary:'));
    console.log(
      chalk.gray(`   └── Collections processed: ${collectionsProcessed}`)
    );
    console.log(chalk.gray(`   └── Documents read: ${totalDocsRead}`));

    if (totalSubDocsRead > 0) {
      console.log(chalk.gray(`   └── Subdocuments read: ${totalSubDocsRead}`));
      console.log(
        chalk.gray(
          `   └── Total documents: ${totalDocsRead + totalSubDocsRead}`
        )
      );
    }

    const fileSize = (fs.statSync(outputFile).size / 1024 / 1024).toFixed(2);
    console.log(
      chalk.gray(`   └── Export file: ${outputFile} (${fileSize} MB)`)
    );

    console.log(chalk.green('\n🎉 Export completed successfully!'));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(chalk.red('❌ Export failed:'), errorMessage);
    throw error;
  }
}
