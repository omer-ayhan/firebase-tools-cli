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

    // Parse orderBy and where clauses to handle Firebase RTDB limitations
    let orderByField: string | null = null;
    let orderByDirection: 'asc' | 'desc' = 'asc';
    let whereField: string | null = null;
    let whereOperator: string | null = null;
    let whereParsedValue: any = null;

    if (options.orderBy) {
      const [field, direction] = options.orderBy.split(',');
      if (!field) {
        throw new Error('Order by field is required (e.g., "name,asc")');
      }
      orderByField = field;
      orderByDirection = (direction?.toLowerCase() || 'asc') as 'asc' | 'desc';

      if (orderByDirection !== 'asc' && orderByDirection !== 'desc') {
        throw new Error('Order direction must be "asc" or "desc"');
      }
    }

    if (options.where) {
      const [field, operator, value] = options.where.split(',');
      if (!field || !operator || value === undefined) {
        throw new Error(
          'Where clause must be in format "field,operator,value"'
        );
      }
      whereField = field;
      whereOperator = operator;

      // Parse value to appropriate type
      whereParsedValue = value;
      if (value === 'true') whereParsedValue = true;
      else if (value === 'false') whereParsedValue = false;
      else if (value === 'null') whereParsedValue = null;
      else if (!isNaN(Number(value))) whereParsedValue = Number(value);
    }

    // Handle Firebase RTDB query limitations
    if (whereField && orderByField && whereField !== orderByField) {
      // Firebase RTDB doesn't support ordering by one field and filtering by another
      // We'll do post-processing for ordering in this case
      console.log(
        chalk.yellow(
          '⚠️  Firebase RTDB limitation: Cannot order by one field and filter by another field in the same query.'
        )
      );
      console.log(
        chalk.yellow(
          '   Applying filter first, then sorting results in post-processing.'
        )
      );

      // Apply where clause only
      switch (whereOperator) {
        case '==':
        case '=':
          query = query.orderByChild(whereField).equalTo(whereParsedValue);
          break;
        case '>=':
          query = query.orderByChild(whereField).startAt(whereParsedValue);
          break;
        case '<=':
          query = query.orderByChild(whereField).endAt(whereParsedValue);
          break;
        case '>':
          query = query.orderByChild(whereField).startAt(whereParsedValue);
          break;
        case '<':
          query = query.orderByChild(whereField).endAt(whereParsedValue);
          break;
        default:
          throw new Error(
            `Unsupported operator: ${whereOperator}. Supported: ==, >=, <=, >, <`
          );
      }
    } else if (whereField) {
      // Apply where clause (and ordering on the same field if specified)
      switch (whereOperator) {
        case '==':
        case '=':
          query = query.orderByChild(whereField).equalTo(whereParsedValue);
          break;
        case '>=':
          query = query.orderByChild(whereField).startAt(whereParsedValue);
          break;
        case '<=':
          query = query.orderByChild(whereField).endAt(whereParsedValue);
          break;
        case '>':
          query = query.orderByChild(whereField).startAt(whereParsedValue);
          break;
        case '<':
          query = query.orderByChild(whereField).endAt(whereParsedValue);
          break;
        default:
          throw new Error(
            `Unsupported operator: ${whereOperator}. Supported: ==, >=, <=, >, <`
          );
      }
    } else if (orderByField) {
      // Apply ordering only (no where clause)
      query = query.orderByChild(orderByField);
    }

    // Determine if we need post-processing that would conflict with limit
    // Firebase RTDB object results don't preserve order, so we always need post-processing for ordering
    const needsPostProcessSort = orderByField !== null;

    // Apply limit if specified
    let limitNum: number | null = null;
    if (options.limit) {
      limitNum = parseInt(options.limit.toString());
      if (isNaN(limitNum) || limitNum <= 0) {
        throw new Error('Limit must be a positive number');
      }

      // Only apply limit in Firebase if we don't need post-processing
      // Otherwise, we'll apply it after sorting
      if (!needsPostProcessSort) {
        query = query.limitToFirst(limitNum);
      }
    }

    // Execute the query
    const snapshot = await query.once('value');
    let results = snapshot.val();

    if (results === null || results === undefined) {
      console.log(chalk.yellow('⚠️  No data found matching the query'));
      return;
    }

    // Handle primitive values (strings, numbers, booleans)
    const isPrimitive = typeof results !== 'object' || results === null;
    if (isPrimitive) {
      console.log(chalk.green(`✅ Found primitive value at path /${path}\n`));
      console.log(chalk.white(`🔑 Value: ${String(results)}`));
      console.log(chalk.gray(`   └── Type: ${typeof results}`));

      // Show query summary for primitive values
      console.log(chalk.blue('\n📊 Query Summary:'));
      console.log(chalk.gray(`   └── Path: /${path}`));
      console.log(chalk.gray(`   └── Result type: ${typeof results}`));
      console.log(chalk.gray(`   └── Value: ${String(results)}`));
      console.log(
        chalk.gray(`   └── Database: ${rtdbApp.options.databaseURL}`)
      );

      // Handle JSON output for primitive values
      if (options.json) {
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
            type: typeof results,
            isPrimitive: true,
          },
          result: results,
        };
        console.log(JSON.stringify(outputData, null, 2));
      }

      // Handle file output for primitive values
      if (options.output) {
        const outputFile = options.output.endsWith('.json')
          ? options.output
          : `${options.output}.json`;

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
            type: typeof results,
            isPrimitive: true,
          },
          result: results,
        };

        fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
        console.log(chalk.green(`📄 Query results saved to: ${outputFile}`));

        const fileSize = (fs.statSync(outputFile).size / 1024).toFixed(2);
        console.log(chalk.gray(`   └── File size: ${fileSize} KB`));
      }

      return;
    }

    // Post-process for operators that Firebase doesn't support natively
    if (
      whereField &&
      whereOperator &&
      (whereOperator === '>' || whereOperator === '<')
    ) {
      const filteredResults: any = {};
      for (const [key, item] of Object.entries(results)) {
        const fieldValue = (item as any)[whereField];
        if (whereOperator === '>' && fieldValue > whereParsedValue) {
          filteredResults[key] = item;
        } else if (whereOperator === '<' && fieldValue < whereParsedValue) {
          filteredResults[key] = item;
        }
      }
      results = filteredResults;
    }

    // Handle post-processing for ordering
    if (orderByField) {
      // Post-process sorting because Firebase RTDB object results don't preserve order
      const sortedEntries = Object.entries(results).sort(([, a], [, b]) => {
        const aVal = (a as any)[orderByField];
        const bVal = (b as any)[orderByField];

        if (orderByDirection === 'desc') {
          if (aVal > bVal) return -1;
          if (aVal < bVal) return 1;
          return 0;
        } else {
          if (aVal < bVal) return -1;
          if (aVal > bVal) return 1;
          return 0;
        }
      });

      results = Object.fromEntries(sortedEntries);
    }

    // Apply limit after post-processing if needed
    if (limitNum && needsPostProcessSort) {
      const limitedEntries = Object.entries(results).slice(0, limitNum);
      results = Object.fromEntries(limitedEntries);
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

          console.log(chalk.white(`📁 ${key}`));

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
