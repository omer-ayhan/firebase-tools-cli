import chalk from 'chalk';
import * as admin from 'firebase-admin';
import fs from 'fs';

type ImportCommandOptionsType = {
  batchSize?: number;
  exclude?: string[];
  merge?: boolean;
};

export async function importCollections(
  file: string,
  options: ImportCommandOptionsType
) {
  try {
    const db = admin.firestore();
    console.log(chalk.blue(`📥 Starting import from: ${file}\n`));

    if (!fs.existsSync(file)) {
      console.error(chalk.red(`❌ Import file not found: ${file}`));
      process.exit(1);
    }

    const rawData = fs.readFileSync(file, 'utf8');
    let parsedData: unknown;
    let parsedData: unknown;
    try {
      parsedData = JSON.parse(rawData);
    } catch {
      console.error(chalk.red('❌ Import file contains invalid JSON'));
      process.exit(1);
    }

    if (
      parsedData === null ||
      typeof parsedData !== 'object' ||
      Array.isArray(parsedData)
    ) {
      console.error(chalk.red('❌ Invalid import data format'));
      process.exit(1);
    }

    importData = parsedData as Record<string, unknown>;
    if (
      parsedData === null ||
      typeof parsedData !== 'object' ||
      Array.isArray(parsedData)
    ) {
      console.error(
        chalk.red(
          '❌ Invalid import data format: file must contain a JSON object, not an array, null, or primitive value'
        )
      );
      process.exit(1);
    }

    const importData = parsedData as Record<string, unknown>;

    let totalImported = 0;
    const batchSize = options.batchSize || 500;

    for (const [collectionName, documents] of Object.entries(
      importData as any
    )) {
      // Skip collections if specified
      if (options.exclude && options.exclude.includes(collectionName)) {
        console.log(
          chalk.yellow(`⏭️  Skipping excluded collection: ${collectionName}`)
        );
        continue;
      }

      console.log(chalk.blue(`📝 Importing collection: ${collectionName}`));

      // Handle subcollection naming convention
      if (collectionName.includes('__')) {
        const parts = collectionName.split('__');
        const parentCollection = parts[0];
        const parentDoc = parts[1];
        const subCollection = parts[2];

        console.log(
          chalk.gray(
            `   └── Subcollection: ${parentCollection}/${parentDoc}/${subCollection}`
          )
        );

        let batch = db.batch(); // Create new batch
        let batchCount = 0;

        for (const [docId, docData] of Object.entries(documents as any)) {
          const docRef = db
            .collection(parentCollection)
            .doc(parentDoc)
            .collection(subCollection)
            .doc(docId);

          if (options.merge) {
            batch.set(docRef, docData as any, { merge: true });
          } else {
            batch.set(docRef, docData as any);
          }

          batchCount++;

          if (batchCount >= batchSize) {
            await batch.commit();
            totalImported += batchCount;
            console.log(
              chalk.gray(`       └── Batch imported: ${batchCount} documents`)
            );

            // Create a new batch for the next iteration
            batch = db.batch();
            batchCount = 0;
          }
        }

        // Commit any remaining documents in the final batch
        if (batchCount > 0) {
          await batch.commit();
          totalImported += batchCount;
          console.log(
            chalk.gray(`       └── Final batch: ${batchCount} documents`)
          );
        }
      } else {
        // Regular top-level collection
        let batch = db.batch(); // Create new batch
        let batchCount = 0;

        for (const [docId, docData] of Object.entries(documents as any)) {
          const docRef = db.collection(collectionName).doc(docId);

          if (options.merge) {
            batch.set(docRef, docData as any, { merge: true });
          } else {
            batch.set(docRef, docData as any);
          }

          batchCount++;

          if (batchCount >= batchSize) {
            await batch.commit();
            totalImported += batchCount;
            console.log(
              chalk.gray(`   └── Batch imported: ${batchCount} documents`)
            );

            // Create a new batch for the next iteration
            batch = db.batch();
            batchCount = 0;
          }
        }

        // Commit any remaining documents in the final batch
        if (batchCount > 0) {
          await batch.commit();
          totalImported += batchCount;
          console.log(
            chalk.gray(`   └── Final batch: ${batchCount} documents`)
          );
        }
      }

      console.log(chalk.green(`   ✅ Collection ${collectionName} imported\n`));
    }

    console.log(
      chalk.green(
        `🎉 Import completed! Total documents imported: ${totalImported}`
      )
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(chalk.red('❌ Import failed:'), errorMessage);
    throw error;
  }
}
