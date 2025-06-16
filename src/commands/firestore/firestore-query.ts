import { program } from 'commander';
import * as admin from 'firebase-admin';

import { queryCollection } from '@/actions/firestore/firestore-query';

const firestoreQuery = program
  .createCommand('firestore:query')
  .description('Query a specific collection')
  .argument('<collection>', 'Collection name to query')
  .option(
    '-w, --where <field,operator,value>',
    'Where clause (e.g., "age,>=,18")'
  )
  .option('-l, --limit <number>', 'Limit number of results')
  .option(
    '-o, --order-by <field,direction>',
    'Order by field (e.g., "name,asc")'
  )
  .option('--json', 'Output results as JSON')
  .option('--output <file>', 'Save JSON output to file (use with --json)')
  .action(async (collection, options) => {
    try {
      await queryCollection(collection, options);
      process.exit(0);
    } catch (error) {
      process.exit(1);
    } finally {
      await admin.app().delete();
    }
  });

export default firestoreQuery;
