import { Command } from "commander";
import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import chalk from "chalk";
import { OAuth2Client } from "google-auth-library";
import express from "express";
import open from "open";
import inquirer from "inquirer";
import packageJson from "../package.json";
import firestoreCommand from "./commands/firestore";
import rtdbCommand from "./commands/rtdb";
import docsCommand from "./commands/docs";
import remoteConfigCommand from "./commands/remote-config";
import authCommand from "./commands/auth";
import {
  CONFIG_DIR,
  CONFIG_FILE,
  CREDENTIALS_FILE,
  OAUTH_CONFIG,
} from "./constants";

const PROGRAM_NAME = packageJson.name;
const PROGRAM_DESCRIPTION = packageJson.description;
const PROGRAM_VERSION = packageJson.version;

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
      return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    } catch (error) {
      console.warn(chalk.yellow("⚠️  Could not load config file"));
      return {};
    }
  }
  return {};
}

// Save credentials
function saveCredentials(credentials: any) {
  ensureConfigDir();
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2));
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
        const { tokens } = await oauth2Client.getToken(code as string);

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
        const errorMessage = err instanceof Error ? err.message : String(err);

        console.error("Token exchange error:", err);
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
    server.on("error", (err: any) => {
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
async function refreshTokenIfNeeded(credentials: any) {
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
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.warn(chalk.yellow("⚠️  Could not refresh token:"), errorMessage);
      console.log(chalk.blue("Re-authentication required..."));
      throw error;
    }
  }

  return credentials;
}

// FIXED: Better project listing with proper API endpoint
async function listUserProjects(credentials: any) {
  try {
    const oauth2Client = new OAuth2Client();
    oauth2Client.setCredentials({
      access_token: credentials.access_token,
      token_type: credentials.token_type,
    });

    console.log(
      chalk.gray("Fetching projects from Firebase Management API...")
    );

    // FIXED: Use Firebase Management API instead of Cloud Resource Manager
    try {
      // First try Firebase Management API
      const firebaseResponse = await oauth2Client.request<{
        results: {
          projectId: string;
          displayName: string;
          state: string;
        }[];
      }>({
        url: "https://firebase.googleapis.com/v1beta1/projects",
        method: "GET",
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
          lifecycleState: project.state || "ACTIVE",
        }));
      }
    } catch (firebaseError) {
      console.log(
        chalk.yellow(
          "⚠️  Firebase Management API not accessible, trying Cloud Resource Manager..."
        )
      );
    }

    // Fallback to Cloud Resource Manager API
    const response = await oauth2Client.request<{
      projects: {
        lifecycleState: string;
      }[];
    }>({
      url: "https://cloudresourcemanager.googleapis.com/v1/projects",
      method: "GET",
    });

    if (response.data && response.data.projects) {
      console.log(
        chalk.green(
          `✅ Found ${response.data.projects.length} Google Cloud projects`
        )
      );
      return response.data.projects.filter(
        (project) => project.lifecycleState === "ACTIVE"
      );
    }

    return [];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(chalk.yellow("⚠️  Could not fetch projects:"), errorMessage);

    if (errorMessage.includes("403")) {
      console.log(
        chalk.yellow(
          "💡 This might be a permissions issue. Make sure your Google account has access to Firebase/Cloud projects."
        )
      );
    }

    return [];
  }
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

// FIXED: Better Firebase initialization with proper credential handling
async function initializeFirebase(options: any) {
  try {
    let credential;
    let projectId = options.project;

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

      const serviceAccount = require(path.resolve(options.serviceAccount));
      credential = admin.credential.cert(serviceAccount);
      projectId = serviceAccount.project_id || projectId;

      console.log(chalk.blue(`🔑 Using service account authentication`));
      console.log(chalk.gray(`   └── Project: ${projectId}`));
    }
    // Method 2: Check for existing credentials or prompt for authentication method
    else {
      console.log(chalk.blue("🔐 Checking authentication..."));

      let credentials = loadCredentials();
      const config = loadConfig();

      // If no credentials or project not set, prompt for authentication method
      if (!credentials || (!projectId && !config.defaultProject)) {
        console.log(chalk.yellow("🔐 Authentication required\n"));

        // Prompt user to choose authentication method
        const authMethod = await promptAuthenticationMethod();

        if (authMethod === "service-account") {
          // Service account flow
          console.log(chalk.blue("\n🔑 Service Account Authentication"));
          const serviceAccountPath = await promptServiceAccountFile();

          const serviceAccount = require(path.resolve(serviceAccountPath));
          credential = admin.credential.cert(serviceAccount);
          projectId = serviceAccount.project_id || projectId;

          console.log(chalk.green("✅ Service account loaded successfully!"));
          console.log(chalk.gray(`   └── Project: ${projectId}\n`));

          // Ask if user wants to set as default project
          if (!config.defaultProject) {
            const { setDefault } = await inquirer.prompt([
              {
                type: "confirm",
                name: "setDefault",
                message: "Set this project as default?",
                default: true,
              },
            ]);

            if (setDefault) {
              saveConfig({ ...config, defaultProject: projectId });
              console.log(
                chalk.green(`✅ ${projectId} set as default project`)
              );
            }
          }
        } else {
          // OAuth flow (existing implementation)
          credentials = await authenticateWithOAuth();
          console.log(chalk.green("✅ Authentication successful!\n"));

          // Get user's projects if no project specified
          if (!projectId) {
            console.log(chalk.blue("📋 Fetching your projects..."));
            const projects = await listUserProjects(credentials);

            if (projects.length === 0) {
              console.error(chalk.red("❌ No accessible projects found"));
              console.log(chalk.yellow("💡 Troubleshooting:"));
              console.log(
                chalk.gray(
                  "   • Make sure you have access to Firebase/Google Cloud projects"
                )
              );
              console.log(
                chalk.gray(
                  "   • Try using a service account instead: --service-account path/to/key.json"
                )
              );
              console.log(
                chalk.gray(
                  "   • Check if your Google account permissions are correct"
                )
              );
              process.exit(1);
            }

            // Let user select project
            const choices = projects.map((p: any) => ({
              name: `${p.name} (${p.projectId})`,
              value: p.projectId,
              short: p.projectId,
            }));

            const { selectedProject } = await inquirer.prompt([
              {
                type: "list",
                name: "selectedProject",
                message: "Select a project:",
                choices: choices,
                pageSize: 10,
              },
            ]);

            projectId = selectedProject;

            // Ask if user wants to set as default
            const { setDefault } = await inquirer.prompt([
              {
                type: "confirm",
                name: "setDefault",
                message: "Set this project as default?",
                default: true,
              },
            ]);

            if (setDefault) {
              saveConfig({ ...config, defaultProject: projectId });
              console.log(
                chalk.green(`✅ ${projectId} set as default project`)
              );
            }
          }
        }
      } else {
        // Use existing credentials and project (OAuth flow)
        projectId = projectId || config.defaultProject;

        if (!projectId) {
          console.error(chalk.red("❌ No project specified"));
          console.log(
            chalk.yellow("💡 Use --project flag or run: firestore-cli login")
          );
          process.exit(1);
        }

        // Refresh token if needed
        try {
          credentials = await refreshTokenIfNeeded(credentials);
        } catch (error) {
          console.log(chalk.yellow("🔐 Re-authentication required"));
          credentials = await authenticateWithOAuth();
          console.log(chalk.green("✅ Re-authentication successful!\n"));
        }
      }

      // Only set up OAuth credential if we're using OAuth (not service account)
      if (!credential) {
        // FIXED: Create credential using access token instead of refresh token
        // This is more reliable for the Admin SDK
        const oauth2Client = new OAuth2Client();
        oauth2Client.setCredentials({
          access_token: credentials.access_token,
          token_type: credentials.token_type,
        });

        // Use the oauth2Client directly with Admin SDK
        credential = {
          getAccessToken: async () => {
            const { token } = await oauth2Client.getAccessToken();
            return { access_token: token };
          },
        };

        console.log(chalk.blue(`🔑 Using OAuth2 authentication`));
        console.log(chalk.gray(`   └── Project: ${projectId}`));
      }
    }

    const config: any = {
      credential,
      projectId,
    };

    // Set database URL if provided
    if (options.databaseUrl) {
      config.databaseURL = options.databaseUrl;
    }

    admin.initializeApp(config);
    db = admin.firestore();

    // Test the connection
    try {
      await db.listCollections();
      console.log(chalk.green("🔥 Firebase initialized successfully\n"));
    } catch (testError) {
      if (
        testError instanceof Error &&
        testError.message.includes("PERMISSION_DENIED")
      ) {
        console.error(
          chalk.red("❌ Permission denied - check your project access")
        );
        console.log(chalk.yellow("💡 Make sure:"));
        console.log(
          chalk.gray("   • Your account has Firestore access in this project")
        );
        console.log(chalk.gray("   • The project has Firestore enabled"));
        console.log(chalk.gray("   • You're using the correct project ID"));
      } else {
        console.error(
          chalk.red("❌ Firebase connection test failed:"),
          testError instanceof Error ? testError.message : String(testError)
        );
      }
      throw testError;
    }

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red("❌ Failed to initialize Firebase:"), errorMessage);

    if (errorMessage.includes("auth") || errorMessage.includes("credential")) {
      console.log(chalk.yellow("\n💡 Authentication troubleshooting:"));
      console.log(chalk.gray("   • Try: firestore-cli login --force"));
      console.log(chalk.gray("   • Check your Google account permissions"));
      console.log(chalk.gray("   • Verify project access rights"));
      console.log(chalk.gray("   • Consider using a service account instead"));
    }

    process.exit(1);
  }
}

// Add this helper function after the existing prompt functions (around line 400)
async function promptDatabaseUrl() {
  const { databaseUrl } = await inquirer.prompt([
    {
      type: "input",
      name: "databaseUrl",
      message: "Enter Firebase Realtime Database URL:",
      validate: (input) => {
        console.log("input", input);
        if (!input.trim()) {
          return "Please enter a valid database URL";
        }

        // Basic validation for Firebase RTDB URL format
        const urlPattern = /^https:\/\/.*\.firebasedatabase\.app\/?$/;
        if (!urlPattern.test(input.trim())) {
          return "Please enter a valid Firebase Realtime Database URL (e.g., https://your-project-default-rtdb.firebaseio.com/)";
        }

        return true;
      },
      filter: (input) => input.trim().replace(/\/$/, ""), // Remove trailing slash
    },
  ]);

  return databaseUrl;
}

// Global options for authentication and project
program
  // .option("-s, --service-account <path>", "Path to service account JSON file")
  // .option("-p, --project <id>", "Google Cloud Project ID (overrides default)")
  // .option("-d, --database-url <url>", "Firebase Realtime Database URL")
  // .option(
  //   "--database-id <id>",
  //   "Firestore database ID (for multi-database projects)",
  //   "(default)"
  // )
  .hook("preAction", async (thisCommand) => {
    // Skip authentication for commands that don't need it
    const commandName = thisCommand.args[0];
    const skipAuthCommands = ["reset", "logout", "login", "docs", "convert"];

    if (skipAuthCommands.includes(commandName)) {
      return; // Skip authentication for these commands
    }

    const opts = thisCommand.opts();

    // For RTDB commands, we might need to prompt for database URL
    if (commandName.startsWith("rtdb:") && !opts.databaseUrl) {
      console.log(
        chalk.yellow("🔗 Realtime Database URL required for RTDB commands\n")
      );
      opts.databaseUrl = await promptDatabaseUrl();
      console.log(chalk.blue(`🔗 Using database: ${opts.databaseUrl}\n`));
    }

    await initializeFirebase(opts);
  });

program.addCommand(docsCommand);

program.addCommand(firestoreCommand.exportCommand);

program.addCommand(firestoreCommand.importCommand);

program.addCommand(firestoreCommand.listCommand);

program.addCommand(firestoreCommand.queryCommand);

program.addCommand(rtdbCommand.exportCommand);

// // TODO: RTDB import command
// program
// .command("rtdb:import")
// .description("Import data to Realtime Database from JSON file")
// .argument("<file>", "JSON file to import")
// .option("-b, --batch-size <size>", "Batch size for imports", "500")
// .option("-m, --merge", "Merge documents instead of overwriting");

// Update the RTDB list command to use the new function
// program
//   .command("rtdb:list")
//   .description("List all top-level nodes and their basic info")
//   .option("--json", "Output results as JSON")
//   .option("--output <file>", "Save JSON output to file (use with --json)")
//   .action(async (options) => {
//     try {
//       await listRealtimeDatabase(options);
//     } catch (error) {
//       process.exit(1);
//     } finally {
//       await admin.app().delete();
//     }
//   });
program.addCommand(rtdbCommand.listCommand);

// TODO: RTDB query command
// program
// .command("rtdb:query")
// .description("Query a specific database")
// .argument("<database>", "Database name to query")
// .option(
//   "-w, --where <field,operator,value>",
//   'Where clause (e.g., "age,>=,18")'
// )
// .option("-l, --limit <number>", "Limit number of results")
// .option(
//   "-o, --order-by <field,direction>",
//   'Order by field (e.g., "name,asc")'
// )
// .option("--json", "Output results as JSON")
// .option("--output <file>", "Save JSON output to file (use with --json)");

program.addCommand(authCommand.loginCommand);

program.addCommand(authCommand.projectsCommand);

program.addCommand(authCommand.resetCommand);

program.addCommand(remoteConfigCommand.convertCommand);

// Parse arguments
program.parse();
