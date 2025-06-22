import chalk from 'chalk';
import * as admin from 'firebase-admin';
import fs from 'fs';

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
    console.log(
      chalk.blue(`🔍 Querying Firestore collection: ${collectionName}\n`)
    );

    const db = admin.firestore();
    let query: admin.firestore.Query<
      admin.firestore.DocumentData,
      admin.firestore.DocumentData
    > = db.collection(collectionName);

    // Apply where clause
    if (options.where) {
      const [field, operator, value] = options.where.split(',');
      const operatorType = operator.trim() as admin.firestore.WhereFilterOp;

      // Parse value to appropriate type
      let parsedValue: any = value.trim();
      if (parsedValue === 'true') parsedValue = true;
      else if (parsedValue === 'false') parsedValue = false;
      else if (parsedValue === 'null') parsedValue = null;
      else if (!isNaN(Number(parsedValue))) parsedValue = Number(parsedValue);

      query = query.where(field.trim(), operatorType, parsedValue);
      console.log(
        chalk.gray(`   └── Filter: ${field} ${operator} ${parsedValue}`)
      );
    }

    // Apply limit
    if (options.limit) {
      query = query.limit(parseInt(options.limit));
      console.log(chalk.gray(`   └── Limit: ${options.limit}`));
    }

    // Apply ordering
    if (options.orderBy) {
      const [field, direction] = options.orderBy.split(',');
      const directionType =
        direction?.trim() as admin.firestore.OrderByDirection;

      query = query.orderBy(field.trim(), directionType || 'asc');
      console.log(chalk.gray(`   └── Order: ${field} ${direction || 'asc'}`));
    }

    const snapshot = await query.get();

    if (snapshot.size === 0) {
      console.log(chalk.yellow('⚠️  No documents found matching the query'));
      return;
    }

    console.log(chalk.green(`✅ Found ${snapshot.size} document(s)\n`));

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
        console.log(chalk.white(`📁 ${doc.id}`));

        // Show field values in detail (similar to RTDB output)
        const data = doc.data();
        const entries = Object.entries(data);

        // Show up to 10 fields to prevent overwhelming output
        const maxDisplay = 10;
        const displayEntries = entries.slice(0, maxDisplay);

        for (const [key, value] of displayEntries) {
          let displayValue: string;

          if (typeof value === 'object' && value !== null) {
            // Handle nested objects
            if (Array.isArray(value)) {
              displayValue = `[Array with ${value.length} items]`;
            } else {
              displayValue = `[Object with ${Object.keys(value).length} keys]`;
            }
          } else if (typeof value === 'string' && value.length > 50) {
            // Truncate long strings
            displayValue = `${value.substring(0, 50)}...`;
          } else {
            displayValue = String(value);
          }

          console.log(chalk.gray(`   └── ${key}: ${displayValue}`));
        }

        // Show if there are more fields
        if (entries.length > maxDisplay) {
          console.log(
            chalk.gray(
              `   └── ... and ${entries.length - maxDisplay} more fields`
            )
          );
        }

        console.log();
      }
    });

    // Prepare output data
    const outputData = {
      collection: collectionName,
      query: {
        ...(options.where && { where: options.where }),
        ...(options.limit && { limit: parseInt(options.limit) }),
        ...(options.orderBy && { orderBy: options.orderBy }),
      },
      summary: {
        totalDocuments: snapshot.size,
      },
      results: results,
      timestamp: new Date().toISOString(),
    };

    // Handle file output
    if (options.output) {
      const outputFile = options.output.endsWith('.json')
        ? options.output
        : `${options.output}.json`;

      fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
      console.log(chalk.green(`📄 Query results saved to: ${outputFile}`));

      const fileSize = (fs.statSync(outputFile).size / 1024).toFixed(2);
      console.log(chalk.gray(`   └── File size: ${fileSize} KB`));
    }

    // Handle JSON console output
    if (options.json) {
      console.log(JSON.stringify(outputData, null, 2));
    } else if (!options.output) {
      // Show detailed summary only if not in JSON mode and no file output
      console.log(chalk.blue('📊 Query Summary:'));
      console.log(chalk.gray(`   └── Collection: ${collectionName}`));
      console.log(chalk.gray(`   └── Total documents: ${snapshot.size}`));
      if (options.where) {
        console.log(chalk.gray(`   └── Where: ${options.where}`));
      }
      if (options.orderBy) {
        console.log(chalk.gray(`   └── Order by: ${options.orderBy}`));
      }
      if (options.limit) {
        console.log(chalk.gray(`   └── Limit: ${options.limit}`));
      }
      console.log(
        chalk.gray(`   └── Project: ${admin.app().options.projectId}`)
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(chalk.red('❌ Query failed:'), errorMessage);
    throw error;
  }
}
