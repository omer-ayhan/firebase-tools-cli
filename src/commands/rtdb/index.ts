import chalk from 'chalk';
import { Command } from 'commander';
import * as admin from 'firebase-admin';

import { promptDatabaseUrl, validateDatabaseUrl } from '@/utils';

import { exportRealtimeDatabase } from './rtdb-export';
import { listRealtimeDatabase } from './rtdb-list';

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
      await admin.app('rtdb-app').delete();
    }
  });

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
  $ firestore-cli rtdb:export --database-url https://my-project-default-rtdb.firebaseio.com/ --output ./backups/
  $ firestore-cli rtdb:export --database-url https://my-project-default-rtdb.firebaseio.com/  --exclude users logs --output ./backups/
  $ firestore-cli rtdb:export --database-url https://my-project-default-rtdb.firebaseio.com/ --no-subcollections --no-detailed`
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
  exportCommand,
};
