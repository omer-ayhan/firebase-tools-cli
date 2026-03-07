import chalk from 'chalk';
import * as admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

type ExportCommandOptionsType = {
  exclude?: string[];
  noSubcollections?: boolean;
  detailed?: boolean;
  importable?: boolean;
  output?: string;
};

type DetailedDocType = {
  id: string;
  data: any;
  createTime: admin.firestore.Timestamp;
  updateTime: admin.firestore.Timestamp;
  subcollections?: { [key: string]: DetailedDocType[] };
};

type ImportData = {
  [key: string]: { [key: string]: any };
};

/**
 * Recursively export subcollections for a document.
 * Populates `importData` with flat keys of the form
 *   col__docId__subCol__subDocId__subSubCol…
 * and returns the detailed subcollection tree for the detailed format.
 */
async function exportSubcollections(
  docRef: admin.firestore.DocumentReference,
  parentKey: string,
  importData: ImportData,
  noSubcollections: boolean
): Promise<{ [key: string]: DetailedDocType[] }> {
  if (noSubcollections) return {};

  const subcollections = await docRef.listCollections();
  if (subcollections.length === 0) return {};

  const detailedSubcols: { [key: string]: DetailedDocType[] } = {};

  await Promise.all(
    subcollections.map(async (subcol) => {
      const subColKey = `${parentKey}__${subcol.id}`;
      const subSnapshot = await subcol.get();
      importData[subColKey] = {};

      const subDocs = await Promise.all(
        subSnapshot.docs.map(async (subDoc) => {
          importData[subColKey][subDoc.id] = subDoc.data();

          // Recurse into deeper subcollections
          const nestedSubs = await exportSubcollections(
            subDoc.ref,
            `${subColKey}__${subDoc.id}`,
            importData,
            false
          );

          const docEntry: DetailedDocType = {
            id: subDoc.id,
            data: subDoc.data(),
            createTime: subDoc.createTime,
            updateTime: subDoc.updateTime,
          };

          if (Object.keys(nestedSubs).length > 0) {
            docEntry.subcollections = nestedSubs;
          }

          return docEntry;
        })
      );

      console.log(
        chalk.gray(
          `           └── Subcollection ${subColKey}: ${subDocs.length} documents read`
        )
      );

      detailedSubcols[subcol.id] = subDocs;
    })
  );

  return detailedSubcols;
}

export async function exportCollections(options: ExportCommandOptionsType) {
  try {
    const db = admin.firestore();
    console.log(chalk.blue('🔍 Starting Firestore export...\n'));

    const collections = await db.listCollections();
    console.log(
      chalk.cyan(`📁 Found ${collections.length} top-level collections\n`)
    );

    const allData: { [key: string]: DetailedDocType[] } = {};
    const importData: ImportData = {};
    let totalDocsRead = 0;
    let totalSubDocsRead = 0;

    // Read all top-level collections concurrently
    await Promise.all(
      collections.map(async (collection) => {
        const collectionName = collection.id;

        if (options.exclude && options.exclude.includes(collectionName)) {
          console.log(
            chalk.yellow(`⏭️  Skipping excluded collection: ${collectionName}`)
          );
          return;
        }

        console.log(chalk.blue(`📖 Reading collection: ${collectionName}`));

        try {
          const snapshot = await collection.get();
          console.log(
            chalk.gray(`   └── Documents found: ${snapshot.size}`)
          );

          importData[collectionName] = {};
          let collectionSubDocsRead = 0;

          // Read all documents in this collection concurrently
          const documents = await Promise.all(
            snapshot.docs.map(async (doc) => {
              importData[collectionName][doc.id] = doc.data();

              const docEntry: DetailedDocType = {
                id: doc.id,
                data: doc.data(),
                createTime: doc.createTime,
                updateTime: doc.updateTime,
              };

              if (!options.noSubcollections) {
                const detailedSubs = await exportSubcollections(
                  doc.ref,
                  `${collectionName}__${doc.id}`,
                  importData,
                  false
                );

                if (Object.keys(detailedSubs).length > 0) {
                  docEntry.subcollections = detailedSubs;
                  // Count all nested sub-docs for summary
                  collectionSubDocsRead += Object.values(detailedSubs).reduce(
                    (acc, docs) => acc + docs.length,
                    0
                  );
                }
              }

              return docEntry;
            })
          );

          allData[collectionName] = documents;
          totalDocsRead += snapshot.size;
          totalSubDocsRead += collectionSubDocsRead;

          const subCollectionText =
            collectionSubDocsRead > 0
              ? chalk.gray(` + ${collectionSubDocsRead} subdocuments`)
              : '';

          console.log(
            chalk.green(
              `   ✅ Collection ${collectionName} exported: ${snapshot.size} documents${subCollectionText}\n`
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
      })
    );

    // Generate file names
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputDir = options.output || './';

    console.log(chalk.blue('💾 Saving export files...'));

    // Serialize both JSON strings concurrently, then write files
    const [detailedJson, importableJson] = await Promise.all([
      options.detailed !== false
        ? Promise.resolve(JSON.stringify(allData, null, 2))
        : Promise.resolve(null),
      options.importable !== false
        ? Promise.resolve(JSON.stringify(importData, null, 2))
        : Promise.resolve(null),
    ]);

    // Write files concurrently using async I/O
    const writePromises: Promise<void>[] = [];

    if (detailedJson !== null) {
      const detailedFile = path.join(
        outputDir,
        `firestore_detailed_${timestamp}.json`
      );
      writePromises.push(
        fs.promises.writeFile(detailedFile, detailedJson).then(() => {
          console.log(chalk.green(`📄 Detailed backup saved: ${detailedFile}`));
        })
      );
    }

    if (importableJson !== null) {
      const importableFile = path.join(
        outputDir,
        `firestore_importable_${timestamp}.json`
      );
      writePromises.push(
        fs.promises.writeFile(importableFile, importableJson).then(() => {
          console.log(
            chalk.green(`📤 Importable backup saved: ${importableFile}`)
          );
        })
      );
    }

    await Promise.all(writePromises);

    // Summary with detailed read counts
    console.log(chalk.blue('\n📊 Export Summary:'));
    console.log(
      chalk.gray(`   └── Collections processed: ${Object.keys(allData).length}`)
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

    if (options.detailed !== false) {
      const detailedFile = path.join(
        outputDir,
        `firestore_detailed_${timestamp}.json`
      );
      const detailedSize = (
        fs.statSync(detailedFile).size /
        1024 /
        1024
      ).toFixed(2);
      console.log(chalk.gray(`   └── Detailed file size: ${detailedSize} MB`));
    }

    if (options.importable !== false) {
      const importableFile = path.join(
        outputDir,
        `firestore_importable_${timestamp}.json`
      );
      const importableSize = (
        fs.statSync(importableFile).size /
        1024 /
        1024
      ).toFixed(2);
      console.log(
        chalk.gray(`   └── Importable file size: ${importableSize} MB`)
      );
    }

    console.log(chalk.green('\n🎉 Export completed successfully!'));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(chalk.red('❌ Export failed:'), errorMessage);
    throw error;
  }
}
