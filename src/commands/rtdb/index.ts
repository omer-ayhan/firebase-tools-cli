import { Command } from "commander";
import * as admin from "firebase-admin";
import { listRealtimeDatabase } from "./rtdb-list";
import { exportRealtimeDatabase } from "./rtdb-export";

const rtdbCommand = new Command()
  .name("rtdb")
  .description("Realtime Database operations");

const listCommand = rtdbCommand
  .command("rtdb:list")
  .description("List all top-level nodes and their basic info")
  .option("--json", "Output results as JSON")
  .option("--output <file>", "Save JSON output to file (use with --json)")
  .action(async (options) => {
    try {
      await listRealtimeDatabase(options);
    } catch (error) {
      process.exit(1);
    } finally {
      await admin.app().delete();
    }
  });

const exportCommand = rtdbCommand
  .command("rtdb:export")
  .description("Export all data from Realtime Database")
  .option("-o, --output <dir>", "Output directory", "./")
  .option("--no-detailed", "Skip detailed format export")
  .option("--no-importable", "Skip importable format export")
  .option("--no-subcollections", "Skip nested data (limit to top level only)")
  .option("-e, --exclude <paths...>", "Exclude specific top-level paths")
  .addHelpText(
    "after",
    `
Examples:
  $ firestore-cli rtdb:export --database-url https://my-project-default-rtdb.firebaseio.com/ --output ./backups/
  $ firestore-cli rtdb:export --database-url https://my-project-default-rtdb.firebaseio.com/  --exclude users logs --output ./backups/
  $ firestore-cli rtdb:export --database-url https://my-project-default-rtdb.firebaseio.com/ --no-subcollections --no-detailed`
  )
  .action(async (options) => {
    try {
      await exportRealtimeDatabase(options);
    } catch (error) {
      process.exit(1);
    } finally {
      await admin.app().delete();
    }
  });

export default {
  listCommand,
  exportCommand,
};
