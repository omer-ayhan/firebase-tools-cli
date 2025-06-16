import { program } from 'commander';

import { resetAction } from '@/actions/auth/reset';

const reset = program
  .createCommand('reset')
  .description('Reset all configuration and credentials')
  .option('--config-only', 'Reset only configuration (keep credentials)')
  .option('--credentials-only', 'Reset only credentials (keep configuration)')
  .action(resetAction);

export default reset;
