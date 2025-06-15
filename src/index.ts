import chalk from 'chalk';
import { Command } from 'commander';
import admin from 'firebase-admin';
import fs from 'fs';
import inquirer from 'inquirer';
import path from 'path';

import authCommand from './commands/auth';
import docsCommand from './commands/docs';
import firestoreCommand from './commands/firestore';
import remoteConfigCommand from './commands/remote-config';
import rtdbCommand from './commands/rtdb';
import {
  CONFIG_DIR,
  CONFIG_FILE,
  PROGRAM_DESCRIPTION,
  PROGRAM_NAME,
  PROGRAM_VERSION,
} from './constants';

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

const program = new Command();

program
  .name(PROGRAM_NAME)
  .description(PROGRAM_DESCRIPTION)
  .version(PROGRAM_VERSION);

// Global variables
let db;

// Ensure config directory exists
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

// Save configuration
function saveConfig(config: any) {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// Load configuration
function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Could not load config file'));
      return {};
    }
  }
  return {};
}

// Add this helper function to prompt for service account file
async function promptServiceAccountFile() {
  const { serviceAccountPath } = await inquirer.prompt([
    {
      type: 'input',
      name: 'serviceAccountPath',
      message: 'Enter path to service account JSON file:',
      filter: (input) => {
        const path = input.trim();

        if (!path) {
          throw new Error('Please enter a valid file path');
        }

        if (!fs.existsSync(path)) {
          throw new Error(`File not found: ${path}`);
        }

        try {
          const content = JSON.parse(fs.readFileSync(path, 'utf8'));
          if (!content.type || content.type !== 'service_account') {
            throw new Error('Invalid service account file format');
          }
        } catch (error) {
          throw new Error('Invalid JSON file');
        }

        return path;
      },
    },
  ]);

  return serviceAccountPath;
}

async function configureAdminServiceAccount(
  serviceAccountPath: string,
  projectId: string
) {
  const serviceAccount = require(path.resolve(serviceAccountPath));
  const credential = admin.credential.cert(serviceAccount);
  const projectIdValue = projectId || serviceAccount.project_id;

  console.log(chalk.blue(`🔑 Using service account authentication`));
  console.log(chalk.gray(`   └── Project: ${projectIdValue}`));

  // Initialize Firebase with service account and skip OAuth logic
  const serviceAccountConfig = {
    credential,
    projectId: projectIdValue,
  };

  admin.initializeApp(serviceAccountConfig);
  const db = admin.firestore();

  return { db, credential, projectId };
}

async function testFirebaseConnection(db: admin.firestore.Firestore) {
  try {
    await db.listCollections();
    console.log(chalk.green('🔥 Firebase initialized successfully\n'));
  } catch (testError) {
    if (
      testError instanceof Error &&
      testError.message.includes('PERMISSION_DENIED')
    ) {
      console.error(
        chalk.red('❌ Permission denied - check your project access')
      );
      console.log(chalk.yellow('💡 Make sure:'));
      console.log(
        chalk.gray(
          '   • Your service account has Firestore access in this project'
        )
      );
      console.log(chalk.gray('   • The project has Firestore enabled'));
      console.log(chalk.gray("   • You're using the correct project ID"));
    } else {
      console.error(
        chalk.red('❌ Firebase connection test failed:'),
        testError instanceof Error ? testError.message : String(testError)
      );
    }
    throw testError;
  }
}

async function initializeFirebase(options: any) {
  try {
    // let credential;
    let projectIdValue = options.project;

    // Method 1: Service Account File (if provided via CLI)
    if (options.serviceAccount) {
      if (!fs.existsSync(options.serviceAccount)) {
        console.error(
          chalk.red(
            `❌ Service account file not found: ${options.serviceAccount}`
          )
        );
        process.exit(1);
      }

      const { db } = await configureAdminServiceAccount(
        options.serviceAccount,
        projectIdValue
      );

      await testFirebaseConnection(db);

      return true;
    }
    // Method 2: Check for saved service account or prompt for authentication
    else {
      console.log(chalk.blue('🔐 Checking authentication...'));

      const config = loadConfig();

      // Check if we have a saved service account from previous login
      if (
        config.serviceAccountPath &&
        fs.existsSync(config.serviceAccountPath)
      ) {
        console.log(
          chalk.blue('🔑 Using saved service account authentication')
        );

        projectIdValue = projectIdValue || config.defaultProject;

        const { db } = await configureAdminServiceAccount(
          config.serviceAccountPath,
          projectIdValue
        );

        // Test the connection
        await testFirebaseConnection(db);

        return true;
      }

      // No saved service account found, prompt for authentication
      console.log(chalk.yellow('🔐 No authentication found'));
      console.log(
        chalk.blue("Let's set up service account authentication...\n")
      );

      const serviceAccountPath = await promptServiceAccountFile();
      options.serviceAccount = serviceAccountPath;
      const serviceAccount = require(path.resolve(serviceAccountPath));
      const { db, projectId } = await configureAdminServiceAccount(
        serviceAccountPath,
        projectIdValue || serviceAccount.project_id || config.defaultProject
      );

      // Ask if user wants to save for future use
      const { saveForFuture } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'saveForFuture',
          message: 'Save this service account for future use? (Recommended)',
          default: true,
        },
      ]);

      if (saveForFuture) {
        const newConfig = {
          ...config,
          serviceAccountPath: path.resolve(serviceAccountPath),
          defaultProject: projectId,
        };
        saveConfig(newConfig);
        console.log(chalk.green('✅ Service account saved for future use'));
        console.log(
          chalk.gray(
            "   You won't need to specify it again for future commands"
          )
        );
      } else {
        console.log(chalk.yellow('⚠️  Service account not saved'));
        console.log(
          chalk.gray(
            "   You'll need to use --service-account flag for future commands"
          )
        );
      }

      // Test the connection
      await testFirebaseConnection(db);

      return true;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red('❌ Failed to initialize Firebase:'), errorMessage);

    if (errorMessage.includes('auth') || errorMessage.includes('credential')) {
      console.log(chalk.yellow('\n💡 Authentication troubleshooting:'));
      console.log(chalk.gray('   • Try: firebase-cli login --force'));
      console.log(chalk.gray('   • Check your Google account permissions'));
      console.log(chalk.gray('   • Verify project access rights'));
      console.log(chalk.gray('   • Consider using a service account instead'));
    }

    process.exit(1);
  }
}

// Global options for authentication and project
program
  .option('-s, --service-account <path>', 'Path to service account JSON file')
  .option('-p, --project <id>', 'Google Cloud Project ID (overrides default)')
  .option('-d, --database-url <url>', 'Firebase Realtime Database URL')
  .hook('preAction', async (thisCommand) => {
    // Skip authentication for commands that don't need it
    const commandName = thisCommand.args[0];
    const skipAuthCommands = ['reset', 'logout', 'login', 'docs', 'convert'];
    const opts = thisCommand.opts();

    if (skipAuthCommands.includes(commandName)) {
      return; // Skip authentication for these commands
    }

    await initializeFirebase(opts);
  })
  .addCommand(docsCommand)
  .addCommand(firestoreCommand.exportCommand)
  .addCommand(firestoreCommand.importCommand)
  .addCommand(firestoreCommand.listCommand)
  .addCommand(firestoreCommand.queryCommand)
  .addCommand(rtdbCommand.importCommand)
  .addCommand(rtdbCommand.exportCommand)
  .addCommand(rtdbCommand.listCommand)
  .addCommand(rtdbCommand.queryCommand)
  .addCommand(authCommand.loginCommand)
  .addCommand(authCommand.projectsCommand)
  .addCommand(authCommand.resetCommand)
  .addCommand(remoteConfigCommand.convertCommand);

// // TODO: RTDB import command
// program
// .command("rtdb:import")
// .description("Import data to Realtime Database from JSON file")
// .argument("<file>", "JSON file to import")
// .option("-b, --batch-size <size>", "Batch size for imports", "500")
// .option("-m, --merge", "Merge documents instead of overwriting");

// Parse arguments
program.parse();
