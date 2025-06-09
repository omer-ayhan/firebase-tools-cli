import { Command } from "commander";
import * as admin from "firebase-admin";
import { listCollections } from "./firestore-list";
import { queryCollection } from "./firestore-query";
import { importCollections } from "./firestore-import";
import { exportCollections } from "./firestore-export";

const firestoreCommand = new Command()
  .name("firestore")
  .description("Firestore database operations");

const listCommand = firestoreCommand
  .command("firestore:list")
  .description("List all collections and their basic info")
  .action(async () => {
    try {
      await listCollections();
    } catch (error) {
      process.exit(1);
    } finally {
      await admin.app().delete();
    }
  });

const queryCommand = firestoreCommand
  .command("firestore:query")
  .description("Query a specific collection")
  .argument("<collection>", "Collection name to query")
  .option(
    "-w, --where <field,operator,value>",
    'Where clause (e.g., "age,>=,18")'
  )
  .option("-l, --limit <number>", "Limit number of results")
  .option(
    "-o, --order-by <field,direction>",
    'Order by field (e.g., "name,asc")'
  )
  .option("--json", "Output results as JSON")
  .option("--output <file>", "Save JSON output to file (use with --json)")
  .action(async (collection, options) => {
    try {
      await queryCollection(collection, options);
    } catch (error) {
      process.exit(1);
    } finally {
      await admin.app().delete();
    }
  });

const importCommand = firestoreCommand
  .command("firestore:import")
  .description("Import data to Firestore from JSON file")
  .argument("<file>", "JSON file to import")
  .option("-b, --batch-size <size>", "Batch size for imports", "500")
  .option("-m, --merge", "Merge documents instead of overwriting")
  .option("-e, --exclude <collections...>", "Exclude specific collections")
  .action(async (file, options) => {
    try {
      await importCollections(file, options);
    } catch (error) {
      process.exit(1);
    } finally {
      await admin.app().delete();
    }
  });

const exportCommand = firestoreCommand
  .command("firestore:export")
  .description("Export all collections from Firestore")
  .option("-o, --output <dir>", "Output directory", "./")
  .option("--no-detailed", "Skip detailed format export")
  .option("--no-importable", "Skip importable format export")
  .option("--no-subcollections", "Skip subcollections")
  .option("-e, --exclude <collections...>", "Exclude specific collections")
  .action(async (options) => {
    try {
      await exportCollections(options);
    } catch (error) {
      process.exit(1);
    } finally {
      await admin.app().delete();
    }
  });

export default {
  queryCommand,
  importCommand,
  exportCommand,
  listCommand,
};
