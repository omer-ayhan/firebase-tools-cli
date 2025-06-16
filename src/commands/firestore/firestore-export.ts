import { program } from 'commander';
import * as admin from 'firebase-admin';

import { exportCollections } from '@/actions/firestore/firestore-export';

const firestoreExport = program
  .createCommand('firestore:export')
  .description('Export all collections from Firestore')
  .option('-o, --output <dir>', 'Output directory', './')
  .option('--no-detailed', 'Skip detailed format export')
  .option('--no-importable', 'Skip importable format export')
  .option('--no-subcollections', 'Skip subcollections')
  .option('-e, --exclude <collections...>', 'Exclude specific collections')
  .action(async (options) => {
    try {
      await exportCollections(options);
      process.exit(0);
    } catch (error) {
      process.exit(1);
    } finally {
      await admin.app().delete();
    }
  });

export default firestoreExport;
