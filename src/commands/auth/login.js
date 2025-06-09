const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const inquirer = require("inquirer");
const { OAuth2Client } = require("google-auth-library");
const open = require("open");
const express = require("express");
const { listUserProjects } = require("./projects.js");

const CONFIG_DIR = path.join(require("os").homedir(), ".firestore-cli");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const CREDENTIALS_FILE = path.join(CONFIG_DIR, "credentials.json");

// OAuth2 configuration - FIXED SCOPES
const OAUTH_CONFIG = {
  clientId: "work-in-progress",
  clientSecret: "work-in-progress",
  redirectUri: "http://localhost:8080/oauth2callback",
  scopes: [
    "https://www.googleapis.com/auth/firebase",
    "https://www.googleapis.com/auth/firebase.database",
    "https://www.googleapis.com/auth/datastore",
    "https://www.googleapis.com/auth/cloud-platform.read-only",
  ],
};

// Ensure config directory exists
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

// Save configuration
function saveConfig(config) {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// Load configuration
function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    } catch (error) {
      console.warn(chalk.yellow("⚠️  Could not load config file"));
      return {};
    }
  }
  return {};
}

// Save credentials
function saveCredentials(credentials) {
  ensureConfigDir();
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2));
}

// FIXED: Better OAuth2 authentication flow with proper error handling
async function authenticateWithOAuth() {
  return new Promise((resolve, reject) => {
    const oauth2Client = new OAuth2Client(
      OAUTH_CONFIG.clientId,
      OAUTH_CONFIG.clientSecret,
      OAUTH_CONFIG.redirectUri
    );

    // Generate the url that will be used for the consent dialog
    const authorizeUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: OAUTH_CONFIG.scopes,
      prompt: "consent",
      include_granted_scopes: true, // ADDED: Include previously granted scopes
    });

    console.log(chalk.blue("🔐 Starting OAuth2 authentication...\n"));
    console.log(chalk.gray("Opening browser for Google authentication..."));
    console.log(
      chalk.yellow(
        "Note: You may need to verify your app with Google if this is your first time."
      )
    );

    // Create temporary server to handle callback
    const app = express();
    const server = app.listen(8080, () => {
      console.log(chalk.gray("Local server started on port 8080"));
    });

    // IMPROVED: Better error handling in callback
    app.get("/oauth2callback", async (req, res) => {
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
        if (error === "access_denied") {
          console.log(chalk.yellow("\n💡 Troubleshooting:"));
          console.log(
            chalk.gray("   • Make sure you granted all required permissions")
          );
          console.log(
            chalk.gray(
              "   • Check if your Google account has access to Firebase projects"
            )
          );
        }

        reject(new Error(`OAuth error: ${error} - ${errorMsg}`));
        return;
      }

      if (!code) {
        res.send(`<h1>❌ No authorization code received</h1>`);
        server.close();
        reject(new Error("No authorization code received"));
        return;
      }

      try {
        // Exchange code for tokens
        const { tokens } = await oauth2Client.getToken(code);

        // IMPROVED: Better token validation
        if (!tokens.access_token) {
          throw new Error("No access token received");
        }

        // Save credentials with better structure
        const credentials = {
          type: "oauth2",
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expiry_date: tokens.expiry_date,
          token_type: tokens.token_type || "Bearer",
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
        console.error("Token exchange error:", err);
        res.send(`
            <h1>❌ Authentication Failed</h1>
            <p><strong>Error:</strong> ${err.message}</p>
            <p>Please check the console for more details.</p>
          `);
        server.close();
        reject(err);
      }
    });

    // Handle server startup errors
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(chalk.red("❌ Port 8080 is already in use"));
        console.log(
          chalk.yellow(
            "Please close any applications using port 8080 and try again"
          )
        );
      } else {
        console.error(chalk.red("❌ Server error:"), err.message);
      }
      reject(err);
    });

    // Add timeout for the authentication process
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error("Authentication timeout - please try again"));
    }, 300000); // 5 minutes timeout

    server.on("close", () => {
      clearTimeout(timeout);
    });

    // Open browser
    open(authorizeUrl).catch(() => {
      console.log(chalk.yellow("\n⚠️  Could not open browser automatically"));
      console.log(chalk.blue("Please visit this URL to authenticate:"));
      console.log(chalk.cyan(authorizeUrl));
    });
  });
}

// FIXED: Better token refresh logic
async function refreshTokenIfNeeded(credentials) {
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
    console.log(chalk.blue("🔄 Refreshing expired token..."));

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
      console.log(chalk.green("✅ Token refreshed successfully"));
      return updatedCredentials;
    } catch (error) {
      console.warn(chalk.yellow("⚠️  Could not refresh token:"), error.message);
      console.log(chalk.blue("Re-authentication required..."));
      throw error;
    }
  }

  return credentials;
}

// Add this new function after the existing authentication functions
async function promptAuthenticationMethod() {
  const { authMethod } = await inquirer.prompt([
    {
      type: "list",
      name: "authMethod",
      message: "Choose authentication method:",
      choices: [
        {
          name: chalk.dim(
            "🔐 OAuth (Google Account) - Interactive browser authentication"
          ),
          value: "oauth",
          short: "OAuth",
          disabled: chalk.dim("Work in Progress"),
        },
        {
          name: "🔑 Service Account - JSON key file authentication",
          value: "service-account",
          short: "Service Account",
        },
      ],
      default: "oauth",
    },
  ]);

  return authMethod;
}

// Add this helper function to prompt for service account file
async function promptServiceAccountFile() {
  const { serviceAccountPath } = await inquirer.prompt([
    {
      type: "input",
      name: "serviceAccountPath",
      message: "Enter path to service account JSON file:",
      validate: (input) => {
        if (!input.trim()) {
          return "Please enter a valid file path";
        }
        if (!fs.existsSync(input.trim())) {
          return `File not found: ${input.trim()}`;
        }
        try {
          const content = JSON.parse(fs.readFileSync(input.trim(), "utf8"));
          if (!content.type || content.type !== "service_account") {
            return "Invalid service account file format";
          }
          return true;
        } catch (error) {
          return "Invalid JSON file";
        }
      },
      filter: (input) => input.trim(),
    },
  ]);

  return serviceAccountPath;
}

// Load credentials
function loadCredentials() {
  if (fs.existsSync(CREDENTIALS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CREDENTIALS_FILE, "utf8"));
    } catch (error) {
      console.warn(chalk.yellow("⚠️  Could not load credentials file"));
      return null;
    }
  }
  return null;
}

module.exports = {
  authenticateWithOAuth,
  refreshTokenIfNeeded,
  listUserProjects,
  promptAuthenticationMethod,
  promptServiceAccountFile,
  loadCredentials,
  loadConfig,
  saveConfig,
};
