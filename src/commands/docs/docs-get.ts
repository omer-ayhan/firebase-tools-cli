import { Command } from 'commander';

import docsGet from '@/actions/docs/docs-get';

const docsGetCommand = new Command()
  .createCommand('docs')
  .description('Show CLI documentation for LLMs and developers')
  .option('--save <file>', 'Save documentation to file')
  .action(async (options) => {
    try {
      docsGet(options);
      process.exit(0);
    } catch (error) {
      process.exit(1);
    }
  });

export default docsGetCommand;
