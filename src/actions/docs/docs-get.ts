import chalk from 'chalk';
import fs from 'fs';

import { documentation } from '@/docs';

type DocsGetOptionsType = {
  save?: string;
};

function docsGet(options: DocsGetOptionsType) {
  try {
    if (options.save) {
      // Save to file
      const outputFile = options.save.endsWith('.txt')
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
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(
      chalk.red('❌ Failed to generate documentation:'),
      errorMessage
    );
  }
}

export default docsGet;
