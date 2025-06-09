const { Command } = require("commander");
const chalk = require("chalk");
const path = require("path");
const inquirer = require("inquirer");
const fs = require("fs");
const {
  loadCredentials,
  loadConfig,
  saveConfig,
  promptAuthenticationMethod,
  promptServiceAccountFile,
} = require("./login.js");
const { listUserProjects } = require("./projects.js");

const CONFIG_DIR = path.join(require("os").homedir(), ".firestore-cli");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const CREDENTIALS_FILE = path.join(CONFIG_DIR, "credentials.json");

const authCommand = new Command()
  .command("auth")
  .description("Authentication operations");

const loginCommand = authCommand
  .command("login")
  .description("Authenticate with Google account or service account")
  .option("--force", "Force re-authentication even if already logged in")
  .option("--method <type>", "Authentication method: oauth or service-account")
  .action(async (options) => {
    try {
      const existingCredentials = loadCredentials();
      const config = loadConfig();

      if (existingCredentials && !options.force) {
        console.log(chalk.green("✅ Already authenticated"));

        if (config.defaultProject) {
          console.log(
            chalk.gray(`   └── Default project: ${config.defaultProject}`)
          );
        }

        console.log(chalk.blue("\n💡 Available options:"));
        console.log(chalk.gray("   • Use --force to re-authenticate"));
        console.log(
          chalk.gray('   • Use "firestore-cli projects" to change project')
        );
        console.log(
          chalk.gray('   • Use "firestore-cli logout" to clear credentials')
        );
        return;
      }

      console.log(chalk.blue("🔐 Starting authentication process...\n"));

      // Determine authentication method
      let authMethod = options.method;
      if (!authMethod || !["oauth", "service-account"].includes(authMethod)) {
        authMethod = await promptAuthenticationMethod();
      }

      if (authMethod === "service-account") {
        // Service account authentication
        console.log(chalk.blue("🔑 Service Account Authentication\n"));
        const serviceAccountPath = await promptServiceAccountFile();

        const serviceAccount = require(path.resolve(serviceAccountPath));
        console.log(chalk.green("✅ Service account loaded successfully!"));
        console.log(chalk.gray(`   └── Project: ${serviceAccount.project_id}`));

        // Ask if user wants to set as default project
        const { setDefault } = await inquirer.prompt([
          {
            type: "confirm",
            name: "setDefault",
            message: "Set this project as default?",
            default: true,
          },
        ]);

        if (setDefault) {
          saveConfig({ ...config, defaultProject: serviceAccount.project_id });
          console.log(
            chalk.green(
              `✅ Default project set to: ${serviceAccount.project_id}`
            )
          );
        }

        console.log(
          chalk.green("\n🎉 Setup complete! You can now use all commands.")
        );
        console.log(
          chalk.gray(
            `💡 Use --service-account ${serviceAccountPath} flag or place the file in your project`
          )
        );
      } else {
        // OAuth authentication (existing flow)
        const credentials = await authenticateWithOAuth();
        console.log(chalk.green("✅ Authentication successful!\n"));

        // Get and select project
        console.log(chalk.blue("📋 Fetching your Google Cloud projects..."));
        const projects = await listUserProjects(credentials);

        if (projects.length === 0) {
          console.log(chalk.yellow("⚠️  No accessible projects found"));
          console.log(
            chalk.gray("You can still use the CLI with --project flag")
          );
          return;
        }

        const choices = projects.map((p) => ({
          name: `${p.name} (${p.projectId})`,
          value: p.projectId,
          short: p.projectId,
        }));

        const { selectedProject } = await inquirer.prompt([
          {
            type: "list",
            name: "selectedProject",
            message: "Select default project:",
            choices: [
              ...choices,
              { name: "Skip (use --project flag)", value: null },
            ],
            pageSize: 10,
          },
        ]);

        if (selectedProject) {
          saveConfig({ ...config, defaultProject: selectedProject });
          console.log(
            chalk.green(`✅ Default project set to: ${selectedProject}`)
          );
        }

        console.log(
          chalk.green("\n🎉 Setup complete! You can now use all commands.")
        );
      }
    } catch (error) {
      console.error(chalk.red("❌ Authentication failed:"), error.message);
      process.exit(1);
    }
  });

const resetCommand = authCommand
  .command("reset")
  .description("Reset all configuration and credentials")
  .option("--config-only", "Reset only configuration (keep credentials)")
  .option("--credentials-only", "Reset only credentials (keep configuration)")
  .action(async (options) => {
    try {
      const config = loadConfig();
      const credentials = loadCredentials();

      // Show current state
      console.log(chalk.blue("📋 Current Configuration:"));

      if (credentials) {
        console.log(chalk.gray("   └── Credentials: ✅ Present"));
      } else {
        console.log(chalk.gray("   └── Credentials: ❌ Not found"));
      }

      if (config.defaultProject) {
        console.log(
          chalk.gray(`   └── Default Project: ${config.defaultProject}`)
        );
      } else {
        console.log(chalk.gray("   └── Default Project: ❌ Not set"));
      }

      // Determine what to reset
      let resetCredentials = true;
      let resetConfig = true;

      if (options.configOnly) {
        resetCredentials = false;
        console.log(chalk.yellow("\n🔄 Resetting configuration only..."));
      } else if (options.credentialsOnly) {
        resetConfig = false;
        console.log(chalk.yellow("\n🔄 Resetting credentials only..."));
      } else {
        // Ask for confirmation for full reset
        const { confirmReset } = await inquirer.prompt([
          {
            type: "confirm",
            name: "confirmReset",
            message:
              "This will reset ALL configuration and credentials. Continue?",
            default: false,
          },
        ]);

        if (!confirmReset) {
          console.log(chalk.gray("Reset cancelled."));
          return;
        }

        console.log(
          chalk.yellow("\n🔄 Resetting all configuration and credentials...")
        );
      }

      let resetCount = 0;

      // Reset credentials
      if (resetCredentials && fs.existsSync(CREDENTIALS_FILE)) {
        fs.unlinkSync(CREDENTIALS_FILE);
        console.log(chalk.green("   ✅ Credentials cleared"));
        resetCount++;
      }

      // Reset configuration
      if (resetConfig && fs.existsSync(CONFIG_FILE)) {
        fs.unlinkSync(CONFIG_FILE);
        console.log(chalk.green("   ✅ Configuration cleared"));
        resetCount++;
      }

      if (resetCount === 0) {
        console.log(
          chalk.yellow("   ⚠️  Nothing to reset - files already clean")
        );
      } else {
        console.log(
          chalk.green(`\n🎉 Reset completed! ${resetCount} file(s) cleared.`)
        );
        console.log(
          chalk.gray(
            "You'll need to run 'firestore-cli login' to authenticate again."
          )
        );
      }
    } catch (error) {
      console.error(chalk.red("❌ Reset failed:"), error.message);
      process.exit(1);
    }
  });

const projectsCommand = authCommand
  .command("projects")
  .description("List available projects and manage default project")
  .option("--set-default <project>", "Set default project")
  .option("--clear-default", "Clear the default project setting")
  .action(async (options) => {
    try {
      const credentials = loadCredentials();
      const config = loadConfig();

      // Handle clearing default project
      if (options.clearDefault) {
        if (config.defaultProject) {
          const newConfig = { ...config };
          delete newConfig.defaultProject;
          saveConfig(newConfig);
          console.log(chalk.green("✅ Default project cleared"));
        } else {
          console.log(chalk.yellow("⚠️  No default project was set"));
        }
        return;
      }

      if (!credentials) {
        console.log(chalk.yellow("🔐 Authentication required"));
        console.log(chalk.gray("Run: firestore-cli login"));
        return;
      }

      if (options.setDefault) {
        saveConfig({ ...config, defaultProject: options.setDefault });
        console.log(
          chalk.green(`✅ Default project set to: ${options.setDefault}`)
        );
        return;
      }

      console.log(chalk.blue("📋 Fetching your Google Cloud projects...\n"));
      const projects = await listUserProjects(credentials);

      if (projects.length === 0) {
        console.log(chalk.yellow("⚠️  No accessible projects found"));
        return;
      }

      console.log(chalk.cyan(`Found ${projects.length} projects:\n`));

      projects.forEach((project) => {
        const isDefault = project.projectId === config.defaultProject;
        const marker = isDefault ? chalk.green("✓ (default)") : "";

        console.log(chalk.white(`📁 ${project.name}`));
        console.log(chalk.gray(`   └── ID: ${project.projectId} ${marker}`));
        console.log(chalk.gray(`   └── State: ${project.lifecycleState}`));
        console.log();
      });

      console.log(chalk.blue("💡 Commands:"));
      console.log(
        chalk.gray("   • firestore-cli projects --set-default PROJECT_ID")
      );
      console.log(chalk.gray("   • firestore-cli projects --clear-default"));
      console.log(
        chalk.gray("   • firestore-cli --project PROJECT_ID [command]")
      );
      console.log(chalk.gray("   • firestore-cli reset --config-only"));
    } catch (error) {
      console.error(chalk.red("❌ Failed to fetch projects:"), error.message);

      if (error.message.includes("auth")) {
        console.log(chalk.yellow("💡 Try: firestore-cli login --force"));
      }
    }
  });

module.exports = {
  loginCommand,
  resetCommand,
  projectsCommand,
};
