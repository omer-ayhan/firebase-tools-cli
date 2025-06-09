#!/usr/bin/env node

const { Command } = require("commander");
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const { OAuth2Client } = require("google-auth-library");
const express = require("express");
const open = require("open");
const inquirer = require("inquirer");
const documentation = require("./docs.js");
const packageJson = require("./package.json");
const firestoreCommand = require("./commands/firestore");
const rtdbCommand = require("./commands/rtdb");
const docsCommand = require("./commands/docs");
const remoteConfigCommand = require("./commands/remote-config");
const authCommand = require("./commands/auth");

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

// FIXED: Better project listing with proper API endpoint
async function listUserProjects(credentials) {
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
      const firebaseResponse = await oauth2Client.request({
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
    const response = await oauth2Client.request({
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
    console.warn(chalk.yellow("⚠️  Could not fetch projects:"), error.message);

    if (error.message.includes("403")) {
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
async function initializeFirebase(options) {
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
            const choices = projects.map((p) => ({
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

    const config = {
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
      if (testError.message.includes("PERMISSION_DENIED")) {
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
          testError.message
        );
      }
      throw testError;
    }

    return true;
  } catch (error) {
    console.error(
      chalk.red("❌ Failed to initialize Firebase:"),
      error.message
    );

    if (
      error.message.includes("auth") ||
      error.message.includes("credential")
    ) {
      console.log(chalk.yellow("\n💡 Authentication troubleshooting:"));
      console.log(chalk.gray("   • Try: firestore-cli login --force"));
      console.log(chalk.gray("   • Check your Google account permissions"));
      console.log(chalk.gray("   • Verify project access rights"));
      console.log(chalk.gray("   • Consider using a service account instead"));
    }

    process.exit(1);
  }
}

// Export command - read all collections
// async function exportCollections(options) {
//   try {
//     console.log(chalk.blue("🔍 Starting Firestore export...\n"));

//     const collections = await db.listCollections();
//     console.log(
//       chalk.cyan(`📁 Found ${collections.length} top-level collections\n`)
//     );

//     const allData = {};
//     const importData = {};
//     let totalDocsRead = 0;
//     let totalSubDocsRead = 0;

//     for (const collection of collections) {
//       const collectionName = collection.id;

//       // Skip collections if specified
//       if (options.exclude && options.exclude.includes(collectionName)) {
//         console.log(
//           chalk.yellow(`⏭️  Skipping excluded collection: ${collectionName}`)
//         );
//         continue;
//       }

//       console.log(chalk.blue(`📖 Reading collection: ${collectionName}`));

//       try {
//         const snapshot = await collection.get();
//         const documents = [];
//         let collectionDocsRead = 0;
//         let collectionSubDocsRead = 0;

//         console.log(chalk.gray(`   └── Documents found: ${snapshot.size}`));

//         // For importable format
//         importData[collectionName] = {};

//         // Create loading indicator
//         let loadingDots = 0;
//         const loadingInterval = setInterval(() => {
//           const dots = ".".repeat((loadingDots % 3) + 1);
//           process.stdout.write(
//             `\r${chalk.gray(`       └── Processing${dots}   `)}`
//           );
//           loadingDots++;
//         }, 300);

//         for (const doc of snapshot.docs) {
//           const docData = {
//             id: doc.id,
//             data: doc.data(),
//             createTime: doc.createTime,
//             updateTime: doc.updateTime,
//           };

//           // Add to importable format
//           importData[collectionName][doc.id] = doc.data();
//           collectionDocsRead++;

//           // Handle subcollections if enabled
//           if (!options.noSubcollections) {
//             const subcollections = await doc.ref.listCollections();
//             if (subcollections.length > 0) {
//               docData.subcollections = {};

//               // Clear loading line and show subcollection info
//               clearInterval(loadingInterval);
//               process.stdout.write("\r" + " ".repeat(50) + "\r"); // Clear the line
//               console.log(
//                 chalk.gray(
//                   `       └── Document ${doc.id} has ${subcollections.length} subcollections`
//                 )
//               );

//               for (const subcol of subcollections) {
//                 const subSnapshot = await subcol.get();
//                 const subDocs = [];

//                 // For importable format
//                 const subCollectionPath = `${collectionName}__${doc.id}__${subcol.id}`;
//                 importData[subCollectionPath] = {};

//                 subSnapshot.forEach((subDoc) => {
//                   const subDocData = {
//                     id: subDoc.id,
//                     data: subDoc.data(),
//                     createTime: subDoc.createTime,
//                     updateTime: subDoc.updateTime,
//                   };
//                   subDocs.push(subDocData);
//                   collectionSubDocsRead++;

//                   // Add to importable format
//                   importData[subCollectionPath][subDoc.id] = subDoc.data();
//                 });

//                 docData.subcollections[subcol.id] = subDocs;
//                 console.log(
//                   chalk.gray(
//                     `           └── Subcollection ${subcol.id}: ${subDocs.length} documents read`
//                   )
//                 );
//               }

//               // Restart loading indicator if there are more documents
//               if (collectionDocsRead < snapshot.size) {
//                 loadingInterval = setInterval(() => {
//                   const dots = ".".repeat((loadingDots % 3) + 1);
//                   process.stdout.write(
//                     `\r${chalk.gray(`       └── Processing${dots}   `)}`
//                   );
//                   loadingDots++;
//                 }, 300);
//               }
//             }
//           }

//           documents.push(docData);
//         }

//         // Clear loading indicator
//         clearInterval(loadingInterval);
//         process.stdout.write("\r" + " ".repeat(50) + "\r"); // Clear the line

//         allData[collectionName] = documents;
//         totalDocsRead += collectionDocsRead;
//         totalSubDocsRead += collectionSubDocsRead;

//         // Show final count for this collection
//         const subCollectionText =
//           collectionSubDocsRead > 0
//             ? chalk.gray(` + ${collectionSubDocsRead} subdocuments`)
//             : "";

//         console.log(
//           chalk.green(
//             `   ✅ Collection ${collectionName} exported: ${collectionDocsRead} documents${subCollectionText}\n`
//           )
//         );
//       } catch (error) {
//         console.error(
//           chalk.red(`   ❌ Error reading collection ${collectionName}:`),
//           error.message
//         );
//         allData[collectionName] = { error: error.message };
//       }
//     }

//     // Generate file names
//     const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
//     const outputDir = options.output || "./";

//     console.log(chalk.blue("💾 Saving export files..."));

//     // Create saving loading indicator
//     let savingDots = 0;
//     const savingInterval = setInterval(() => {
//       const dots = ".".repeat((savingDots % 3) + 1);
//       process.stdout.write(`\r${chalk.gray(`   └── Writing files${dots}   `)}`);
//       savingDots++;
//     }, 200);

//     // Save detailed format
//     if (options.detailed !== false) {
//       const detailedFile = path.join(
//         outputDir,
//         `firestore_detailed_${timestamp}.json`
//       );
//       fs.writeFileSync(detailedFile, JSON.stringify(allData, null, 2));

//       clearInterval(savingInterval);
//       process.stdout.write("\r" + " ".repeat(50) + "\r"); // Clear the line
//       console.log(chalk.green(`📄 Detailed backup saved: ${detailedFile}`));

//       // Restart saving indicator if we have more files to save
//       if (options.importable !== false) {
//         savingInterval = setInterval(() => {
//           const dots = ".".repeat((savingDots % 3) + 1);
//           process.stdout.write(
//             `\r${chalk.gray(`   └── Writing files${dots}   `)}`
//           );
//           savingDots++;
//         }, 200);
//       }
//     }

//     // Save importable format
//     if (options.importable !== false) {
//       const importableFile = path.join(
//         outputDir,
//         `firestore_importable_${timestamp}.json`
//       );
//       fs.writeFileSync(importableFile, JSON.stringify(importData, null, 2));

//       clearInterval(savingInterval);
//       process.stdout.write("\r" + " ".repeat(50) + "\r"); // Clear the line
//       console.log(chalk.green(`📤 Importable backup saved: ${importableFile}`));
//     }

//     // Summary with detailed read counts
//     console.log(chalk.blue("\n📊 Export Summary:"));
//     console.log(
//       chalk.gray(`   └── Collections processed: ${Object.keys(allData).length}`)
//     );
//     console.log(chalk.gray(`   └── Documents read: ${totalDocsRead}`));

//     if (totalSubDocsRead > 0) {
//       console.log(chalk.gray(`   └── Subdocuments read: ${totalSubDocsRead}`));
//       console.log(
//         chalk.gray(
//           `   └── Total documents: ${totalDocsRead + totalSubDocsRead}`
//         )
//       );
//     }

//     // Calculate file sizes
//     if (options.detailed !== false) {
//       const detailedFile = path.join(
//         outputDir,
//         `firestore_detailed_${timestamp}.json`
//       );
//       const detailedSize = (
//         fs.statSync(detailedFile).size /
//         1024 /
//         1024
//       ).toFixed(2);
//       console.log(chalk.gray(`   └── Detailed file size: ${detailedSize} MB`));
//     }

//     if (options.importable !== false) {
//       const importableFile = path.join(
//         outputDir,
//         `firestore_importable_${timestamp}.json`
//       );
//       const importableSize = (
//         fs.statSync(importableFile).size /
//         1024 /
//         1024
//       ).toFixed(2);
//       console.log(
//         chalk.gray(`   └── Importable file size: ${importableSize} MB`)
//       );
//     }

//     console.log(chalk.green("\n🎉 Export completed successfully!"));
//   } catch (error) {
//     console.error(chalk.red("❌ Export failed:"), error.message);
//     throw error;
//   }
// }

// Import command
// async function importCollections(file, options) {
//   try {
//     console.log(chalk.blue(`📥 Starting import from: ${file}\n`));

//     if (!fs.existsSync(file)) {
//       console.error(chalk.red(`❌ Import file not found: ${file}`));
//       process.exit(1);
//     }

//     const rawData = fs.readFileSync(file, "utf8");
//     const importData = JSON.parse(rawData);

//     let totalImported = 0;
//     const batchSize = options.batchSize || 500;

//     for (const [collectionName, documents] of Object.entries(importData)) {
//       // Skip collections if specified
//       if (options.exclude && options.exclude.includes(collectionName)) {
//         console.log(
//           chalk.yellow(`⏭️  Skipping excluded collection: ${collectionName}`)
//         );
//         continue;
//       }

//       console.log(chalk.blue(`📝 Importing collection: ${collectionName}`));

//       // Handle subcollection naming convention
//       if (collectionName.includes("__")) {
//         const parts = collectionName.split("__");
//         const parentCollection = parts[0];
//         const parentDoc = parts[1];
//         const subCollection = parts[2];

//         console.log(
//           chalk.gray(
//             `   └── Subcollection: ${parentCollection}/${parentDoc}/${subCollection}`
//           )
//         );

//         let batch = db.batch(); // Create new batch
//         let batchCount = 0;

//         for (const [docId, docData] of Object.entries(documents)) {
//           const docRef = db
//             .collection(parentCollection)
//             .doc(parentDoc)
//             .collection(subCollection)
//             .doc(docId);

//           if (options.merge) {
//             batch.set(docRef, docData, { merge: true });
//           } else {
//             batch.set(docRef, docData);
//           }

//           batchCount++;

//           if (batchCount >= batchSize) {
//             await batch.commit();
//             totalImported += batchCount;
//             console.log(
//               chalk.gray(`       └── Batch imported: ${batchCount} documents`)
//             );

//             // Create a new batch for the next iteration
//             batch = db.batch();
//             batchCount = 0;
//           }
//         }

//         // Commit any remaining documents in the final batch
//         if (batchCount > 0) {
//           await batch.commit();
//           totalImported += batchCount;
//           console.log(
//             chalk.gray(`       └── Final batch: ${batchCount} documents`)
//           );
//         }
//       } else {
//         // Regular top-level collection
//         let batch = db.batch(); // Create new batch
//         let batchCount = 0;

//         for (const [docId, docData] of Object.entries(documents)) {
//           const docRef = db.collection(collectionName).doc(docId);

//           if (options.merge) {
//             batch.set(docRef, docData, { merge: true });
//           } else {
//             batch.set(docRef, docData);
//           }

//           batchCount++;

//           if (batchCount >= batchSize) {
//             await batch.commit();
//             totalImported += batchCount;
//             console.log(
//               chalk.gray(`   └── Batch imported: ${batchCount} documents`)
//             );

//             // Create a new batch for the next iteration
//             batch = db.batch();
//             batchCount = 0;
//           }
//         }

//         // Commit any remaining documents in the final batch
//         if (batchCount > 0) {
//           await batch.commit();
//           totalImported += batchCount;
//           console.log(
//             chalk.gray(`   └── Final batch: ${batchCount} documents`)
//           );
//         }
//       }

//       console.log(chalk.green(`   ✅ Collection ${collectionName} imported\n`));
//     }

//     console.log(
//       chalk.green(
//         `🎉 Import completed! Total documents imported: ${totalImported}`
//       )
//     );
//   } catch (error) {
//     console.error(chalk.red("❌ Import failed:"), error.message);
//     throw error;
//   }
// }

// List collections command
// async function listCollections() {
//   try {
//     console.log(chalk.blue("📋 Listing all collections...\n"));

//     const collections = await db.listCollections();

//     console.log(chalk.cyan(`Found ${collections.length} collections:\n`));

//     for (const collection of collections) {
//       const snapshot = await collection.get();
//       console.log(chalk.white(`📁 ${collection.id}`));
//       console.log(chalk.gray(`   └── Documents: ${snapshot.size}`));

//       // Sample a few documents to show structure
//       if (snapshot.size > 0) {
//         const firstDoc = snapshot.docs[0];
//         const fields = Object.keys(firstDoc.data());
//         console.log(
//           chalk.gray(
//             `   └── Sample fields: ${fields.slice(0, 5).join(", ")}${
//               fields.length > 5 ? "..." : ""
//             }`
//           )
//         );
//       }
//       console.log("\n");
//     }
//   } catch (error) {
//     console.error(chalk.red("❌ Failed to list collections:"), error.message);
//     throw error;
//   }
// }

// Query command
// async function queryCollection(collectionName, options) {
//   try {
//     console.log(chalk.blue(`🔍 Querying collection: ${collectionName}\n`));

//     let query = db.collection(collectionName);

//     // Apply where clause
//     if (options.where) {
//       const [field, operator, value] = options.where.split(",");
//       query = query.where(field.trim(), operator.trim(), value.trim());
//       console.log(chalk.gray(`   └── Filter: ${field} ${operator} ${value}`));
//     }

//     // Apply limit
//     if (options.limit) {
//       query = query.limit(parseInt(options.limit));
//       console.log(chalk.gray(`   └── Limit: ${options.limit}`));
//     }

//     // Apply ordering
//     if (options.orderBy) {
//       const [field, direction] = options.orderBy.split(",");
//       query = query.orderBy(field.trim(), direction?.trim() || "asc");
//       console.log(chalk.gray(`   └── Order: ${field} ${direction || "asc"}`));
//     }

//     const snapshot = await query.get();
//     console.log(chalk.cyan(`\n📊 Found ${snapshot.size} documents:\n`));

//     // Collect results for JSON output
//     const results = [];

//     snapshot.forEach((doc, index) => {
//       const docData = {
//         id: doc.id,
//         data: doc.data(),
//         createTime: doc.createTime,
//         updateTime: doc.updateTime,
//       };

//       results.push(docData);

//       // Only show console output if not JSON mode
//       if (!options.json) {
//         console.log(chalk.white(`${index + 1}. Document ID: ${doc.id}`));
//         const fields = Object.keys(doc.data());
//         console.log(chalk.gray(`   Fields: ${fields.join(", ")}`));
//         console.log();
//       }
//     });

//     // Handle JSON output
//     if (options.json) {
//       const output = {
//         collection: collectionName,
//         query: {
//           ...(options.where && { where: options.where }),
//           ...(options.limit && { limit: parseInt(options.limit) }),
//           ...(options.orderBy && { orderBy: options.orderBy }),
//         },
//         totalDocuments: snapshot.size,
//         results: results,
//         timestamp: new Date().toISOString(),
//       };

//       if (options.output) {
//         // Save to file
//         const outputFile = options.output.endsWith(".json")
//           ? options.output
//           : `${options.output}/query_${collectionName}_${Date.now()}.json`;

//         fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
//         console.log(chalk.green(`📄 Query results saved to: ${outputFile}`));
//       } else {
//         // Output to console
//         console.log(JSON.stringify(output, null, 2));
//       }
//     }
//   } catch (error) {
//     console.error(chalk.red("❌ Query failed:"), error.message);
//     throw error;
//   }
// }

// // Convert JSON to Remote Config format
// async function convertToRemoteConfig(inputFile, options) {
//   try {
//     console.log(
//       chalk.blue(`🔄 Converting JSON to Remote Config format: ${inputFile}\n`)
//     );

//     if (!fs.existsSync(inputFile)) {
//       console.error(chalk.red(`❌ Input file not found: ${inputFile}`));
//       process.exit(1);
//     }

//     const rawData = fs.readFileSync(inputFile, "utf8");
//     let inputData;

//     try {
//       inputData = JSON.parse(rawData);
//     } catch (error) {
//       console.error(chalk.red("❌ Invalid JSON file:"), error.message);
//       process.exit(1);
//     }

//     // Create Remote Config structure
//     const remoteConfig = {
//       conditions: options.conditions || [],
//       parameters: {},
//       version: {
//         versionNumber: options.versionNumber || "1",
//         updateTime: new Date().toISOString(),
//         updateUser: {
//           email: options.userEmail || "firestore-cli@example.com",
//         },
//         updateOrigin: "CONSOLE",
//         updateType: "INCREMENTAL_UPDATE",
//       },
//     };

//     // Convert input data to parameters
//     console.log(chalk.blue("📝 Converting parameters..."));
//     let parameterCount = 0;

//     for (const [key, value] of Object.entries(inputData)) {
//       // Skip metadata fields
//       if (key === "conditions" || key === "version") {
//         continue;
//       }

//       const parameter = {
//         defaultValue: {},
//         valueType: determineValueType(value),
//       };

//       // Set the default value based on type
//       if (typeof value === "object" && value !== null) {
//         parameter.defaultValue.value = JSON.stringify(value);
//         parameter.valueType = "JSON";
//       } else if (typeof value === "boolean") {
//         parameter.defaultValue.value = value.toString();
//         parameter.valueType = "BOOLEAN";
//       } else if (typeof value === "number") {
//         parameter.defaultValue.value = value.toString();
//         parameter.valueType = "NUMBER";
//       } else {
//         parameter.defaultValue.value = value.toString();
//         parameter.valueType = "STRING";
//       }

//       // Add description if provided in options
//       if (options.description) {
//         parameter.description = `${options.description} - ${key}`;
//       }

//       // Add conditional values if specified
//       if (options.conditionalValues && options.conditionalValues[key]) {
//         parameter.conditionalValues = options.conditionalValues[key];
//       }

//       remoteConfig.parameters[key] = parameter;
//       parameterCount++;

//       console.log(chalk.gray(`   └── ${key}: ${parameter.valueType}`));
//     }

//     // Add conditions if provided
//     if (options.addConditions) {
//       remoteConfig.conditions = [
//         {
//           name: "iOS",
//           expression: "app.id == 'your.ios.app.id'",
//           tagColor: "PINK",
//         },
//         {
//           name: "Android",
//           expression: "app.id == 'your.android.app.id'",
//           tagColor: "GREEN",
//         },
//       ];
//       console.log(
//         chalk.gray(
//           `   └── Added ${remoteConfig.conditions.length} default conditions`
//         )
//       );
//     }

//     // Generate output filename
//     const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
//     const outputFile = options.output || `remote_config_${timestamp}.json`;

//     // Save the converted file
//     fs.writeFileSync(outputFile, JSON.stringify(remoteConfig, null, 2));

//     console.log(chalk.green(`\n✅ Conversion completed successfully!`));
//     console.log(chalk.gray(`   └── Parameters converted: ${parameterCount}`));
//     console.log(
//       chalk.gray(`   └── Conditions added: ${remoteConfig.conditions.length}`)
//     );
//     console.log(chalk.green(`📄 Remote Config saved to: ${outputFile}`));

//     // Show file size
//     const fileSize = (fs.statSync(outputFile).size / 1024).toFixed(2);
//     console.log(chalk.gray(`   └── File size: ${fileSize} KB`));

//     // Show usage instructions
//     console.log(chalk.blue("\n💡 Next steps:"));
//     console.log(chalk.gray("   1. Review the generated Remote Config file"));
//     console.log(chalk.gray("   2. Update app IDs in conditions if needed"));
//     console.log(
//       chalk.gray("   3. Upload to Firebase Console or use Firebase CLI")
//     );
//     console.log(chalk.gray("   4. Test with your app before publishing"));
//   } catch (error) {
//     console.error(chalk.red("❌ Conversion failed:"), error.message);
//     throw error;
//   }
// }

// // Helper function to determine value type
// function determineValueType(value) {
//   if (typeof value === "boolean") {
//     return "BOOLEAN";
//   } else if (typeof value === "number") {
//     return "NUMBER";
//   } else if (typeof value === "object" && value !== null) {
//     return "JSON";
//   } else {
//     return "STRING";
//   }
// }

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

// Update the exportRealtimeDatabase function to properly handle database URL
// async function exportRealtimeDatabase(options) {
//   try {
//     console.log(chalk.blue("🔍 Starting Realtime Database export...\n"));

//     // Get the database reference (should be configured during initialization)
//     const rtdb = admin.database();

//     console.log(chalk.cyan("📁 Fetching all data from Realtime Database\n"));

//     // Get the root reference and fetch all data
//     const snapshot = await rtdb.ref("/").once("value");
//     let allData = snapshot.val();

//     if (!allData) {
//       console.log(chalk.yellow("⚠️  No data found in Realtime Database"));
//       return;
//     }

//     // Handle exclusions
//     if (options.exclude && Array.isArray(options.exclude)) {
//       console.log(
//         chalk.yellow(`⏭️  Excluding paths: ${options.exclude.join(", ")}`)
//       );
//       for (const excludePath of options.exclude) {
//         if (allData[excludePath]) {
//           delete allData[excludePath];
//           console.log(chalk.gray(`   └── Excluded: ${excludePath}`));
//         }
//       }
//     }

//     // Handle no-subcollections (flatten to top level only)
//     if (options.subcollections === false) {
//       console.log(chalk.yellow("📏 Limiting export to top-level data only"));
//       const topLevelData = {};
//       for (const [key, value] of Object.entries(allData)) {
//         // Only include primitive values or convert objects to string representation
//         if (typeof value === "object" && value !== null) {
//           topLevelData[key] = `[Object with ${Object.keys(value).length} keys]`;
//         } else {
//           topLevelData[key] = value;
//         }
//       }
//       allData = topLevelData;
//     }

//     // Generate file names
//     const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
//     const outputDir = options.output || "./";

//     console.log(chalk.blue("💾 Saving export files..."));

//     // Create saving loading indicator
//     let savingDots = 0;
//     let savingInterval = setInterval(() => {
//       const dots = ".".repeat((savingDots % 3) + 1);
//       process.stdout.write(`\r${chalk.gray(`   └── Writing files${dots}   `)}`);
//       savingDots++;
//     }, 200);

//     let filesCreated = 0;

//     // Save detailed format (includes metadata)
//     if (options.detailed !== false) {
//       const detailedData = {
//         exportInfo: {
//           timestamp: new Date().toISOString(),
//           source: "Firebase Realtime Database",
//           databaseUrl: admin.app().options.databaseURL,
//           exportedBy: "firestore-cli",
//           totalNodes: countNodes(allData),
//         },
//         data: allData,
//       };

//       const detailedFile = path.join(
//         outputDir,
//         `rtdb_detailed_${timestamp}.json`
//       );
//       fs.writeFileSync(detailedFile, JSON.stringify(detailedData, null, 2));
//       filesCreated++;

//       clearInterval(savingInterval);
//       process.stdout.write("\r" + " ".repeat(50) + "\r"); // Clear the line
//       console.log(chalk.green(`📄 Detailed backup saved: ${detailedFile}`));

//       // Restart saving indicator if we have more files to save
//       if (options.importable !== false) {
//         savingInterval = setInterval(() => {
//           const dots = ".".repeat((savingDots % 3) + 1);
//           process.stdout.write(
//             `\r${chalk.gray(`   └── Writing files${dots}   `)}`
//           );
//           savingDots++;
//         }, 200);
//       }
//     }

//     // Save importable format (clean data only)
//     if (options.importable !== false) {
//       const importableFile = path.join(
//         outputDir,
//         `rtdb_importable_${timestamp}.json`
//       );
//       fs.writeFileSync(importableFile, JSON.stringify(allData, null, 2));
//       filesCreated++;

//       clearInterval(savingInterval);
//       process.stdout.write("\r" + " ".repeat(50) + "\r"); // Clear the line
//       console.log(chalk.green(`📤 Importable backup saved: ${importableFile}`));
//     }

//     // Summary
//     console.log(chalk.blue("\n📊 Export Summary:"));
//     console.log(
//       chalk.gray(`   └── Database: ${admin.app().options.databaseURL}`)
//     );
//     console.log(
//       chalk.gray(`   └── Total nodes exported: ${countNodes(allData)}`)
//     );
//     console.log(chalk.gray(`   └── Files created: ${filesCreated}`));

//     // Calculate file sizes
//     if (options.detailed !== false) {
//       const detailedFile = path.join(
//         outputDir,
//         `rtdb_detailed_${timestamp}.json`
//       );
//       const detailedSize = (
//         fs.statSync(detailedFile).size /
//         1024 /
//         1024
//       ).toFixed(2);
//       console.log(chalk.gray(`   └── Detailed file size: ${detailedSize} MB`));
//     }

//     if (options.importable !== false) {
//       const importableFile = path.join(
//         outputDir,
//         `rtdb_importable_${timestamp}.json`
//       );
//       const importableSize = (
//         fs.statSync(importableFile).size /
//         1024 /
//         1024
//       ).toFixed(2);
//       console.log(
//         chalk.gray(`   └── Importable file size: ${importableSize} MB`)
//       );
//     }

//     console.log(
//       chalk.green("\n🎉 Realtime Database export completed successfully!")
//     );
//   } catch (error) {
//     console.error(chalk.red("❌ RTDB Export failed:"), error.message);

//     if (error.message.includes("PERMISSION_DENIED")) {
//       console.log(chalk.yellow("💡 Make sure:"));
//       console.log(chalk.gray("   • Your account has Realtime Database access"));
//       console.log(chalk.gray("   • The database exists and has data"));
//       console.log(chalk.gray("   • Database rules allow read access"));
//     } else if (error.message.includes("Database URL")) {
//       console.log(chalk.yellow("💡 Database URL troubleshooting:"));
//       console.log(chalk.gray("   • Use --database-url flag"));
//       console.log(
//         chalk.gray(
//           "   • Check the URL format (should end with .firebasedatabase.app)"
//         )
//       );
//       console.log(
//         chalk.gray("   • Verify the database exists in your project")
//       );
//     }

//     throw error;
//   }
// }

// Helper function to count nodes in RTDB data
// function countNodes(data, count = 0) {
//   if (data === null || data === undefined) {
//     return count;
//   }

//   if (typeof data === "object") {
//     count++; // Count this object
//     for (const key in data) {
//       count = countNodes(data[key], count);
//     }
//   } else {
//     count++; // Count primitive values
//   }

//   return count;
// }

// Update the listRealtimeDatabase function to handle JSON and output options independently
// async function listRealtimeDatabase(options) {
//   try {
//     console.log(chalk.blue("📋 Listing Realtime Database structure...\n"));

//     // Get the database reference
//     const rtdb = admin.database();

//     // Get the root reference and fetch all data
//     const snapshot = await rtdb.ref("/").once("value");
//     const allData = snapshot.val();

//     if (!allData) {
//       console.log(chalk.yellow("⚠️  No data found in Realtime Database"));
//       return;
//     }

//     // Prepare data for JSON output
//     const results = [];

//     for (const [key, value] of Object.entries(allData)) {
//       const nodeInfo = {
//         name: key,
//         type:
//           typeof value === "object" && value !== null ? "object" : typeof value,
//       };

//       if (typeof value === "object" && value !== null) {
//         nodeInfo.childCount = Object.keys(value).length;
//         nodeInfo.sampleKeys = Object.keys(value).slice(0, 3);
//         if (Object.keys(value).length > 3) {
//           nodeInfo.hasMoreKeys = true;
//         }
//       } else {
//         nodeInfo.value = String(value).substring(0, 50);
//         if (String(value).length > 50) {
//           nodeInfo.truncated = true;
//         }
//       }

//       results.push(nodeInfo);

//       // Only show console output if not JSON mode
//       if (!options.json) {
//         console.log(chalk.white(`📁 ${key}`));

//         if (typeof value === "object" && value !== null) {
//           const childCount = Object.keys(value).length;
//           console.log(chalk.gray(`   └── Children: ${childCount}`));

//           // Show sample child keys (first 3)
//           const childKeys = Object.keys(value).slice(0, 3);
//           if (childKeys.length > 0) {
//             const sampleText =
//               childKeys.join(", ") +
//               (Object.keys(value).length > 3 ? "..." : "");
//             console.log(chalk.gray(`   └── Sample keys: ${sampleText}`));
//           }
//         } else {
//           console.log(chalk.gray(`   └── Type: ${typeof value}`));
//           console.log(
//             chalk.gray(
//               `   └── Value: ${String(value).substring(0, 50)}${
//                 String(value).length > 50 ? "..." : ""
//               }`
//             )
//           );
//         }
//         console.log();
//       }
//     }

//     // Prepare output data (used for both JSON and file output)
//     const outputData = {
//       database: admin.app().options.databaseURL,
//       timestamp: new Date().toISOString(),
//       summary: {
//         totalTopLevelNodes: Object.keys(allData).length,
//         totalNodes: countNodes(allData),
//       },
//       nodes: results,
//     };

//     // Handle file output (independent of JSON flag)
//     if (options.output) {
//       const outputFile = options.output.endsWith(".json")
//         ? options.output
//         : `${options.output}.json`;

//       fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
//       console.log(chalk.green(`📄 Database structure saved to: ${outputFile}`));

//       // Show file size
//       const fileSize = (fs.statSync(outputFile).size / 1024).toFixed(2);
//       console.log(chalk.gray(`   └── File size: ${fileSize} KB`));
//     }

//     // Handle JSON console output (independent of output file)
//     if (options.json) {
//       console.log(JSON.stringify(outputData, null, 2));
//     } else if (!options.output) {
//       // Show summary only if not in JSON mode and no file output
//       console.log(chalk.blue("📊 Database Summary:"));
//       console.log(
//         chalk.gray(
//           `   └── Total top-level nodes: ${Object.keys(allData).length}`
//         )
//       );
//       console.log(
//         chalk.gray(
//           `   └── Total nodes (including nested): ${countNodes(allData)}`
//         )
//       );
//       console.log(
//         chalk.gray(`   └── Database URL: ${admin.app().options.databaseURL}`)
//       );
//     }
//   } catch (error) {
//     console.error(chalk.red("❌ Failed to list database:"), error.message);

//     if (error.message.includes("PERMISSION_DENIED")) {
//       console.log(chalk.yellow("💡 Make sure:"));
//       console.log(
//         chalk.gray("   • Your account has Realtime Database read access")
//       );
//       console.log(chalk.gray("   • Database rules allow read access"));
//     }

//     throw error;
//   }
// }

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

// Add docs command
// program
//   .command("docs")
//   .description("Show CLI documentation for LLMs and developers")
//   .option("--save <file>", "Save documentation to file")
//   .action(async (options) => {
//     try {
//       if (options.save) {
//         // Save to file
//         const outputFile = options.save.endsWith(".txt")
//           ? options.save
//           : `${options.save}.txt`;

//         fs.writeFileSync(outputFile, documentation);
//         console.log(chalk.green(`📄 Documentation saved to: ${outputFile}`));

//         // Also show file size
//         const fileSize = (fs.statSync(outputFile).size / 1024).toFixed(2);
//         console.log(chalk.gray(`   └── File size: ${fileSize} KB`));
//       } else {
//         // Print to console
//         console.log(documentation);
//       }
//     } catch (error) {
//       console.error(
//         chalk.red("❌ Failed to generate documentation:"),
//         error.message
//       );
//       process.exit(1);
//     }
//   });
program.addCommand(docsCommand);

// Export command
// program
//   .command("firestore:export")
//   .description("Export all collections from Firestore")
//   .option("-o, --output <dir>", "Output directory", "./")
//   .option("--no-detailed", "Skip detailed format export")
//   .option("--no-importable", "Skip importable format export")
//   .option("--no-subcollections", "Skip subcollections")
//   .option("-e, --exclude <collections...>", "Exclude specific collections")
//   .action(async (options) => {
//     try {
//       await exportCollections(options);
//     } catch (error) {
//       process.exit(1);
//     } finally {
//       await admin.app().delete();
//     }
//   });

program.addCommand(firestoreCommand.exportCommand);

// Import command
// program
//   .command("firestore:import")
//   .description("Import data to Firestore from JSON file")
//   .argument("<file>", "JSON file to import")
//   .option("-b, --batch-size <size>", "Batch size for imports", "500")
//   .option("-m, --merge", "Merge documents instead of overwriting")
//   .option("-e, --exclude <collections...>", "Exclude specific collections")
//   .action(async (file, options) => {
//     try {
//       await importCollections(file, options);
//     } catch (error) {
//       process.exit(1);
//     } finally {
//       await admin.app().delete();
//     }
//   });

program.addCommand(firestoreCommand.importCommand);

// List command
// program
//   .command("firestore:list")
//   .description("List all collections and their basic info")
//   .action(async () => {
//     try {
//       await listCollections();
//     } catch (error) {
//       process.exit(1);
//     } finally {
//       await admin.app().delete();
//     }
//   });

program.addCommand(firestoreCommand.listCommand);

// Query command
// program
//   .command("firestore:query")
//   .description("Query a specific collection")
//   .argument("<collection>", "Collection name to query")
//   .option(
//     "-w, --where <field,operator,value>",
//     'Where clause (e.g., "age,>=,18")'
//   )
//   .option("-l, --limit <number>", "Limit number of results")
//   .option(
//     "-o, --order-by <field,direction>",
//     'Order by field (e.g., "name,asc")'
//   )
//   .option("--json", "Output results as JSON")
//   .option("--output <file>", "Save JSON output to file (use with --json)")
//   .action(async (collection, options) => {
//     try {
//       await queryCollection(collection, options);
//     } catch (error) {
//       process.exit(1);
//     } finally {
//       await admin.app().delete();
//     }
//   });

program.addCommand(firestoreCommand.queryCommand);

// Realtime Database commands
// program
//   .command("rtdb:export")
//   .description("Export all data from Realtime Database")
//   .option("-o, --output <dir>", "Output directory", "./")
//   .option("--no-detailed", "Skip detailed format export")
//   .option("--no-importable", "Skip importable format export")
//   .option("--no-subcollections", "Skip nested data (limit to top level only)")
//   .option("-e, --exclude <paths...>", "Exclude specific top-level paths")
//   .addHelpText(
//     "after",
//     `
// Examples:
//   $ firestore-cli rtdb:export --database-url https://my-project-default-rtdb.firebaseio.com/ --output ./backups/
//   $ firestore-cli rtdb:export --database-url https://my-project-default-rtdb.firebaseio.com/  --exclude users logs --output ./backups/
//   $ firestore-cli rtdb:export --database-url https://my-project-default-rtdb.firebaseio.com/ --no-subcollections --no-detailed`
//   )
//   .action(async (options) => {
//     try {
//       await exportRealtimeDatabase(options);
//     } catch (error) {
//       process.exit(1);
//     } finally {
//       await admin.app().delete();
//     }
//   });

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

// Login command for authentication
// program
//   .command("login")
//   .description("Authenticate with Google account or service account")
//   .option("--force", "Force re-authentication even if already logged in")
//   .option("--method <type>", "Authentication method: oauth or service-account")
//   .action(async (options) => {
//     try {
//       const existingCredentials = loadCredentials();
//       const config = loadConfig();

//       if (existingCredentials && !options.force) {
//         console.log(chalk.green("✅ Already authenticated"));

//         if (config.defaultProject) {
//           console.log(
//             chalk.gray(`   └── Default project: ${config.defaultProject}`)
//           );
//         }

//         console.log(chalk.blue("\n💡 Available options:"));
//         console.log(chalk.gray("   • Use --force to re-authenticate"));
//         console.log(
//           chalk.gray('   • Use "firestore-cli projects" to change project')
//         );
//         console.log(
//           chalk.gray('   • Use "firestore-cli logout" to clear credentials')
//         );
//         return;
//       }

//       console.log(chalk.blue("🔐 Starting authentication process...\n"));

//       // Determine authentication method
//       let authMethod = options.method;
//       if (!authMethod || !["oauth", "service-account"].includes(authMethod)) {
//         authMethod = await promptAuthenticationMethod();
//       }

//       if (authMethod === "service-account") {
//         // Service account authentication
//         console.log(chalk.blue("🔑 Service Account Authentication\n"));
//         const serviceAccountPath = await promptServiceAccountFile();

//         const serviceAccount = require(path.resolve(serviceAccountPath));
//         console.log(chalk.green("✅ Service account loaded successfully!"));
//         console.log(chalk.gray(`   └── Project: ${serviceAccount.project_id}`));

//         // Ask if user wants to set as default project
//         const { setDefault } = await inquirer.prompt([
//           {
//             type: "confirm",
//             name: "setDefault",
//             message: "Set this project as default?",
//             default: true,
//           },
//         ]);

//         if (setDefault) {
//           saveConfig({ ...config, defaultProject: serviceAccount.project_id });
//           console.log(
//             chalk.green(
//               `✅ Default project set to: ${serviceAccount.project_id}`
//             )
//           );
//         }

//         console.log(
//           chalk.green("\n🎉 Setup complete! You can now use all commands.")
//         );
//         console.log(
//           chalk.gray(
//             `💡 Use --service-account ${serviceAccountPath} flag or place the file in your project`
//           )
//         );
//       } else {
//         // OAuth authentication (existing flow)
//         const credentials = await authenticateWithOAuth();
//         console.log(chalk.green("✅ Authentication successful!\n"));

//         // Get and select project
//         console.log(chalk.blue("📋 Fetching your Google Cloud projects..."));
//         const projects = await listUserProjects(credentials);

//         if (projects.length === 0) {
//           console.log(chalk.yellow("⚠️  No accessible projects found"));
//           console.log(
//             chalk.gray("You can still use the CLI with --project flag")
//           );
//           return;
//         }

//         const choices = projects.map((p) => ({
//           name: `${p.name} (${p.projectId})`,
//           value: p.projectId,
//           short: p.projectId,
//         }));

//         const { selectedProject } = await inquirer.prompt([
//           {
//             type: "list",
//             name: "selectedProject",
//             message: "Select default project:",
//             choices: [
//               ...choices,
//               { name: "Skip (use --project flag)", value: null },
//             ],
//             pageSize: 10,
//           },
//         ]);

//         if (selectedProject) {
//           saveConfig({ ...config, defaultProject: selectedProject });
//           console.log(
//             chalk.green(`✅ Default project set to: ${selectedProject}`)
//           );
//         }

//         console.log(
//           chalk.green("\n🎉 Setup complete! You can now use all commands.")
//         );
//       }
//     } catch (error) {
//       console.error(chalk.red("❌ Authentication failed:"), error.message);
//       process.exit(1);
//     }
//   });

program.addCommand(authCommand.loginCommand);

// Logout command
// program
//   .command("logout")
//   .description("Clear authentication and stored credentials")
//   .action(() => {
//     try {
//       if (fs.existsSync(CREDENTIALS_FILE)) {
//         fs.unlinkSync(CREDENTIALS_FILE);
//       }
//       if (fs.existsSync(CONFIG_FILE)) {
//         fs.unlinkSync(CONFIG_FILE);
//       }

//       console.log(chalk.green("✅ Logged out successfully"));
//       console.log(chalk.gray("All credentials and configuration cleared"));
//       console.log(chalk.blue("\n💡 Alternative commands:"));
//       console.log(
//         chalk.gray("   • firestore-cli reset --credentials-only (keep config)")
//       );
//       console.log(
//         chalk.gray("   • firestore-cli reset --config-only (keep credentials)")
//       );
//       console.log(
//         chalk.gray(
//           "   • firestore-cli projects --clear-default (clear project only)"
//         )
//       );
//     } catch (error) {
//       console.error(chalk.red("❌ Logout failed:"), error.message);
//     }
//   });

// Projects command
// program
//   .command("projects")
//   .description("List available projects and manage default project")
//   .option("--set-default <project>", "Set default project")
//   .option("--clear-default", "Clear the default project setting")
//   .action(async (options) => {
//     try {
//       const credentials = loadCredentials();
//       const config = loadConfig();

//       // Handle clearing default project
//       if (options.clearDefault) {
//         if (config.defaultProject) {
//           const newConfig = { ...config };
//           delete newConfig.defaultProject;
//           saveConfig(newConfig);
//           console.log(chalk.green("✅ Default project cleared"));
//         } else {
//           console.log(chalk.yellow("⚠️  No default project was set"));
//         }
//         return;
//       }

//       if (!credentials) {
//         console.log(chalk.yellow("🔐 Authentication required"));
//         console.log(chalk.gray("Run: firestore-cli login"));
//         return;
//       }

//       if (options.setDefault) {
//         saveConfig({ ...config, defaultProject: options.setDefault });
//         console.log(
//           chalk.green(`✅ Default project set to: ${options.setDefault}`)
//         );
//         return;
//       }

//       console.log(chalk.blue("📋 Fetching your Google Cloud projects...\n"));
//       const projects = await listUserProjects(credentials);

//       if (projects.length === 0) {
//         console.log(chalk.yellow("⚠️  No accessible projects found"));
//         return;
//       }

//       console.log(chalk.cyan(`Found ${projects.length} projects:\n`));

//       projects.forEach((project) => {
//         const isDefault = project.projectId === config.defaultProject;
//         const marker = isDefault ? chalk.green("✓ (default)") : "";

//         console.log(chalk.white(`📁 ${project.name}`));
//         console.log(chalk.gray(`   └── ID: ${project.projectId} ${marker}`));
//         console.log(chalk.gray(`   └── State: ${project.lifecycleState}`));
//         console.log();
//       });

//       console.log(chalk.blue("💡 Commands:"));
//       console.log(
//         chalk.gray("   • firestore-cli projects --set-default PROJECT_ID")
//       );
//       console.log(chalk.gray("   • firestore-cli projects --clear-default"));
//       console.log(
//         chalk.gray("   • firestore-cli --project PROJECT_ID [command]")
//       );
//       console.log(chalk.gray("   • firestore-cli reset --config-only"));
//     } catch (error) {
//       console.error(chalk.red("❌ Failed to fetch projects:"), error.message);

//       if (error.message.includes("auth")) {
//         console.log(chalk.yellow("💡 Try: firestore-cli login --force"));
//       }
//     }
//   });

program.addCommand(authCommand.projectsCommand);

// Add a new reset command
// program
//   .command("reset")
//   .description("Reset all configuration and credentials")
//   .option("--config-only", "Reset only configuration (keep credentials)")
//   .option("--credentials-only", "Reset only credentials (keep configuration)")
//   .action(async (options) => {
//     try {
//       const config = loadConfig();
//       const credentials = loadCredentials();

//       // Show current state
//       console.log(chalk.blue("📋 Current Configuration:"));

//       if (credentials) {
//         console.log(chalk.gray("   └── Credentials: ✅ Present"));
//       } else {
//         console.log(chalk.gray("   └── Credentials: ❌ Not found"));
//       }

//       if (config.defaultProject) {
//         console.log(
//           chalk.gray(`   └── Default Project: ${config.defaultProject}`)
//         );
//       } else {
//         console.log(chalk.gray("   └── Default Project: ❌ Not set"));
//       }

//       // Determine what to reset
//       let resetCredentials = true;
//       let resetConfig = true;

//       if (options.configOnly) {
//         resetCredentials = false;
//         console.log(chalk.yellow("\n🔄 Resetting configuration only..."));
//       } else if (options.credentialsOnly) {
//         resetConfig = false;
//         console.log(chalk.yellow("\n🔄 Resetting credentials only..."));
//       } else {
//         // Ask for confirmation for full reset
//         const { confirmReset } = await inquirer.prompt([
//           {
//             type: "confirm",
//             name: "confirmReset",
//             message:
//               "This will reset ALL configuration and credentials. Continue?",
//             default: false,
//           },
//         ]);

//         if (!confirmReset) {
//           console.log(chalk.gray("Reset cancelled."));
//           return;
//         }

//         console.log(
//           chalk.yellow("\n🔄 Resetting all configuration and credentials...")
//         );
//       }

//       let resetCount = 0;

//       // Reset credentials
//       if (resetCredentials && fs.existsSync(CREDENTIALS_FILE)) {
//         fs.unlinkSync(CREDENTIALS_FILE);
//         console.log(chalk.green("   ✅ Credentials cleared"));
//         resetCount++;
//       }

//       // Reset configuration
//       if (resetConfig && fs.existsSync(CONFIG_FILE)) {
//         fs.unlinkSync(CONFIG_FILE);
//         console.log(chalk.green("   ✅ Configuration cleared"));
//         resetCount++;
//       }

//       if (resetCount === 0) {
//         console.log(
//           chalk.yellow("   ⚠️  Nothing to reset - files already clean")
//         );
//       } else {
//         console.log(
//           chalk.green(`\n🎉 Reset completed! ${resetCount} file(s) cleared.`)
//         );
//         console.log(
//           chalk.gray(
//             "You'll need to run 'firestore-cli login' to authenticate again."
//           )
//         );
//       }
//     } catch (error) {
//       console.error(chalk.red("❌ Reset failed:"), error.message);
//       process.exit(1);
//     }
//   });

program.addCommand(authCommand.resetCommand);

// Add convert command
// program
//   .command("remote-config:convert")
//   .description("Convert JSON file to Firebase Remote Config format")
//   .argument("<file>", "JSON file to convert")
//   .option("-o, --output <file>", "Output file name")
//   .option("--version-number <number>", "Version number for Remote Config", "1")
//   .option(
//     "--user-email <email>",
//     "User email for version info",
//     "firestore-cli@example.com"
//   )
//   .option("--description <text>", "Description prefix for parameters")
//   .option("--add-conditions", "Add default iOS/Android conditions")
//   .option(
//     "--template <type>",
//     "Use predefined template (basic|mobile|web)",
//     "basic"
//   )
//   .action(async (file, options) => {
//     try {
//       await convertToRemoteConfig(file, options);
//     } catch (error) {
//       process.exit(1);
//     }
//   });

program.addCommand(remoteConfigCommand.convertCommand);

// Parse arguments
program.parse();

// module.exports = {
//   // exportCollections,
//   // importCollections,
//   // listCollections,
//   // queryCollection,
// };
