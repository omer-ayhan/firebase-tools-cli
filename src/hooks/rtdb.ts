import chalk from 'chalk';
import { Command } from 'commander';
import * as admin from 'firebase-admin';

import { promptDatabaseUrl, validateDatabaseUrl } from '@/utils';

async function rtdbValidatePreAction(thisCommand: Command) {
  const options = { ...thisCommand.opts(), ...thisCommand.parent?.opts() };
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

export { rtdbValidatePreAction };
