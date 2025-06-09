const fs = require("fs");
const chalk = require("chalk");
const admin = require("firebase-admin");

async function importCollections(file, options) {
  try {
    const db = admin.firestore();
    console.log(chalk.blue(`📥 Starting import from: ${file}\n`));

    if (!fs.existsSync(file)) {
      console.error(chalk.red(`❌ Import file not found: ${file}`));
      process.exit(1);
    }

    const rawData = fs.readFileSync(file, "utf8");
    const importData = JSON.parse(rawData);

    let totalImported = 0;
    const batchSize = options.batchSize || 500;

    for (const [collectionName, documents] of Object.entries(importData)) {
      // Skip collections if specified
      if (options.exclude && options.exclude.includes(collectionName)) {
        console.log(
          chalk.yellow(`⏭️  Skipping excluded collection: ${collectionName}`)
        );
        continue;
      }

      console.log(chalk.blue(`📝 Importing collection: ${collectionName}`));

      // Handle subcollection naming convention
      if (collectionName.includes("__")) {
        const parts = collectionName.split("__");
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

        for (const [docId, docData] of Object.entries(documents)) {
          const docRef = db
            .collection(parentCollection)
            .doc(parentDoc)
            .collection(subCollection)
            .doc(docId);

          if (options.merge) {
            batch.set(docRef, docData, { merge: true });
          } else {
            batch.set(docRef, docData);
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

        for (const [docId, docData] of Object.entries(documents)) {
          const docRef = db.collection(collectionName).doc(docId);

          if (options.merge) {
            batch.set(docRef, docData, { merge: true });
          } else {
            batch.set(docRef, docData);
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
    console.error(chalk.red("❌ Import failed:"), error.message);
    throw error;
  }
}

module.exports = importCollections;
