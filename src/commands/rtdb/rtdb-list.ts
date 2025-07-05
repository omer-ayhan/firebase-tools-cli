import { program } from 'commander';
import * as admin from 'firebase-admin';

import { listRealtimeDatabase } from '@/actions/rtdb/rtdb-list';
import { rtdbValidatePreAction } from '@/hooks/rtdb';

const rtdbList = program
  .createCommand('rtdb:list')
  .description('List all top-level nodes and their basic info')
  .option('--json', 'Output results as JSON')
  .option('--output <file>', 'Save JSON output to file (use with --json)')
  .option('-d, --database-url <url>', 'Firebase Realtime Database URL')
  .hook('preAction', rtdbValidatePreAction)
  .action(async (options) => {
    try {
      await listRealtimeDatabase(options);
    } catch (error) {
      process.exit(1);
    } finally {
      const rtdbApp = admin.app('rtdb-app');
      if (rtdbApp) {
        await rtdbApp.delete();
      }
    }
  });

export default rtdbList;
