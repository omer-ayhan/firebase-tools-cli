import { program } from 'commander';
import * as admin from 'firebase-admin';

import { listCollections } from '@/actions/firestore/firestore-list';

const firestoreList = program
  .createCommand('firestore:list')
  .description('List all collections and their basic info')
  .action(async () => {
    try {
      await listCollections();
      process.exit(0);
    } catch (error) {
      process.exit(1);
    } finally {
      await admin.app().delete();
    }
  });

export default firestoreList;
