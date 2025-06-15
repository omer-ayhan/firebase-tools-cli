import { Command } from 'commander';

import { convertToRemoteConfig } from './remote-config-convert';

const remoteConfigCommand = new Command()
  .command('remote-config')
  .description('Remote Config operations');

const convertCommand = remoteConfigCommand
  .command('remote-config:convert')
  .description('Convert JSON file to Firebase Remote Config format')
  .argument('<file>', 'JSON file to convert')
  .option('-o, --output <file>', 'Output file name')
  .option('--version-number <number>', 'Version number for Remote Config', '1')
  .option(
    '--user-email <email>',
    'User email for version info',
    'firebase-cli@example.com'
  )
  .option('--description <text>', 'Description prefix for parameters')
  .option('--add-conditions', 'Add default iOS/Android conditions')
  .option(
    '--template <type>',
    'Use predefined template (basic|mobile|web)',
    'basic'
  )
  .action(async (file, options) => {
    try {
      await convertToRemoteConfig(file, options);
    } catch (error) {
      process.exit(1);
    }
  });

export default {
  convertCommand,
};
