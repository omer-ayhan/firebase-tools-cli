import { program } from 'commander';

import login from './commands/auth/login';
import projectsList from './commands/auth/projects';
import reset from './commands/auth/reset';
import docsGetCommand from './commands/docs/docs-get';
import firestoreExport from './commands/firestore/firestore-export';
import firestoreImport from './commands/firestore/firestore-import';
import firestoreList from './commands/firestore/firestore-list';
import firestoreQuery from './commands/firestore/firestore-query';
import remoteConfigConvert from './commands/remote-config/remote-config-convert';
import rtdbExport from './commands/rtdb/rtdb-export';
import rtdbImport from './commands/rtdb/rtdb-import';
import rtdbList from './commands/rtdb/rtdb-list';
import rtdbQuery from './commands/rtdb/rtdb-query';
import {
  PROGRAM_DESCRIPTION,
  PROGRAM_NAME,
  PROGRAM_VERSION,
} from './constants';
import { initializeFirebase } from './hooks/init';

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

program
  .name(PROGRAM_NAME)
  .description(PROGRAM_DESCRIPTION)
  .version(PROGRAM_VERSION);

// Global options for authentication and project
program
  .option('-s, --service-account <path>', 'Path to service account JSON file')
  .option('-p, --project <id>', 'Google Cloud Project ID (overrides default)')
  .option('-d, --database-url <url>', 'Firebase Realtime Database URL')
  .hook('preAction', initializeFirebase)
  .addCommand(login)
  .addCommand(projectsList)
  .addCommand(reset)
  .addCommand(docsGetCommand)
  // firestore commands
  .addCommand(firestoreList)
  .addCommand(firestoreQuery)
  .addCommand(firestoreImport)
  .addCommand(firestoreExport)
  // real time database commands
  .addCommand(rtdbList)
  .addCommand(rtdbQuery)
  .addCommand(rtdbImport)
  .addCommand(rtdbExport)
  // remote config commands
  .addCommand(remoteConfigConvert);

// Parse arguments
program.parse(process.argv);
