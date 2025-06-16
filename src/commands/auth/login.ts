import { program } from 'commander';

import { loginAction } from '@/actions/auth/login';

const login = program
  .createCommand('login')
  .description('Authenticate with Google account or service account')
  .option('--force', 'Force re-authentication even if already logged in')
  .option('--method <type>', 'Authentication method: oauth or service-account')
  .action(loginAction);

export default login;
