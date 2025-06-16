import chalk from 'chalk';
import { Command } from 'commander';
import fs from 'fs';
import { Credentials, OAuth2Client } from 'google-auth-library';
import path from 'path';

import { loadConfig, saveConfig } from '@/utils';

type ProjectType = {
  projectId: string;
  displayName: string;
  state: string;
  lifecycleState: string;
  name: string;
};
type ListProjectsActionType = {
  clearDefault: boolean;
  setDefault: boolean;
};

async function listUserProjects(credentials: Credentials) {
  try {
    const oauth2Client = new OAuth2Client();
    oauth2Client.setCredentials({
      access_token: credentials.access_token,
      token_type: credentials.token_type,
    });

    console.log(
      chalk.gray('Fetching projects from Firebase Management API...')
    );

    // FIXED: Use Firebase Management API instead of Cloud Resource Manager
    try {
      // First try Firebase Management API
      const firebaseResponse = await oauth2Client.request<{
        results: ProjectType[];
      }>({
        url: 'https://firebase.googleapis.com/v1beta1/projects',
        method: 'GET',
      });

      if (firebaseResponse.data && firebaseResponse.data.results) {
        console.log(
          chalk.green(
            `✅ Found ${firebaseResponse.data.results.length} Firebase projects`
          )
        );
        return firebaseResponse.data.results.map((project) => ({
          projectId: project.projectId,
          name: project.displayName || project.projectId,
          lifecycleState: project.state || 'ACTIVE',
        }));
      }
    } catch (firebaseError) {
      console.log(
        chalk.yellow(
          '⚠️  Firebase Management API not accessible, trying Cloud Resource Manager...'
        )
      );
    }

    // Fallback to Cloud Resource Manager API
    const response = await oauth2Client.request<{
      projects: ProjectType[];
    }>({
      url: 'https://cloudresourcemanager.googleapis.com/v1/projects',
      method: 'GET',
    });

    if (response.data && response.data.projects) {
      console.log(
        chalk.green(
          `✅ Found ${response.data.projects.length} Google Cloud projects`
        )
      );
      return response.data.projects.filter(
        (project) => project.lifecycleState === 'ACTIVE'
      );
    }

    return [];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.warn(chalk.yellow('⚠️  Could not fetch projects:'), errorMessage);

    if (errorMessage.includes('403')) {
      console.log(
        chalk.yellow(
          '💡 This might be a permissions issue. Make sure your Google account has access to Firebase/Cloud projects.'
        )
      );
    }

    return [];
  }
}

const listProjectsAction = async (
  options: ListProjectsActionType,
  command: Command
) => {
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
            `   • firebase-tools-cli projects --set-default ${serviceAccount.project_id}`
          )
        );
        console.log(
          chalk.gray('   • firebase-tools-cli projects --clear-default')
        );
        console.log(
          chalk.gray(
            '   • firebase-tools-cli --service-account <path> [command]'
          )
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
    if (config.serviceAccountPath && fs.existsSync(config.serviceAccountPath)) {
      try {
        const serviceAccount = require(path.resolve(config.serviceAccountPath));
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
            `   • firebase-tools-cli projects --set-default ${serviceAccount.project_id}`
          )
        );
        console.log(
          chalk.gray('   • firebase-tools-cli projects --clear-default')
        );
        console.log(chalk.gray('   • firebase-tools-cli reset --config-only'));
        return;
      } catch (error) {
        console.error(chalk.red('❌ Invalid saved service account file'));
        console.log(chalk.yellow('💡 Try: firebase-tools-cli login'));
        return;
      }
    }

    console.log(chalk.yellow('🔐 No authentication found'));
    console.log(chalk.gray('Run: firebase-tools-cli login'));
    console.log(
      chalk.gray('Or use: firebase-tools-cli --service-account <path> projects')
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(chalk.red('❌ Failed to fetch projects:'), errorMessage);

    if (errorMessage.includes('auth')) {
      console.log(chalk.yellow('💡 Try: firebase-tools-cli login --force'));
    }
  }
};

export { listUserProjects, listProjectsAction };
