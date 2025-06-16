import * as admin from 'firebase-admin';

import { exportRealtimeDatabase } from '@/actions/rtdb/rtdb-export';
import { rtdbValidatePreAction } from '@/hooks/rtdb';

import rtdbProgram from './index';

const rtdbExport = rtdbProgram
  .createCommand('rtdb:export')
  .description('Export all data from Realtime Database')
  .option('-o, --output <dir>', 'Output directory', './')
  .option('--no-detailed', 'Skip detailed format export')
  .option('--no-importable', 'Skip importable format export')
  .option('--no-subcollections', 'Skip nested data (limit to top level only)')
  .option('-e, --exclude <paths...>', 'Exclude specific top-level paths')
  .option('--database-url <url>', 'Firebase Realtime Database URL')
  .hook('preAction', rtdbValidatePreAction)
  .addHelpText(
    'after',
    `
Examples:
  $ firebase-cli rtdb:export --database-url https://my-project-default-rtdb.firebaseio.com/ --output ./backups/
  $ firebase-cli rtdb:export --database-url https://my-project-default-rtdb.firebaseio.com/  --exclude users logs --output ./backups/
  $ firebase-cli rtdb:export --database-url https://my-project-default-rtdb.firebaseio.com/ --no-subcollections --no-detailed`
  )
  .action(async (options) => {
    try {
      await exportRealtimeDatabase(options);
    } catch (error) {
      process.exit(1);
    } finally {
      const rtdbApp = admin.app('rtdb-app');
      if (rtdbApp) {
        await rtdbApp.delete();
      }
    }
  });

export default rtdbExport;
