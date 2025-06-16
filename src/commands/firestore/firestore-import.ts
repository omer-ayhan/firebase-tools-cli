import { program } from 'commander';
import * as admin from 'firebase-admin';

import { importCollections } from '@/actions/firestore/firestore-import';

const firestoreImport = program
  .createCommand('firestore:import')
  .description('Import data to Firestore from JSON file')
  .argument('<file>', 'JSON file to import')
  .option('-b, --batch-size <size>', 'Batch size for imports', '500')
  .option('-m, --merge', 'Merge documents instead of overwriting')
  .option('-e, --exclude <collections...>', 'Exclude specific collections')
  .action(async (file, options) => {
    try {
      await importCollections(file, options);
      process.exit(0);
    } catch (error) {
      process.exit(1);
    } finally {
      await admin.app().delete();
    }
  });

export default firestoreImport;
