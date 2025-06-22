import chalk from 'chalk';
import fs from 'fs';
import { Credentials } from 'google-auth-library';
import inquirer from 'inquirer';

import { CONFIG_DIR, CONFIG_FILE, CREDENTIALS_FILE } from './constants';

type ConfigType = {
  authMethod: string;
  serviceAccountPath?: string;
};

function countNodes(data: any, count: number = 0): number {
  if (data === null || data === undefined) {
    return count;
  }

  if (typeof data === 'object') {
    count++; // Count this object
    for (const key in data) {
      count = countNodes(data[key], count);
    }
  } else {
    count++; // Count primitive values
  }

  return count;
}

// Helper function to determine value type
function determineValueType(value: string | null): string {
  if (typeof value === 'boolean') {
    return 'BOOLEAN';
  } else if (typeof value === 'number') {
    return 'NUMBER';
  } else if (typeof value === 'object' && value !== null) {
    return 'JSON';
  } else {
    return 'STRING';
  }
}

function validateDatabaseUrl(url: string): boolean {
  const urlPattern = /^https:\/\/.*\.firebaseio\.com\/?$/;
  return urlPattern.test(url.trim());
}

async function promptDatabaseUrl() {
  const { databaseUrl } = await inquirer.prompt([
    {
      type: 'input',
      name: 'databaseUrl',
      message: 'Enter Firebase Realtime Database URL:',
      filter: (input) => {
        const path = input.trim();

        if (!path) {
          throw new Error('Please enter a valid database URL');
        }

        if (!validateDatabaseUrl(path)) {
          throw new Error(
            'Please enter a valid Firebase Realtime Database URL (e.g., https://your-project-default-rtdb.firebaseio.com/)'
          );
        }

        return path.replace(/\/$/, '');
      },
    },
  ]);

  return databaseUrl;
}

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

// Save configuration
function saveConfig(config: ConfigType) {
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

function saveCredentials(credentials: Credentials) {
  ensureConfigDir();
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2));
}

export {
  countNodes,
  determineValueType,
  validateDatabaseUrl,
  promptDatabaseUrl,
  ensureConfigDir,
  saveConfig,
  loadConfig,
  saveCredentials,
};
