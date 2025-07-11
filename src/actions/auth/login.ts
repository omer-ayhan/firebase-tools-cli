import chalk from 'chalk';
import express from 'express';
import fs from 'fs';
import { Credentials, OAuth2Client } from 'google-auth-library';
import inquirer from 'inquirer';
import open from 'open';
import path from 'path';

import { CREDENTIALS_FILE, OAUTH_CONFIG } from '@/constants';
import { loadConfig, saveConfig, saveCredentials } from '@/utils';

interface ErrorWithCode extends Error {
  code?: string;
}

type LoginMethod = 'oauth' | 'service-account';
type LoginActionType = {
  force?: boolean;
  method?: LoginMethod;
};

async function authenticateWithOAuth(): Promise<Credentials> {
  return new Promise((resolve, reject) => {
    const oauth2Client = new OAuth2Client(
      OAUTH_CONFIG.clientId,
      OAUTH_CONFIG.clientSecret,
      OAUTH_CONFIG.redirectUri
    );

    // Generate the url that will be used for the consent dialog
    const authorizeUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: OAUTH_CONFIG.scopes,
      prompt: 'consent',
      include_granted_scopes: true, // ADDED: Include previously granted scopes
    });

    console.log(chalk.blue('🔐 Starting OAuth2 authentication...\n'));
    console.log(chalk.gray('Opening browser for Google authentication...'));
    console.log(
      chalk.yellow(
        'Note: You may need to verify your app with Google if this is your first time.'
      )
    );

    // Create temporary server to handle callback
    const app = express();
    const server = app.listen(8080, () => {
      console.log(chalk.gray('Local server started on port 8080'));
    });

    // IMPROVED: Better error handling in callback
    app.get('/oauth2callback', async (req, res) => {
      const { code, error, error_description } = req.query;

      if (error) {
        const errorMsg = error_description || error;
        res.send(`
            <h1>❌ Authentication Error</h1>
            <p><strong>Error:</strong> ${error}</p>
            <p><strong>Description:</strong> ${errorMsg}</p>
            <p>Please check the console for troubleshooting steps.</p>
          `);
        server.close();

        console.error(chalk.red(`❌ OAuth error: ${error}`));
        if (errorMsg) {
          console.error(chalk.red(`   Description: ${errorMsg}`));
        }

        // Provide helpful error messages
        if (error === 'access_denied') {
          console.log(chalk.yellow('\n💡 Troubleshooting:'));
          console.log(
            chalk.gray('   • Make sure you granted all required permissions')
          );
          console.log(
            chalk.gray(
              '   • Check if your Google account has access to Firebase projects'
            )
          );
        }

        reject(new Error(`OAuth error: ${error} - ${errorMsg}`));
        return;
      }

      if (!code) {
        res.send(`<h1>❌ No authorization code received</h1>`);
        server.close();
        reject(new Error('No authorization code received'));
        return;
      }

      try {
        // Exchange code for tokens
        const { tokens } = await oauth2Client.getToken(code as string);

        // IMPROVED: Better token validation
        if (!tokens.access_token) {
          throw new Error('No access token received');
        }

        // Save credentials with better structure
        const credentials = {
          type: 'oauth2',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expiry_date: tokens.expiry_date,
          token_type: tokens.token_type || 'Bearer',
          scope: tokens.scope,
          created_at: Date.now(),
        };

        saveCredentials(credentials);

        res.send(`
            <html>
              <head><title>Authentication Success</title></head>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: green;">✅ Authentication Successful!</h1>
                <p>You can now close this window and return to the CLI.</p>
                <p><em>This window will close automatically in 3 seconds...</em></p>
                <script>setTimeout(() => window.close(), 3000);</script>
              </body>
            </html>
          `);

        server.close();
        resolve(credentials);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);

        console.error('Token exchange error:', errorMessage);
        res.send(`
            <h1>❌ Authentication Failed</h1>
            <p><strong>Error:</strong> ${errorMessage}</p>
            <p>Please check the console for more details.</p>
          `);
        server.close();
        reject(err);
      }
    });

    // Handle server startup errors
    server.on('error', (err: ErrorWithCode) => {
      if (err.code === 'EADDRINUSE') {
        console.error(chalk.red('❌ Port 8080 is already in use'));
        console.log(
          chalk.yellow(
            'Please close any applications using port 8080 and try again'
          )
        );
      } else {
        console.error(chalk.red('❌ Server error:'), err.message);
      }
      reject(err);
    });

    // Add timeout for the authentication process
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error('Authentication timeout - please try again'));
    }, 300000); // 5 minutes timeout

    server.on('close', () => {
      clearTimeout(timeout);
    });

    // Open browser
    open(authorizeUrl).catch(() => {
      console.log(chalk.yellow('\n⚠️  Could not open browser automatically'));
      console.log(chalk.blue('Please visit this URL to authenticate:'));
      console.log(chalk.cyan(authorizeUrl));
    });
  });
}

// FIXED: Better token refresh logic
async function refreshTokenIfNeeded(credentials: Credentials) {
  const oauth2Client = new OAuth2Client(
    OAUTH_CONFIG.clientId,
    OAUTH_CONFIG.clientSecret,
    OAUTH_CONFIG.redirectUri
  );

  oauth2Client.setCredentials({
    access_token: credentials.access_token,
    refresh_token: credentials.refresh_token,
    expiry_date: credentials.expiry_date,
  });

  // Check if token is expired or will expire soon (5 minutes buffer)
  const expiryBuffer = 5 * 60 * 1000; // 5 minutes in milliseconds
  const isExpired =
    credentials.expiry_date &&
    Date.now() + expiryBuffer >= credentials.expiry_date;

  if (isExpired && credentials.refresh_token) {
    console.log(chalk.blue('🔄 Refreshing expired token...'));

    try {
      const { credentials: newCredentials } =
        await oauth2Client.refreshAccessToken();

      const updatedCredentials = {
        ...credentials,
        access_token: newCredentials.access_token,
        refresh_token:
          newCredentials.refresh_token || credentials.refresh_token,
        expiry_date: newCredentials.expiry_date,
        token_type: newCredentials.token_type || credentials.token_type,
      };

      saveCredentials(updatedCredentials);
      console.log(chalk.green('✅ Token refreshed successfully'));
      return updatedCredentials;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      console.warn(chalk.yellow('⚠️  Could not refresh token:'), errorMessage);
      console.log(chalk.blue('Re-authentication required...'));
      throw error;
    }
  }

  return credentials;
}

// Add this new function after the existing authentication functions
async function promptAuthenticationMethod() {
  const { authMethod } = await inquirer.prompt([
    {
      type: 'list',
      name: 'authMethod',
      message: 'Choose authentication method:',
      choices: [
        {
          name: chalk.dim(
            '🔐 OAuth (Google Account) - Interactive browser authentication'
          ),
          value: 'oauth',
          short: 'OAuth',
          disabled: chalk.dim('Work in Progress'),
        },
        {
          name: '🔑 Service Account - JSON key file authentication',
          value: 'service-account',
          short: 'Service Account',
        },
      ],
      default: 'oauth',
    },
  ]);

  return authMethod;
}

async function promptReauthenticateLogin(): Promise<boolean> {
  const { reauthenticate } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'reauthenticate',
      message: 'Do you want to re-authenticate?',
      default: false,
    },
  ]);

  return reauthenticate;
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
          const content = JSON.parse(fs.readFileSync(input.trim(), 'utf8'));
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

// Load credentials
function loadCredentials() {
  if (fs.existsSync(CREDENTIALS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Could not load credentials file'));
      return null;
    }
  }
  return null;
}

const loginAction = async (options: LoginActionType) => {
  try {
    const config = loadConfig();
    let isReauthenticate = false;

    if (options.method == 'oauth') {
      console.log(
        chalk.gray(
          '🔐 oauth is not implemented yet. We are working on it. Please use service-account instead.\n'
        )
      );
      return;
    }

    // Check if already authenticated with service account
    if (
      config.serviceAccountPath &&
      fs.existsSync(config.serviceAccountPath) &&
      !options.force
    ) {
      console.log(chalk.green('✅ Already authenticated with service account'));

      if (config.defaultProject) {
        console.log(
          chalk.gray(`   └── Default project: ${config.defaultProject}`)
        );
      }

      isReauthenticate = await promptReauthenticateLogin();

      if (!isReauthenticate) {
        console.log(chalk.blue('\n💡 Available options:'));
        console.log(chalk.gray('   • Use --force to re-authenticate'));
        console.log(
          chalk.gray('   • Use "firebase-tools-cli projects" to change project')
        );
        console.log(
          chalk.gray(
            '   • Use "firebase-tools-cli reset" to clear configuration'
          )
        );
        return;
      }
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
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(chalk.red('❌ Authentication failed:'), errorMessage);
    process.exit(1);
  }
};

export {
  loginAction,
  authenticateWithOAuth,
  refreshTokenIfNeeded,
  promptAuthenticationMethod,
  promptServiceAccountFile,
  loadCredentials,
};
