const chalk = require("chalk");
const admin = require("firebase-admin");
const fs = require("fs");
const { countNodes } = require("../../utils.js");

async function listRealtimeDatabase(options) {
  try {
    console.log(chalk.blue("📋 Listing Realtime Database structure...\n"));

    // Get the database reference
    const rtdb = admin.database();

    // Get the root reference and fetch all data
    const snapshot = await rtdb.ref("/").once("value");
    const allData = snapshot.val();

    if (!allData) {
      console.log(chalk.yellow("⚠️  No data found in Realtime Database"));
      return;
    }

    // Prepare data for JSON output
    const results = [];

    for (const [key, value] of Object.entries(allData)) {
      const nodeInfo = {
        name: key,
        type:
          typeof value === "object" && value !== null ? "object" : typeof value,
      };

      if (typeof value === "object" && value !== null) {
        nodeInfo.childCount = Object.keys(value).length;
        nodeInfo.sampleKeys = Object.keys(value).slice(0, 3);
        if (Object.keys(value).length > 3) {
          nodeInfo.hasMoreKeys = true;
        }
      } else {
        nodeInfo.value = String(value).substring(0, 50);
        if (String(value).length > 50) {
          nodeInfo.truncated = true;
        }
      }

      results.push(nodeInfo);

      // Only show console output if not JSON mode
      if (!options.json) {
        console.log(chalk.white(`📁 ${key}`));

        if (typeof value === "object" && value !== null) {
          const childCount = Object.keys(value).length;
          console.log(chalk.gray(`   └── Children: ${childCount}`));

          // Show sample child keys (first 3)
          const childKeys = Object.keys(value).slice(0, 3);
          if (childKeys.length > 0) {
            const sampleText =
              childKeys.join(", ") +
              (Object.keys(value).length > 3 ? "..." : "");
            console.log(chalk.gray(`   └── Sample keys: ${sampleText}`));
          }
        } else {
          console.log(chalk.gray(`   └── Type: ${typeof value}`));
          console.log(
            chalk.gray(
              `   └── Value: ${String(value).substring(0, 50)}${
                String(value).length > 50 ? "..." : ""
              }`
            )
          );
        }
        console.log();
      }
    }

    // Prepare output data (used for both JSON and file output)
    const outputData = {
      database: admin.app().options.databaseURL,
      timestamp: new Date().toISOString(),
      summary: {
        totalTopLevelNodes: Object.keys(allData).length,
        totalNodes: countNodes(allData),
      },
      nodes: results,
    };

    // Handle file output (independent of JSON flag)
    if (options.output) {
      const outputFile = options.output.endsWith(".json")
        ? options.output
        : `${options.output}.json`;

      fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
      console.log(chalk.green(`📄 Database structure saved to: ${outputFile}`));

      // Show file size
      const fileSize = (fs.statSync(outputFile).size / 1024).toFixed(2);
      console.log(chalk.gray(`   └── File size: ${fileSize} KB`));
    }

    // Handle JSON console output (independent of output file)
    if (options.json) {
      console.log(JSON.stringify(outputData, null, 2));
    } else if (!options.output) {
      // Show summary only if not in JSON mode and no file output
      console.log(chalk.blue("📊 Database Summary:"));
      console.log(
        chalk.gray(
          `   └── Total top-level nodes: ${Object.keys(allData).length}`
        )
      );
      console.log(
        chalk.gray(
          `   └── Total nodes (including nested): ${countNodes(allData)}`
        )
      );
      console.log(
        chalk.gray(`   └── Database URL: ${admin.app().options.databaseURL}`)
      );
    }
  } catch (error) {
    console.error(chalk.red("❌ Failed to list database:"), error.message);

    if (error.message.includes("PERMISSION_DENIED")) {
      console.log(chalk.yellow("💡 Make sure:"));
      console.log(
        chalk.gray("   • Your account has Realtime Database read access")
      );
      console.log(chalk.gray("   • Database rules allow read access"));
    }

    throw error;
  }
}
