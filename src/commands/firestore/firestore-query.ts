import fs from "fs";
import chalk from "chalk";
import * as admin from "firebase-admin";

type QueryCommandOptionsType = {
  where?: string;
  limit?: string;
  orderBy?: string;
  json?: boolean;
  output?: string;
};

type QueryDocumentSnapshotType = admin.firestore.QueryDocumentSnapshot<
  admin.firestore.DocumentData,
  admin.firestore.DocumentData
>;

export async function queryCollection(
  collectionName: string,
  options: QueryCommandOptionsType
) {
  try {
    console.log(chalk.blue(`🔍 Querying collection: ${collectionName}\n`));

    const db = admin.firestore();
    let query: admin.firestore.Query<
      admin.firestore.DocumentData,
      admin.firestore.DocumentData
    > = db.collection(collectionName);

    // Apply where clause
    if (options.where) {
      const [field, operator, value] = options.where.split(",");
      const operatorType = operator.trim() as admin.firestore.WhereFilterOp;
      query = query.where(field.trim(), operatorType, value.trim());
      console.log(chalk.gray(`   └── Filter: ${field} ${operator} ${value}`));
    }

    // Apply limit
    if (options.limit) {
      query = query.limit(parseInt(options.limit));
      console.log(chalk.gray(`   └── Limit: ${options.limit}`));
    }

    // Apply ordering
    if (options.orderBy) {
      const [field, direction] = options.orderBy.split(",");
      const directionType =
        direction?.trim() as admin.firestore.OrderByDirection;

      query = query.orderBy(field.trim(), directionType || "asc");
      console.log(chalk.gray(`   └── Order: ${field} ${direction || "asc"}`));
    }

    const snapshot = await query.get();
    console.log(chalk.cyan(`\n📊 Found ${snapshot.size} documents:\n`));

    // Collect results for JSON output
    const results: any[] = [];

    snapshot.forEach((doc: QueryDocumentSnapshotType) => {
      const docData = {
        id: doc.id,
        data: doc.data(),
        createTime: doc.createTime,
        updateTime: doc.updateTime,
      };

      results.push(docData);

      // Only show console output if not JSON mode
      if (!options.json) {
        console.log(chalk.white(`${results.length}. Document ID: ${doc.id}`));
        const fields = Object.keys(doc.data());
        console.log(chalk.gray(`   Fields: ${fields.join(", ")}`));
        console.log();
      }
    });

    // Handle JSON output
    if (options.json) {
      const output = {
        collection: collectionName,
        query: {
          ...(options.where && { where: options.where }),
          ...(options.limit && { limit: parseInt(options.limit) }),
          ...(options.orderBy && { orderBy: options.orderBy }),
        },
        totalDocuments: snapshot.size,
        results: results,
        timestamp: new Date().toISOString(),
      };

      if (options.output) {
        // Save to file
        const outputFile = options.output.endsWith(".json")
          ? options.output
          : `${options.output}/query_${collectionName}_${Date.now()}.json`;

        fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
        console.log(chalk.green(`📄 Query results saved to: ${outputFile}`));
      } else {
        // Output to console
        console.log(JSON.stringify(output, null, 2));
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(chalk.red("❌ Query failed:"), errorMessage);
    throw error;
  }
}
