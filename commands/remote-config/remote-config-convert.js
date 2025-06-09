const fs = require("fs");
const chalk = require("chalk");
const { determineValueType } = require("../../utils.js");

async function convertToRemoteConfig(inputFile, options) {
  try {
    console.log(
      chalk.blue(`🔄 Converting JSON to Remote Config format: ${inputFile}\n`)
    );

    if (!fs.existsSync(inputFile)) {
      console.error(chalk.red(`❌ Input file not found: ${inputFile}`));
      process.exit(1);
    }

    const rawData = fs.readFileSync(inputFile, "utf8");
    let inputData;

    try {
      inputData = JSON.parse(rawData);
    } catch (error) {
      console.error(chalk.red("❌ Invalid JSON file:"), error.message);
      process.exit(1);
    }

    // Create Remote Config structure
    const remoteConfig = {
      conditions: options.conditions || [],
      parameters: {},
      version: {
        versionNumber: options.versionNumber || "1",
        updateTime: new Date().toISOString(),
        updateUser: {
          email: options.userEmail || "firestore-cli@example.com",
        },
        updateOrigin: "CONSOLE",
        updateType: "INCREMENTAL_UPDATE",
      },
    };

    // Convert input data to parameters
    console.log(chalk.blue("📝 Converting parameters..."));
    let parameterCount = 0;

    for (const [key, value] of Object.entries(inputData)) {
      // Skip metadata fields
      if (key === "conditions" || key === "version") {
        continue;
      }

      const parameter = {
        defaultValue: {},
        valueType: determineValueType(value),
      };

      // Set the default value based on type
      if (typeof value === "object" && value !== null) {
        parameter.defaultValue.value = JSON.stringify(value);
        parameter.valueType = "JSON";
      } else if (typeof value === "boolean") {
        parameter.defaultValue.value = value.toString();
        parameter.valueType = "BOOLEAN";
      } else if (typeof value === "number") {
        parameter.defaultValue.value = value.toString();
        parameter.valueType = "NUMBER";
      } else {
        parameter.defaultValue.value = value.toString();
        parameter.valueType = "STRING";
      }

      // Add description if provided in options
      if (options.description) {
        parameter.description = `${options.description} - ${key}`;
      }

      // Add conditional values if specified
      if (options.conditionalValues && options.conditionalValues[key]) {
        parameter.conditionalValues = options.conditionalValues[key];
      }

      remoteConfig.parameters[key] = parameter;
      parameterCount++;

      console.log(chalk.gray(`   └── ${key}: ${parameter.valueType}`));
    }

    // Add conditions if provided
    if (options.addConditions) {
      remoteConfig.conditions = [
        {
          name: "iOS",
          expression: "app.id == 'your.ios.app.id'",
          tagColor: "PINK",
        },
        {
          name: "Android",
          expression: "app.id == 'your.android.app.id'",
          tagColor: "GREEN",
        },
      ];
      console.log(
        chalk.gray(
          `   └── Added ${remoteConfig.conditions.length} default conditions`
        )
      );
    }

    // Generate output filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputFile = options.output || `remote_config_${timestamp}.json`;

    // Save the converted file
    fs.writeFileSync(outputFile, JSON.stringify(remoteConfig, null, 2));

    console.log(chalk.green(`\n✅ Conversion completed successfully!`));
    console.log(chalk.gray(`   └── Parameters converted: ${parameterCount}`));
    console.log(
      chalk.gray(`   └── Conditions added: ${remoteConfig.conditions.length}`)
    );
    console.log(chalk.green(`📄 Remote Config saved to: ${outputFile}`));

    // Show file size
    const fileSize = (fs.statSync(outputFile).size / 1024).toFixed(2);
    console.log(chalk.gray(`   └── File size: ${fileSize} KB`));

    // Show usage instructions
    console.log(chalk.blue("\n💡 Next steps:"));
    console.log(chalk.gray("   1. Review the generated Remote Config file"));
    console.log(chalk.gray("   2. Update app IDs in conditions if needed"));
    console.log(
      chalk.gray("   3. Upload to Firebase Console or use Firebase CLI")
    );
    console.log(chalk.gray("   4. Test with your app before publishing"));
  } catch (error) {
    console.error(chalk.red("❌ Conversion failed:"), error.message);
    throw error;
  }
}

module.exports = convertToRemoteConfig;
