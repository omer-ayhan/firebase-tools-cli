import chalk from 'chalk';
import { Command } from 'commander';
import * as admin from 'firebase-admin';
import fs from 'fs';
import inquirer from 'inquirer';
import path from 'path';

import { loadConfig, saveConfig } from '@/utils';

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

  const serviceAccountConfig = {
    credential,
    projectId: projectIdValue,
  };

  admin.initializeApp(serviceAccountConfig);
  const db = admin.firestore();

  return { db, credential, projectId };
}

async function initializeFirebase(thisCommand: Command) {
  const commandName = thisCommand.args[0];
  const skipAuthCommands = ['reset', 'logout', 'login', 'docs', 'convert'];
  const options = thisCommand.opts();

  if (skipAuthCommands.includes(commandName)) {
    return;
  }
  try {
    let projectIdValue = options.project;

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

      return;
    } else {
      console.log(chalk.blue('🔐 Checking authentication...'));

      const config = loadConfig();

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

        return;
      }

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

      return;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red('❌ Failed to initialize Firebase:'), errorMessage);

    if (errorMessage.includes('auth') || errorMessage.includes('credential')) {
      console.log(chalk.yellow('\n💡 Authentication troubleshooting:'));
      console.log(chalk.gray('   • Try: firebase-tools-cli login --force'));
      console.log(chalk.gray('   • Check your Google account permissions'));
      console.log(chalk.gray('   • Verify project access rights'));
      console.log(chalk.gray('   • Consider using a service account instead'));
    }

    process.exit(1);
  }
}

export { initializeFirebase };
