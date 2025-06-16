import { program } from 'commander';

import { listProjectsAction } from '@/actions/auth/projects';

const projectsList = program
  .createCommand('projects')
  .description('List available projects and manage default project')
  .option('--set-default <project>', 'Set default project')
  .option('--clear-default', 'Clear the default project setting')
  .action(listProjectsAction);

export default projectsList;
