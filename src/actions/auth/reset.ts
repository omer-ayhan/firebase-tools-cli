import chalk from 'chalk';
import fs from 'fs';
import inquirer from 'inquirer';

import { CONFIG_FILE, CREDENTIALS_FILE } from '@/constants';
import { loadConfig } from '@/utils';

type ResetActionType = {
  configOnly?: boolean;
  credentialsOnly?: boolean;
};

const resetAction = async (options: ResetActionType) => {
  try {
    const config = loadConfig();

    console.log(chalk.blue('📋 Current Configuration:'));

    if (config.serviceAccountPath && fs.existsSync(config.serviceAccountPath)) {
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
          "You'll need to run 'firebase-tools-cli login' to authenticate again."
        )
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(chalk.red('❌ Reset failed:'), errorMessage);
    process.exit(1);
  }
};

export { resetAction };
