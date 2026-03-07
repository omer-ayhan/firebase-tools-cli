import chalk from 'chalk';
import * as admin from 'firebase-admin';
import fs from 'fs';

type ImportCommandOptionsType = {
  batchSize?: number;
  exclude?: string[];
  merge?: boolean;
};

/**
 * Build a Firestore DocumentReference from a `__`-delimited path key and a
 * document ID.
 *
 * The key encodes alternating collection / document segments:
 *   col                          → top-level collection
 *   col__docId__subCol           → one level deep
 *   col__docId__subCol__subDocId__subSubCol  → two levels deep
 *
 * The provided `docId` is always the final document within the last collection
 * encoded in the key.
 */
function buildDocRef(
  db: admin.firestore.Firestore,
  collectionKey: string,
  docId: string
): admin.firestore.DocumentReference {
  const parts = collectionKey.split('__');
  // A valid collection key must have an odd number of parts:
  // [col], [col, docId, subCol], [col, docId, subCol, subDocId, subSubCol], …
  if (parts.length % 2 === 0) {
    throw new Error(
      `Invalid collection key "${collectionKey}": expected an odd number of ` +
        `segments (collection, docId, subcollection, …) but got ${parts.length}.`
    );
  }
  // parts alternates: [col, doc, col, doc, col]
  // parts[0] is the first collection; subsequent pairs are [doc, col]
  let ref: admin.firestore.CollectionReference = db.collection(parts[0]);
  for (let i = 1; i + 1 < parts.length; i += 2) {
    ref = ref.doc(parts[i]).collection(parts[i + 1]);
  }
  return ref.doc(docId);
}

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
    const importData = JSON.parse(rawData);

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

      const isNested = collectionName.includes('__');

      if (isNested) {
        const parts = collectionName.split('__');
        // Reconstruct the human-readable path for logging
        const humanPath = parts
          .map((seg, i) => (i % 2 === 0 ? seg : `[${seg}]`))
          .join('/');

        console.log(chalk.gray(`   └── Nested path: ${humanPath}`));
      }

      let batch = db.batch();
      let batchCount = 0;

      for (const [docId, docData] of Object.entries(documents as any)) {
        const docRef = isNested
          ? buildDocRef(db, collectionName, docId)
          : db.collection(collectionName).doc(docId);

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
          batch = db.batch();
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
        totalImported += batchCount;
        console.log(
          chalk.gray(`   └── Final batch: ${batchCount} documents`)
        );
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

