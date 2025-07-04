import { program } from 'commander';
import * as admin from 'firebase-admin';

import { queryCollection } from '@/actions/firestore/firestore-query';

const firestoreQuery = program
  .createCommand('firestore:query')
  .description('Query a collection or fetch a specific document')
  .argument('<collection>', 'Collection name to query')
  .argument('[subcollections...]', 'Nested collection/document path segments')
  .option(
    '-w, --where <field,operator,value>',
    'Where clause (e.g., "age,>=,18") - for collection queries and document array fields'
  )
  .option(
    '-l, --limit <number>',
    'Limit number of results - for collection queries and document array fields'
  )
  .option(
    '-o, --order-by <field,direction>',
    'Order by field (e.g., "name,asc") - for collection queries and document array fields'
  )
  .option(
    '-f, --field <fieldPath>',
    'Show only specific field(s) from document (e.g., "pages" or "pages.0.title") - only for document queries'
  )
  .option('--json', 'Output results as JSON')
  .option('--output <file>', 'Save JSON output to file')
  .addHelpText(
    'after',
    `
Examples:
  Collection queries (odd number of arguments):
    $ firebase-tools-cli firestore:query users
    $ firebase-tools-cli firestore:query users user1 posts
    $ firebase-tools-cli firestore:query users user1 posts post1 comments
    $ firebase-tools-cli firestore:query users --where "age,>=,18" --limit 10

  Document queries (even number of arguments):
    $ firebase-tools-cli firestore:query users user1
    $ firebase-tools-cli firestore:query users user1 posts post1
    $ firebase-tools-cli firestore:query users user1 posts post1 comments comment1

  Field-specific queries (document queries only):
    $ firebase-tools-cli firestore:query mobile_onboardings 1 --field pages
    $ firebase-tools-cli firestore:query users user1 --field profile.settings
    $ firebase-tools-cli firestore:query posts post1 --field metadata.tags.0

  Field queries with filtering (array fields only):
    $ firebase-tools-cli firestore:query mobile_onboardings 1 --field pages --where "page_type,==,question-page_v1"
    $ firebase-tools-cli firestore:query mobile_onboardings 1 --field pages --where "page_type,==,question-page_v1" --order-by "page_order,asc"
    $ firebase-tools-cli firestore:query users user1 --field posts --where "published,==,true" --limit 5
    $ firebase-tools-cli firestore:query posts post1 --field comments --where "rating,>=,4" --order-by "timestamp,desc"

Note: Query options (--where, --limit, --order-by) apply to collection queries and document array fields.
Field queries (--field) only apply to document queries.`
  )
  .action(async (collection, subcollections, options) => {
    try {
      // Build the collection path from all arguments
      const collectionPath = [collection, ...subcollections];
      await queryCollection(collectionPath, options);
      process.exit(0);
    } catch (error) {
      process.exit(1);
    } finally {
      await admin.app().delete();
    }
  });

export default firestoreQuery;
