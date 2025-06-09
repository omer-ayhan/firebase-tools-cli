import fs from "fs";
import path from "path";
import chalk from "chalk";
import * as admin from "firebase-admin";
import { QueryDocumentSnapshotType } from "../../types";

type ExportCommandOptionsType = {
  exclude?: string[];
  noSubcollections?: boolean;
  detailed?: boolean;
  importable?: boolean;
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
    console.log(chalk.blue("🔍 Starting Firestore export...\n"));

    const collections = await db.listCollections();
    console.log(
      chalk.cyan(`📁 Found ${collections.length} top-level collections\n`)
    );

    const allData: {
      [key: string]: {
        id: string;
        data: any;
        createTime: admin.firestore.Timestamp;
        updateTime: admin.firestore.Timestamp;
        error?: string;
        subcollections?: {
          [key: string]: any[];
        };
      }[];
    } = {};
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
        const documents = [];
        let collectionDocsRead = 0;
        let collectionSubDocsRead = 0;

        console.log(chalk.gray(`   └── Documents found: ${snapshot.size}`));

        // For importable format
        importData[collectionName] = {};

        // Create loading indicator
        let loadingDots = 0;
        let loadingInterval = setInterval(() => {
          const dots = ".".repeat((loadingDots % 3) + 1);
          process.stdout.write(
            `\r${chalk.gray(`       └── Processing${dots}   `)}`
          );
          loadingDots++;
        }, 300);

        for (const doc of snapshot.docs) {
          const docData: {
            id: string;
            data: any;
            createTime: admin.firestore.Timestamp;
            updateTime: admin.firestore.Timestamp;
            subcollections?: {
              [key: string]: any[];
            };
          } = {
            id: doc.id,
            data: doc.data(),
            createTime: doc.createTime,
            updateTime: doc.updateTime,
          };

          // Add to importable format
          importData[collectionName][doc.id] = doc.data();
          collectionDocsRead++;

          // Handle subcollections if enabled
          if (!options.noSubcollections) {
            const subcollections = await doc.ref.listCollections();
            if (subcollections.length > 0) {
              docData.subcollections = {};

              // Clear loading line and show subcollection info
              clearInterval(loadingInterval);
              process.stdout.write("\r" + " ".repeat(50) + "\r"); // Clear the line
              console.log(
                chalk.gray(
                  `       └── Document ${doc.id} has ${subcollections.length} subcollections`
                )
              );

              for (const subcol of subcollections) {
                const subSnapshot = await subcol.get();
                const subDocs: any[] = [];

                // For importable format
                const subCollectionPath = `${collectionName}__${doc.id}__${subcol.id}`;
                importData[subCollectionPath] = {};

                subSnapshot.forEach((subDoc: QueryDocumentSnapshotType) => {
                  const subDocData = {
                    id: subDoc.id,
                    data: subDoc.data(),
                    createTime: subDoc.createTime,
                    updateTime: subDoc.updateTime,
                  };
                  subDocs.push(subDocData);
                  collectionSubDocsRead++;

                  // Add to importable format
                  importData[subCollectionPath][subDoc.id] = subDoc.data();
                });

                docData.subcollections[subcol.id] = subDocs;
                console.log(
                  chalk.gray(
                    `           └── Subcollection ${subcol.id}: ${subDocs.length} documents read`
                  )
                );
              }

              // Restart loading indicator if there are more documents
              if (collectionDocsRead < snapshot.size) {
                loadingInterval = setInterval(() => {
                  const dots = ".".repeat((loadingDots % 3) + 1);
                  process.stdout.write(
                    `\r${chalk.gray(`       └── Processing${dots}   `)}`
                  );
                  loadingDots++;
                }, 300);
              }
            }
          }

          documents.push(docData);
        }

        // Clear loading indicator
        clearInterval(loadingInterval);
        process.stdout.write("\r" + " ".repeat(50) + "\r"); // Clear the line

        allData[collectionName] = documents;
        totalDocsRead += collectionDocsRead;
        totalSubDocsRead += collectionSubDocsRead;

        // Show final count for this collection
        const subCollectionText =
          collectionSubDocsRead > 0
            ? chalk.gray(` + ${collectionSubDocsRead} subdocuments`)
            : "";

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

    // Generate file names
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputDir = options.output || "./";

    console.log(chalk.blue("💾 Saving export files..."));

    // Create saving loading indicator
    let savingDots = 0;
    let savingInterval = setInterval(() => {
      const dots = ".".repeat((savingDots % 3) + 1);
      process.stdout.write(`\r${chalk.gray(`   └── Writing files${dots}   `)}`);
      savingDots++;
    }, 200);

    // Save detailed format
    if (options.detailed !== false) {
      const detailedFile = path.join(
        outputDir,
        `firestore_detailed_${timestamp}.json`
      );
      fs.writeFileSync(detailedFile, JSON.stringify(allData, null, 2));

      clearInterval(savingInterval);
      process.stdout.write("\r" + " ".repeat(50) + "\r"); // Clear the line
      console.log(chalk.green(`📄 Detailed backup saved: ${detailedFile}`));

      // Restart saving indicator if we have more files to save
      if (options.importable !== false) {
        savingInterval = setInterval(() => {
          const dots = ".".repeat((savingDots % 3) + 1);
          process.stdout.write(
            `\r${chalk.gray(`   └── Writing files${dots}   `)}`
          );
          savingDots++;
        }, 200);
      }
    }

    // Save importable format
    if (options.importable !== false) {
      const importableFile = path.join(
        outputDir,
        `firestore_importable_${timestamp}.json`
      );
      fs.writeFileSync(importableFile, JSON.stringify(importData, null, 2));

      clearInterval(savingInterval);
      process.stdout.write("\r" + " ".repeat(50) + "\r"); // Clear the line
      console.log(chalk.green(`📤 Importable backup saved: ${importableFile}`));
    }

    // Summary with detailed read counts
    console.log(chalk.blue("\n📊 Export Summary:"));
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

    // Calculate file sizes
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

    console.log(chalk.green("\n🎉 Export completed successfully!"));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(chalk.red("❌ Export failed:"), errorMessage);
    throw error;
  }
}
