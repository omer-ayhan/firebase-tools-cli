import { program } from 'commander';
import * as admin from 'firebase-admin';

import { exportCollections } from '@/actions/firestore/firestore-export';

const firestoreExport = program
  .createCommand('firestore:export')
  .description(
    'Export all Firestore collections to a compact importable JSON file.\n' +
      'Top-level collections are exported in parallel (see --concurrency) to\n' +
      'maximise throughput. Output is streamed directly to disk so memory usage\n' +
      'stays low even for very large databases. Subcollection export is opt-in\n' +
      '(--subcollections) so the common case is as fast as possible.'
  )
  .option('-o, --output <dir>', 'Output directory', './')
  .option(
    '-c, --concurrency <n>',
    'Number of collections exported in parallel',
    '5'
  )
  .option('--subcollections', 'Also export subcollections (opt-in)')
  .option('--gzip', 'Compress output with gzip (.json.gz)')
  .option('-e, --exclude <collections...>', 'Exclude specific collections')
  .action(async (options) => {
    try {
      const concurrency = parseInt(options.concurrency, 10);
      await exportCollections({
        ...options,
        concurrency: Number.isFinite(concurrency) ? concurrency : 5,
      });
      process.exit(0);
    } catch (error) {
      process.exit(1);
    } finally {
      await admin.app().delete();
    }
  });

export default firestoreExport;
