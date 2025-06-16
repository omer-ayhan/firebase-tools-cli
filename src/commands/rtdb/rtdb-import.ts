import { program } from 'commander';
import * as admin from 'firebase-admin';

import { importRealtimeDatabase } from '@/actions/rtdb/rtdb-import';

const rtdbImport = program
  .createCommand('rtdb:import')
  .description('Import data to Realtime Database from JSON file')
  .argument('<file>', 'JSON file to import')
  .option('-b, --batch-size <size>', 'Batch size for imports', '500')
  .option('-m, --merge', 'Merge documents instead of overwriting')
  .action(async (file, options) => {
    try {
      await importRealtimeDatabase(file, options);
      process.exit(0);
    } catch (error) {
      process.exit(1);
    } finally {
      await admin.app().delete();
    }
  });

export default rtdbImport;
