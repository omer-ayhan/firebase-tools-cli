import chalk from 'chalk';
import * as admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

import { QueryDocumentSnapshotType } from '@/types';

type ExportCommandOptionsType = {
  exclude?: string[];
  noSubcollections?: boolean;
  output?: string;
};

type ImportData = {
  [key: string]: {
    [key: string]: any;
  };
};

export async function exportCollections(options: ExportCommandOptionsType) {
  try {
    const db = admin.firestore();
    console.log(chalk.blue('🔍 Starting Firestore export...\n'));

    const collections = await db.listCollections();
    console.log(
      chalk.cyan(`📁 Found ${collections.length} top-level collections\n`)
    );

    const importData: ImportData = {};
    let totalDocsRead = 0;
    let totalSubDocsRead = 0;

    for (const collection of collections) {
      const collectionName = collection.id;

      // Skip collections if specified
      if (options.exclude && options.exclude.includes(collectionName)) {
        console.log(
          chalk.yellow(`⏭️  Skipping excluded collection: ${collectionName}`)
        );
        continue;
      }

      console.log(chalk.blue(`📖 Reading collection: ${collectionName}`));

      try {
        const snapshot = await collection.get();
        let collectionDocsRead = 0;
        let collectionSubDocsRead = 0;

        console.log(chalk.gray(`   └── Documents found: ${snapshot.size}`));

        // For importable format
        importData[collectionName] = {};

        // Create loading indicator
        let loadingDots = 0;
        let loadingInterval = setInterval(() => {
          const dots = '.'.repeat((loadingDots % 3) + 1);
          process.stdout.write(
            `\r${chalk.gray(`       └── Processing${dots}   `)}`
          );
          loadingDots++;
        }, 300);

        for (const doc of snapshot.docs) {
          // Add to importable format
          importData[collectionName][doc.id] = doc.data();
          collectionDocsRead++;

          // Handle subcollections if enabled
          if (!options.noSubcollections) {
            const subcollections = await doc.ref.listCollections();
            if (subcollections.length > 0) {
              // Clear loading line and show subcollection info
              clearInterval(loadingInterval);
              process.stdout.write('\r' + ' '.repeat(50) + '\r'); // Clear the line
              console.log(
                chalk.gray(
                  `       └── Document ${doc.id} has ${subcollections.length} subcollections`
                )
              );

              for (const subcol of subcollections) {
                const subSnapshot = await subcol.get();

                // For importable format
                const subCollectionPath = `${collectionName}__${doc.id}__${subcol.id}`;
                importData[subCollectionPath] = {};

                let subDocsRead = 0;
                subSnapshot.forEach((subDoc: QueryDocumentSnapshotType) => {
                  collectionSubDocsRead++;
                  subDocsRead++;

                  // Add to importable format
                  importData[subCollectionPath][subDoc.id] = subDoc.data();
                });

                console.log(
                  chalk.gray(
                    `           └── Subcollection ${subcol.id}: ${subDocsRead} documents read`
                  )
                );
              }

              // Restart loading indicator if there are more documents
              if (collectionDocsRead < snapshot.size) {
                loadingInterval = setInterval(() => {
                  const dots = '.'.repeat((loadingDots % 3) + 1);
                  process.stdout.write(
                    `\r${chalk.gray(`       └── Processing${dots}   `)}`
                  );
                  loadingDots++;
                }, 300);
              }
            }
          }
        }

        // Clear loading indicator
        clearInterval(loadingInterval);
        process.stdout.write('\r' + ' '.repeat(50) + '\r'); // Clear the line

        totalDocsRead += collectionDocsRead;
        totalSubDocsRead += collectionSubDocsRead;

        // Show final count for this collection
        const subCollectionText =
          collectionSubDocsRead > 0
            ? chalk.gray(` + ${collectionSubDocsRead} subdocuments`)
            : '';

        console.log(
          chalk.green(
            `   ✅ Collection ${collectionName} exported: ${collectionDocsRead} documents${subCollectionText}\n`
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

    const outputDir = options.output || './';

    console.log(chalk.blue('💾 Saving export file...'));

    // Create saving loading indicator
    let savingDots = 0;
    const savingInterval = setInterval(() => {
      const dots = '.'.repeat((savingDots % 3) + 1);
      process.stdout.write(`\r${chalk.gray(`   └── Writing file${dots}   `)}`);
      savingDots++;
    }, 200);

    const exportFile = path.join(outputDir, 'firestore_export.json');
    fs.writeFileSync(exportFile, JSON.stringify(importData));

    clearInterval(savingInterval);
    process.stdout.write('\r' + ' '.repeat(50) + '\r'); // Clear the line
    console.log(chalk.green(`📤 Export saved: ${exportFile}`));

    // Summary
    const exportSize = (fs.statSync(exportFile).size / 1024 / 1024).toFixed(2);
    console.log(chalk.blue('\n📊 Export Summary:'));
    console.log(
      chalk.gray(
        `   └── Collections processed: ${Object.keys(importData).length}`
      )
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

    console.log(chalk.gray(`   └── Export file size: ${exportSize} MB`));

    console.log(chalk.green('\n🎉 Export completed successfully!'));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(chalk.red('❌ Export failed:'), errorMessage);
    throw error;
  }
}
