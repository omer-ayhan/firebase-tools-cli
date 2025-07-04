import { program } from 'commander';
import * as admin from 'firebase-admin';

import { queryRealtimeDatabase } from '@/actions/rtdb/rtdb-query';
import { rtdbValidatePreAction } from '@/hooks/rtdb';

const rtdbQuery = program
  .createCommand('rtdb:query')
  .description('Query a specific path in Realtime Database')
  .argument(
    '[path...]',
    'Database path to query (supports both "users/user4/active" and "users user4 active" formats)',
    ['/']
  )
  .option(
    '-w, --where <field,operator,value>',
    'Where clause (e.g., "age,>=,18" or "workouts/appVersion,==,2.3.1")'
  )
  .option('-l, --limit <number>', 'Limit number of results')
  .option(
    '-o, --order-by <field,direction>',
    'Order by field (e.g., "name,asc" or "metadata/priority,desc")'
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
  $ firebase-tools-cli rtdb:query users/user4/active --database-url https://my-project-default-rtdb.firebaseio.com/
  $ firebase-tools-cli rtdb:query users user4 active --database-url https://my-project-default-rtdb.firebaseio.com/
  $ firebase-tools-cli rtdb:query users --where "age,>=,18" --limit 10
  $ firebase-tools-cli rtdb:query users --where "workouts/appVersion,==,2.3.1" --limit 5
  $ firebase-tools-cli rtdb:query posts --order-by "timestamp,desc" --json
  $ firebase-tools-cli rtdb:query posts --order-by "metadata/priority,asc" --limit 10
  $ firebase-tools-cli rtdb:query products --where "price,<,100" --output results.json
  $ firebase-tools-cli rtdb:query workouts --where "settings/difficulty,>=,3" --order-by "settings/duration,desc"`
  )
  .action(async (pathSegments, options) => {
    try {
      // Handle path construction from multiple segments
      let finalPath: string;

      if (pathSegments.length === 0) {
        finalPath = '/';
      } else if (pathSegments.length === 1) {
        // Single argument - could be either format
        finalPath = pathSegments[0];
      } else {
        // Multiple arguments - join them with '/'
        finalPath = pathSegments.join('/');
      }

      // Clean up the path (remove leading/trailing slashes for consistency)
      if (finalPath !== '/' && finalPath.startsWith('/')) {
        finalPath = finalPath.substring(1);
      }
      if (finalPath.endsWith('/')) {
        finalPath = finalPath.substring(0, finalPath.length - 1);
      }

      await queryRealtimeDatabase(finalPath, options);
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
