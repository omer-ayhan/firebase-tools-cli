import chalk from 'chalk';
import { Command } from 'commander';
import fs from 'fs';
import inquirer from 'inquirer';
import path from 'path';

import { CONFIG_FILE, CREDENTIALS_FILE } from '@/constants';

import { loadConfig, promptServiceAccountFile, saveConfig } from './login';

const authCommand = new Command()
  .command('auth')
  .description('Authentication operations');

const loginCommand = authCommand
  .command('login')
  .description('Authenticate with Google account or service account')
  .option('--force', 'Force re-authentication even if already logged in')
  .option('--method <type>', 'Authentication method: oauth or service-account')
  .action(async (options) => {
    try {
      const config = loadConfig();

      // Check if already authenticated with service account
      if (
        config.serviceAccountPath &&
        fs.existsSync(config.serviceAccountPath) &&
        !options.force
      ) {
        console.log(
          chalk.green('✅ Already authenticated with service account')
        );

        if (config.defaultProject) {
          console.log(
            chalk.gray(`   └── Default project: ${config.defaultProject}`)
          );
        }

        console.log(chalk.blue('\n💡 Available options:'));
        console.log(chalk.gray('   • Use --force to re-authenticate'));
        console.log(
          chalk.gray('   • Use "firebase-cli projects" to change project')
        );
        console.log(
          chalk.gray('   • Use "firebase-cli reset" to clear configuration')
        );
        return;
      }

      console.log(chalk.blue('🔐 Starting authentication process...\n'));

      // Only support service account authentication
      console.log(chalk.blue('🔑 Service Account Authentication\n'));
      const serviceAccountPath = await promptServiceAccountFile();

      const serviceAccount = require(path.resolve(serviceAccountPath));
      console.log(chalk.green('✅ Service account loaded successfully!'));
      console.log(chalk.gray(`   └── Project: ${serviceAccount.project_id}`));

      // Save service account info to config for future use
      const newConfig = {
        ...config,
        serviceAccountPath: path.resolve(serviceAccountPath),
        defaultProject: serviceAccount.project_id,
      };

      saveConfig(newConfig);
      console.log(chalk.green(`✅ Service account saved for future use`));
      console.log(
        chalk.green(`✅ Default project set to: ${serviceAccount.project_id}`)
      );

      console.log(
        chalk.green('\n🎉 Setup complete! You can now use all commands.')
      );
      console.log(
        chalk.gray('💡 No need to specify --service-account flag anymore')
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      console.error(chalk.red('❌ Authentication failed:'), errorMessage);
      process.exit(1);
    }
  });

const resetCommand = authCommand
  .command('reset')
  .description('Reset all configuration and credentials')
  .option('--config-only', 'Reset only configuration (keep credentials)')
  .option('--credentials-only', 'Reset only credentials (keep configuration)')
  .action(async (options) => {
    try {
      const config = loadConfig();

      // Show current state
      console.log(chalk.blue('📋 Current Configuration:'));

      if (
        config.serviceAccountPath &&
        fs.existsSync(config.serviceAccountPath)
      ) {
        console.log(chalk.gray('   └── Service Account: ✅ Present'));
        console.log(chalk.gray(`   └── Path: ${config.serviceAccountPath}`));
      } else {
        console.log(chalk.gray('   └── Service Account: ❌ Not found'));
      }

      if (config.defaultProject) {
        console.log(
          chalk.gray(`   └── Default Project: ${config.defaultProject}`)
        );
      } else {
        console.log(chalk.gray('   └── Default Project: ❌ Not set'));
      }

      // Determine what to reset
      let resetCredentials = true;
      let resetConfig = true;

      if (options.configOnly) {
        resetCredentials = false;
        console.log(chalk.yellow('\n🔄 Resetting configuration only...'));
      } else if (options.credentialsOnly) {
        resetConfig = false;
        console.log(chalk.yellow('\n🔄 Resetting credentials only...'));
      } else {
        // Ask for confirmation for full reset
        const { confirmReset } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmReset',
            message:
              'This will reset ALL configuration and credentials. Continue?',
            default: false,
          },
        ]);

        if (!confirmReset) {
          console.log(chalk.gray('Reset cancelled.'));
          return;
        }

        console.log(
          chalk.yellow('\n🔄 Resetting all configuration and credentials...')
        );
      }

      let resetCount = 0;

      // Reset credentials
      if (resetCredentials && fs.existsSync(CREDENTIALS_FILE)) {
        fs.unlinkSync(CREDENTIALS_FILE);
        console.log(chalk.green('   ✅ Credentials cleared'));
        resetCount++;
      }

      // Reset configuration
      if (resetConfig && fs.existsSync(CONFIG_FILE)) {
        fs.unlinkSync(CONFIG_FILE);
        console.log(chalk.green('   ✅ Configuration cleared'));
        resetCount++;
      }

      if (resetCount === 0) {
        console.log(
          chalk.yellow('   ⚠️  Nothing to reset - files already clean')
        );
      } else {
        console.log(
          chalk.green(`\n🎉 Reset completed! ${resetCount} file(s) cleared.`)
        );
        console.log(
          chalk.gray(
            "You'll need to run 'firebase-cli login' to authenticate again."
          )
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      console.error(chalk.red('❌ Reset failed:'), errorMessage);
      process.exit(1);
    }
  });

const projectsCommand = authCommand
  .command('projects')
  .description('List available projects and manage default project')
  .option('--set-default <project>', 'Set default project')
  .option('--clear-default', 'Clear the default project setting')
  .action(async (options, command) => {
    try {
      const config = loadConfig();

      // Get parent command options (global options like --service-account)
      const parentOptions = command.parent?.opts() || {};

      // Handle clearing default project
      if (options.clearDefault) {
        if (config.defaultProject) {
          const newConfig = { ...config };
          delete newConfig.defaultProject;
          saveConfig(newConfig);
          console.log(chalk.green('✅ Default project cleared'));
        } else {
          console.log(chalk.yellow('⚠️  No default project was set'));
        }
        return;
      }

      // Handle service account authentication from parent options
      if (parentOptions.serviceAccount) {
        if (!fs.existsSync(parentOptions.serviceAccount)) {
          console.error(
            chalk.red(
              `❌ Service account file not found: ${parentOptions.serviceAccount}`
            )
          );
          process.exit(1);
        }

        try {
          const serviceAccount = require(path.resolve(
            parentOptions.serviceAccount
          ));

          // For service accounts, we can't list projects via API easily
          // So we'll show the project from the service account file
          console.log(chalk.cyan('Service Account Project:\n'));
          console.log(chalk.white(`📁 ${serviceAccount.project_id}`));
          console.log(chalk.gray(`   └── ID: ${serviceAccount.project_id}`));
          console.log(chalk.gray(`   └── Type: Service Account`));

          const isDefault = serviceAccount.project_id === config.defaultProject;
          if (isDefault) {
            console.log(chalk.green('   └── Status: ✓ (default)'));
          }

          console.log();
          console.log(chalk.blue('💡 Commands:'));
          console.log(
            chalk.gray(
              `   • firebase-cli projects --set-default ${serviceAccount.project_id}`
            )
          );
          console.log(chalk.gray('   • firebase-cli projects --clear-default'));
          console.log(
            chalk.gray('   • firebase-cli --service-account <path> [command]')
          );
          return;
        } catch (error) {
          console.error(chalk.red('❌ Invalid service account file'));
          process.exit(1);
        }
      }

      // Handle setting default project
      if (options.setDefault) {
        saveConfig({ ...config, defaultProject: options.setDefault });
        console.log(
          chalk.green(`✅ Default project set to: ${options.setDefault}`)
        );
        return;
      }

      // Check for saved service account from login
      if (
        config.serviceAccountPath &&
        fs.existsSync(config.serviceAccountPath)
      ) {
        try {
          const serviceAccount = require(path.resolve(
            config.serviceAccountPath
          ));
          console.log(
            chalk.blue('🔑 Using saved service account authentication')
          );
          console.log(chalk.cyan('Service Account Project:\n'));
          console.log(chalk.white(`📁 ${serviceAccount.project_id}`));
          console.log(chalk.gray(`   └── ID: ${serviceAccount.project_id}`));
          console.log(chalk.gray(`   └── Type: Service Account`));

          const isDefault = serviceAccount.project_id === config.defaultProject;
          if (isDefault) {
            console.log(chalk.green('   └── Status: ✓ (default)'));
          }

          console.log();
          console.log(chalk.blue('💡 Commands:'));
          console.log(
            chalk.gray(
              `   • firebase-cli projects --set-default ${serviceAccount.project_id}`
            )
          );
          console.log(chalk.gray('   • firebase-cli projects --clear-default'));
          console.log(chalk.gray('   • firebase-cli reset --config-only'));
          return;
        } catch (error) {
          console.error(chalk.red('❌ Invalid saved service account file'));
          console.log(chalk.yellow('💡 Try: firebase-cli login'));
          return;
        }
      }

      console.log(chalk.yellow('🔐 No authentication found'));
      console.log(chalk.gray('Run: firebase-cli login'));
      console.log(
        chalk.gray('Or use: firebase-cli --service-account <path> projects')
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      console.error(chalk.red('❌ Failed to fetch projects:'), errorMessage);

      if (errorMessage.includes('auth')) {
        console.log(chalk.yellow('💡 Try: firebase-cli login --force'));
      }
    }
  });

export default {
  loginCommand,
  resetCommand,
  projectsCommand,
};
