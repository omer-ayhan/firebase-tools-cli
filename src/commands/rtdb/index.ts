import chalk from 'chalk';
import { Command } from 'commander';
import * as admin from 'firebase-admin';

import { promptDatabaseUrl, validateDatabaseUrl } from '@/utils';

import { exportRealtimeDatabase } from './rtdb-export';
import { listRealtimeDatabase } from './rtdb-list';
import { queryRealtimeDatabase } from './rtdb-query';

async function rtdbCommandPreAction(thisCommand: Command) {
  const options = thisCommand.opts();
  const isDatabaseValid = options.databaseUrl
    ? validateDatabaseUrl(options.databaseUrl)
    : false;

  if (!options.databaseUrl || !isDatabaseValid) {
    console.log(
      chalk.yellow('🔗 Realtime Database URL required for RTDB commands\n')
    );
    options.databaseUrl = await promptDatabaseUrl();
  }

  // Create a separate app instance for RTDB operations
  try {
    // Check if RTDB app already exists
    const existingApp = admin.apps.find((app) => app?.name === 'rtdb-app');
    if (existingApp) {
      await existingApp.delete();
    }
  } catch (error) {
    // App doesn't exist, which is fine
  }

  // Get the credential from the default app (already initialized)
  const defaultApp = admin.app();
  const credential = defaultApp.options.credential;
  const projectId = defaultApp.options.projectId;

  // Initialize a new app specifically for RTDB with the database URL
  admin.initializeApp(
    {
      credential: credential,
      projectId: projectId,
      databaseURL: options.databaseUrl,
    },
    'rtdb-app'
  );

  console.log(chalk.blue(`🔗 Using database: ${options.databaseUrl}\n`));
}

const rtdbCommand = new Command()
  .name('rtdb')
  .description('Realtime Database operations')
  .option('--database-url <url>', 'Firebase Realtime Database URL');

const listCommand = rtdbCommand
  .command('rtdb:list')
  .description('List all top-level nodes and their basic info')
  .option('--json', 'Output results as JSON')
  .option('--output <file>', 'Save JSON output to file (use with --json)')
  .option('--database-url <url>', 'Firebase Realtime Database URL')
  .hook('preAction', rtdbCommandPreAction)
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

const queryCommand = rtdbCommand
  .command('rtdb:query')
  .description('Query a specific database')
  .argument('<database>', 'Database name to query')
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
  .option('--database-url <url>', 'Firebase Realtime Database URL')
  .hook('preAction', rtdbCommandPreAction)
  .addHelpText(
    'after',
    `
Examples:
  $ firebase-cli rtdb:query users --database-url https://my-project-default-rtdb.firebaseio.com/
  $ firebase-cli rtdb:query users --where "age,>=,18" --limit 10
  $ firebase-cli rtdb:query posts --order-by "timestamp,desc" --json
  $ firebase-cli rtdb:query products --where "price,<,100" --output results.json`
  )
  .action(async (database, options) => {
    try {
      await queryRealtimeDatabase(database, options);
    } catch (error) {
      process.exit(1);
    } finally {
      const rtdbApp = admin.app('rtdb-app');
      if (rtdbApp) {
        await rtdbApp.delete();
      }
    }
  });

const importCommand = rtdbCommand
  .command('rtdb:import')
  .description('Import data to Realtime Database from JSON file')
  .argument('<file>', 'JSON file to import')
  .option('-b, --batch-size <size>', 'Batch size for imports', '500')
  .option('-m, --merge', 'Merge documents instead of overwriting');

const exportCommand = rtdbCommand
  .command('rtdb:export')
  .description('Export all data from Realtime Database')
  .option('-o, --output <dir>', 'Output directory', './')
  .option('--no-detailed', 'Skip detailed format export')
  .option('--no-importable', 'Skip importable format export')
  .option('--no-subcollections', 'Skip nested data (limit to top level only)')
  .option('-e, --exclude <paths...>', 'Exclude specific top-level paths')
  .option('--database-url <url>', 'Firebase Realtime Database URL')
  .hook('preAction', rtdbCommandPreAction)
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

export default {
  listCommand,
  importCommand,
  exportCommand,
  queryCommand,
};
