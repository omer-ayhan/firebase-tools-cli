const fs = require("fs");
const chalk = require("chalk");
const admin = require("firebase-admin");

async function queryCollection(collectionName, options) {
  try {
    console.log(chalk.blue(`🔍 Querying collection: ${collectionName}\n`));

    const db = admin.firestore();
    let query = db.collection(collectionName);

    // Apply where clause
    if (options.where) {
      const [field, operator, value] = options.where.split(",");
      query = query.where(field.trim(), operator.trim(), value.trim());
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
      query = query.orderBy(field.trim(), direction?.trim() || "asc");
      console.log(chalk.gray(`   └── Order: ${field} ${direction || "asc"}`));
    }

    const snapshot = await query.get();
    console.log(chalk.cyan(`\n📊 Found ${snapshot.size} documents:\n`));

    // Collect results for JSON output
    const results = [];

    snapshot.forEach((doc, index) => {
      const docData = {
        id: doc.id,
        data: doc.data(),
        createTime: doc.createTime,
        updateTime: doc.updateTime,
      };

      results.push(docData);

      // Only show console output if not JSON mode
      if (!options.json) {
        console.log(chalk.white(`${index + 1}. Document ID: ${doc.id}`));
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
    console.error(chalk.red("❌ Query failed:"), error.message);
    throw error;
  }
}

module.exports = queryCollection;
