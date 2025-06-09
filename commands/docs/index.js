const { Command } = require("commander");
const fs = require("fs");
const chalk = require("chalk");
const documentation = require("../../docs.js");

const docsCommand = new Command()
  .command("docs")
  .description("Show CLI documentation for LLMs and developers")
  .option("--save <file>", "Save documentation to file")
  .action(async (options) => {
    try {
      if (options.save) {
        // Save to file
        const outputFile = options.save.endsWith(".txt")
          ? options.save
          : `${options.save}.txt`;

        fs.writeFileSync(outputFile, documentation);
        console.log(chalk.green(`📄 Documentation saved to: ${outputFile}`));

        // Also show file size
        const fileSize = (fs.statSync(outputFile).size / 1024).toFixed(2);
        console.log(chalk.gray(`   └── File size: ${fileSize} KB`));
      } else {
        // Print to console
        console.log(documentation);
      }
    } catch (error) {
      console.error(
        chalk.red("❌ Failed to generate documentation:"),
        error.message
      );
      process.exit(1);
    }
  });

module.exports = docsCommand;
