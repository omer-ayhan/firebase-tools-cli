import chalk from 'chalk';
import * as admin from 'firebase-admin';
import fs from 'fs';

type QueryRTDBOptionsType = {
  where?: string;
  limit?: number;
  orderBy?: string;
  json?: boolean;
  output?: string;
};

export async function queryRealtimeDatabase(
  path: string,
  options: QueryRTDBOptionsType
) {
  try {
    console.log(chalk.blue(`🔍 Querying Realtime Database path: /${path}\n`));

    const rtdbApp = admin.app('rtdb-app');
    const rtdb = rtdbApp.database();

    // Start with the base reference
    let query: admin.database.Query | admin.database.Reference = rtdb.ref(path);

    // Apply ordering if specified
    if (options.orderBy) {
      const [field, direction] = options.orderBy.split(',');
      if (!field) {
        throw new Error('Order by field is required (e.g., "name,asc")');
      }

      const dir = direction?.toLowerCase() || 'asc';
      if (dir === 'asc') {
        query = query.orderByChild(field);
      } else if (dir === 'desc') {
        // Firebase RTDB doesn't have native desc ordering, we'll handle this in post-processing
        query = query.orderByChild(field);
      } else {
        throw new Error('Order direction must be "asc" or "desc"');
      }
    }

    // Apply where clause if specified
    if (options.where) {
      const [field, operator, value] = options.where.split(',');
      if (!field || !operator || value === undefined) {
        throw new Error(
          'Where clause must be in format "field,operator,value"'
        );
      }

      // Parse value to appropriate type
      let parsedValue: any = value;
      if (value === 'true') parsedValue = true;
      else if (value === 'false') parsedValue = false;
      else if (value === 'null') parsedValue = null;
      else if (!isNaN(Number(value))) parsedValue = Number(value);

      // Apply Firebase RTDB query operators
      switch (operator) {
        case '==':
        case '=':
          query = query.orderByChild(field).equalTo(parsedValue);
          break;
        case '>=':
          query = query.orderByChild(field).startAt(parsedValue);
          break;
        case '<=':
          query = query.orderByChild(field).endAt(parsedValue);
          break;
        case '>':
          // Firebase doesn't have direct > operator, we'll filter in post-processing
          query = query.orderByChild(field).startAt(parsedValue);
          break;
        case '<':
          // Firebase doesn't have direct < operator, we'll filter in post-processing
          query = query.orderByChild(field).endAt(parsedValue);
          break;
        default:
          throw new Error(
            `Unsupported operator: ${operator}. Supported: ==, >=, <=, >, <`
          );
      }
    }

    // Apply limit if specified
    if (options.limit) {
      const limitNum = parseInt(options.limit.toString());
      if (isNaN(limitNum) || limitNum <= 0) {
        throw new Error('Limit must be a positive number');
      }
      query = query.limitToFirst(limitNum);
    }

    // Execute the query
    const snapshot = await query.once('value');
    let results = snapshot.val();

    if (!results) {
      console.log(chalk.yellow('⚠️  No data found matching the query'));
      return;
    }

    // Post-process for operators that Firebase doesn't support natively
    if (options.where) {
      const [field, operator, value] = options.where.split(',');
      let parsedValue: any = value;
      if (value === 'true') parsedValue = true;
      else if (value === 'false') parsedValue = false;
      else if (value === 'null') parsedValue = null;
      else if (!isNaN(Number(value))) parsedValue = Number(value);

      if (operator === '>' || operator === '<') {
        const filteredResults: any = {};
        for (const [key, item] of Object.entries(results)) {
          const fieldValue = (item as any)[field];
          if (operator === '>' && fieldValue > parsedValue) {
            filteredResults[key] = item;
          } else if (operator === '<' && fieldValue < parsedValue) {
            filteredResults[key] = item;
          }
        }
        results = filteredResults;
      }
    }

    // Handle descending order (post-process since Firebase doesn't support it natively)
    if (options.orderBy) {
      const [field, direction] = options.orderBy.split(',');
      const dir = direction?.toLowerCase() || 'asc';

      if (dir === 'desc') {
        const sortedEntries = Object.entries(results).sort(([, a], [, b]) => {
          const aVal = (a as any)[field];
          const bVal = (b as any)[field];
          if (aVal > bVal) return -1;
          if (aVal < bVal) return 1;
          return 0;
        });

        results = Object.fromEntries(sortedEntries);
      }
    }

    // Count results
    const resultCount = Object.keys(results).length;

    // Prepare output data
    const outputData = {
      database: rtdbApp.options.databaseURL,
      path: `/${path}`,
      timestamp: new Date().toISOString(),
      query: {
        where: options.where || null,
        orderBy: options.orderBy || null,
        limit: options.limit || null,
      },
      summary: {
        totalResults: resultCount,
      },
      results: results,
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
    } else {
      // Display results in a readable format
      console.log(chalk.green(`✅ Found ${resultCount} result(s)\n`));

      if (resultCount > 0) {
        let displayCount = 0;
        const maxDisplay = 10; // Limit console display to prevent overwhelming output

        for (const [key, value] of Object.entries(results)) {
          if (displayCount >= maxDisplay) {
            console.log(
              chalk.gray(`... and ${resultCount - maxDisplay} more results`)
            );
            console.log(
              chalk.gray('Use --json or --output flags to see all results')
            );
            break;
          }

          console.log(chalk.white(`🔑 ${key}`));

          if (typeof value === 'object' && value !== null) {
            // Show object structure
            const entries = Object.entries(value as any).slice(0, 5);
            for (const [subKey, subValue] of entries) {
              const displayValue =
                typeof subValue === 'string' && subValue.length > 50
                  ? `${subValue.substring(0, 50)}...`
                  : String(subValue);
              console.log(chalk.gray(`   └── ${subKey}: ${displayValue}`));
            }

            if (Object.keys(value as any).length > 5) {
              console.log(
                chalk.gray(
                  `   └── ... and ${
                    Object.keys(value as any).length - 5
                  } more fields`
                )
              );
            }
          } else {
            console.log(chalk.gray(`   └── Value: ${String(value)}`));
          }

          console.log();
          displayCount++;
        }
      }

      // Show query summary
      console.log(chalk.blue('📊 Query Summary:'));
      console.log(chalk.gray(`   └── Path: /${path}`));
      console.log(chalk.gray(`   └── Total results: ${resultCount}`));
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
        chalk.gray(`   └── Database: ${rtdbApp.options.databaseURL}`)
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(chalk.red('❌ Failed to query database:'), errorMessage);

    if (errorMessage.includes('PERMISSION_DENIED')) {
      console.log(chalk.yellow('💡 Make sure:'));
      console.log(
        chalk.gray('   • Your account has Realtime Database read access')
      );
      console.log(
        chalk.gray(
          '   • Database rules allow read access to the specified path'
        )
      );
    } else if (errorMessage.includes('INDEX_NOT_DEFINED')) {
      console.log(
        chalk.yellow(
          '💡 You may need to add an index for this query in Firebase Console'
        )
      );
    }

    throw error;
  }
}
