import path from 'path';

import packageJson from '../package.json';

export const PROGRAM_NAME = packageJson.name;
export const PROGRAM_DESCRIPTION = packageJson.description;
export const PROGRAM_VERSION = packageJson.version;

export const CONFIG_DIR = path.join(
  require('os').homedir(),
  '.firebase-tools-cli'
);
export const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
export const CREDENTIALS_FILE = path.join(CONFIG_DIR, 'credentials.json');

export const OAUTH_CONFIG = {
  clientId: 'work-in-progress',
  clientSecret: 'work-in-progress',
  redirectUri: 'http://localhost:8080/oauth2callback',
  scopes: [
    'https://www.googleapis.com/auth/firebase',
    'https://www.googleapis.com/auth/firebase.database',
    'https://www.googleapis.com/auth/datastore',
    'https://www.googleapis.com/auth/cloud-platform.read-only',
  ],
};
