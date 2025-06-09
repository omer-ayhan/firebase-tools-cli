import chalk from "chalk";
import * as admin from "firebase-admin";

export async function listCollections(): Promise<void> {
  try {
    const db = admin.firestore();
    console.log(chalk.blue("📋 Listing all collections...\n"));

    const collections = await db.listCollections();

    console.log(chalk.cyan(`Found ${collections.length} collections:\n`));

    for (const collection of collections) {
      const snapshot = await collection.get();
      console.log(chalk.white(`📁 ${collection.id}`));
      console.log(chalk.gray(`   └── Documents: ${snapshot.size}`));

      // Sample a few documents to show structure
      if (snapshot.size > 0) {
        const firstDoc = snapshot.docs[0];
        const fields = Object.keys(firstDoc.data());
        console.log(
          chalk.gray(
            `   └── Sample fields: ${fields.slice(0, 5).join(", ")}${
              fields.length > 5 ? "..." : ""
            }`
          )
        );
      }
      console.log("\n");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(chalk.red("❌ Failed to list collections:"), errorMessage);
    throw error;
  }
}
