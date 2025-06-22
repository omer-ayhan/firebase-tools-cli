import * as admin from 'firebase-admin';

import { queryRealtimeDatabase } from '@/actions/rtdb/rtdb-query';
import { rtdbValidatePreAction } from '@/hooks/rtdb';

import rtdbProgram from './index';

const rtdbQuery = rtdbProgram
  .createCommand('rtdb:query')
  .description('Query a specific path in Realtime Database')
  .argument('[path]', 'Database path to query', '/')
  .option(
    '-w, --where <field,operator,value>',
    'Where clause (e.g., "age,>=,18")'
  )
  .option('-l, --limit <number>', 'Limit number of results')
  .option(
    '-o, --order-by <field,direction>',
    'Order by field (e.g., "name,asc")'
  )
  .option('--json', 'Output results as JSON')
  .option('--output <file>', 'Save JSON output to file (use with --json)')
  .option('-d, --database-url <url>', 'Firebase Realtime Database URL')
  .hook('preAction', rtdbValidatePreAction)
  .addHelpText(
    'after',
    `
Examples:
  $ firebase-tools-cli rtdb:query --database-url https://my-project-default-rtdb.firebaseio.com/
  $ firebase-tools-cli rtdb:query users --database-url https://my-project-default-rtdb.firebaseio.com/
  $ firebase-tools-cli rtdb:query users --where "age,>=,18" --limit 10
  $ firebase-tools-cli rtdb:query posts --order-by "timestamp,desc" --json
  $ firebase-tools-cli rtdb:query products --where "price,<,100" --output results.json`
  )
  .action(async (path, options) => {
    try {
      await queryRealtimeDatabase(path, options);
    } catch (error) {
      process.exit(1);
    } finally {
      const rtdbApp = admin.app('rtdb-app');
      if (rtdbApp) {
        await rtdbApp.delete();
      }
    }
  });

export default rtdbQuery;
