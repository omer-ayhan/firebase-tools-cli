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

// Helper function to format values for display without truncation
function formatValueForDisplay(value: any, indent: string = '   '): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      if (value.length === 0) return '[]';
      const items = value
        .map(
          (item, index) =>
            `${indent}  [${index}]: ${formatValueForDisplay(
              item,
              indent + '  '
            )}`
        )
        .join('\n');
      return `[\n${items}\n${indent}]`;
    } else {
      const entries = Object.entries(value);
      if (entries.length === 0) return '{}';
      const items = entries
        .map(
          ([key, val]) =>
            `${indent}  ${key}: ${formatValueForDisplay(val, indent + '  ')}`
        )
        .join('\n');
      return `{\n${items}\n${indent}}`;
    }
  }

  if (typeof value === 'string') {
    return `"${value}"`;
  }

  return String(value);
}

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
        throw new Error(
          'Order by field is required (e.g., "name,asc" or "workouts/appVersion,desc")'
        );
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
          'Where clause must be in format "field,operator,value" (e.g., "workouts/appVersion,==,2.3.1")'
        );
      }
      whereField = field;
      whereOperator = operator;

      // Parse value to appropriate type
      whereParsedValue = value;
      if (value === 'true') whereParsedValue = true;
      else if (value === 'false') whereParsedValue = false;
      else if (value === 'null') whereParsedValue = null;
      else if (!isNaN(Number(value)) && value.length <= 15) {
        // Only convert to number if it's not too long to avoid precision loss
        // JavaScript numbers lose precision for very large integers
        whereParsedValue = Number(value);
      }
    }

    // Helper function to get nested field value
    function getNestedValue(obj: any, fieldPath: string): any {
      const parts = fieldPath.split('/');
      let current = obj;
      for (const part of parts) {
        if (
          current === null ||
          current === undefined ||
          typeof current !== 'object'
        ) {
          return undefined;
        }
        current = current[part];
      }
      return current;
    }

    // Determine if we need to use post-processing for nested fields
    const isNestedWhereField = whereField && whereField.includes('/');
    const isNestedOrderField = orderByField && orderByField.includes('/');
    const needsPostProcessing = isNestedWhereField || isNestedOrderField;

    if (needsPostProcessing) {
      console.log(
        chalk.yellow(
          '🔍 Detected nested field query - using post-processing for accurate results'
        )
      );

      if (isNestedWhereField) {
        console.log(
          chalk.gray(`   └── Filtering by nested field: ${whereField}`)
        );
      }
      if (isNestedOrderField) {
        console.log(
          chalk.gray(`   └── Ordering by nested field: ${orderByField}`)
        );
      }
    }

    // Handle Firebase RTDB query limitations
    if (
      whereField &&
      orderByField &&
      whereField !== orderByField &&
      !needsPostProcessing
    ) {
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

      // Apply where clause only (for non-nested fields)
      if (!isNestedWhereField) {
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
      }
    } else if (whereField && !isNestedWhereField) {
      // Apply where clause (and ordering on the same field if specified) for non-nested fields
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
    } else if (orderByField && !isNestedOrderField) {
      // Apply ordering only (no where clause) for non-nested fields
      query = query.orderByChild(orderByField);
    }

    // Determine if we need post-processing that would conflict with limit
    const needsPostProcessSort = orderByField !== null || needsPostProcessing;

    // Apply limit if specified
    let limitNum: number | null = null;
    if (options.limit) {
      limitNum = parseInt(options.limit.toString());
      if (isNaN(limitNum) || limitNum <= 0) {
        throw new Error('Limit must be a positive number');
      }

      // Only apply limit in Firebase if we don't need post-processing
      // Otherwise, we'll apply it after sorting/filtering
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

    // Post-process for nested field filtering or operators that Firebase doesn't support natively
    if (whereField && whereOperator) {
      const filteredResults: any = {};
      let matchCount = 0;

      for (const [key, item] of Object.entries(results)) {
        let fieldValue: any;

        if (isNestedWhereField) {
          // Handle nested field paths
          fieldValue = getNestedValue(item, whereField);
        } else {
          // Handle simple field paths
          fieldValue = (item as any)[whereField];
        }

        let shouldInclude = false;

        switch (whereOperator) {
          case '==':
          case '=':
            shouldInclude = fieldValue === whereParsedValue;
            break;
          case '>=':
            shouldInclude = fieldValue >= whereParsedValue;
            break;
          case '<=':
            shouldInclude = fieldValue <= whereParsedValue;
            break;
          case '>':
            shouldInclude = fieldValue > whereParsedValue;
            break;
          case '<':
            shouldInclude = fieldValue < whereParsedValue;
            break;
          default:
            throw new Error(
              `Unsupported operator: ${whereOperator}. Supported: ==, >=, <=, >, <`
            );
        }

        if (shouldInclude) {
          filteredResults[key] = item;
          matchCount++;
        }
      }

      results = filteredResults;
    }

    // Handle post-processing for ordering (both nested and non-nested)
    if (orderByField) {
      // Post-process sorting because Firebase RTDB object results don't preserve order
      const sortedEntries = Object.entries(results).sort(([, a], [, b]) => {
        let aVal: any;
        let bVal: any;

        if (isNestedOrderField) {
          // Handle nested field paths
          aVal = getNestedValue(a, orderByField);
          bVal = getNestedValue(b, orderByField);
        } else {
          // Handle simple field paths
          aVal = (a as any)[orderByField];
          bVal = (b as any)[orderByField];
        }

        // Handle undefined/null values (put them at the end)
        if (aVal === undefined || aVal === null) {
          if (bVal === undefined || bVal === null) return 0;
          return 1;
        }
        if (bVal === undefined || bVal === null) return -1;

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

    // Determine if this is a single field/record or a collection
    const entries = Object.entries(results);

    // For queries with where clauses, we should generally treat results as collections
    // unless it's clearly a primitive value or simple field access
    const hasWhereClause = options.where !== undefined;
    const isUserCollection = path === 'users' || path.startsWith('users/');

    const isCollection =
      entries.length > 1 ||
      hasWhereClause || // If we're filtering, treat as collection
      isUserCollection || // User paths are typically collections
      (entries.length === 1 &&
        entries.some(
          ([key, value]) =>
            typeof value === 'object' &&
            value !== null &&
            Object.keys(value as any).some(
              (subKey) =>
                typeof (value as any)[subKey] === 'object' &&
                (value as any)[subKey] !== null
            )
        ));

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
        isCollection: isCollection,
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
      if (isCollection) {
        // Collection output format
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
              // Show full object structure without truncation
              const entries = Object.entries(value as any);
              for (const [subKey, subValue] of entries) {
                const displayValue = formatValueForDisplay(subValue);
                console.log(chalk.gray(`   └── ${subKey}: ${displayValue}`));
              }
            } else {
              console.log(chalk.gray(`   └── Value: ${String(value)}`));
            }

            console.log();
            displayCount++;
          }
        }
      } else {
        // Single field/record output format
        console.log(chalk.green(`✅ Found field data at path /${path}\n`));

        if (resultCount === 1) {
          const [fieldKey, fieldValue] = entries[0];
          console.log(chalk.white(`🔑 Field: ${fieldKey}`));

          if (typeof fieldValue === 'object' && fieldValue !== null) {
            // Show all properties of the single field without truncation
            const fieldEntries = Object.entries(fieldValue as any);
            for (const [propKey, propValue] of fieldEntries) {
              const displayValue = formatValueForDisplay(propValue);
              console.log(chalk.gray(`   └── ${propKey}: ${displayValue}`));
            }

            if (fieldEntries.length === 0) {
              console.log(chalk.gray(`   └── Empty object`));
            }
          } else {
            console.log(chalk.gray(`   └── Value: ${String(fieldValue)}`));
            console.log(chalk.gray(`   └── Type: ${typeof fieldValue}`));
          }
        } else {
          // Multiple simple key-value pairs (likely field properties)
          console.log(chalk.white(`📄 Field Properties:`));
          for (const [key, value] of entries) {
            const displayValue = formatValueForDisplay(value);
            console.log(chalk.gray(`   └── ${key}: ${displayValue}`));
          }
        }

        console.log('\n');
      }

      // Show query summary
      console.log(chalk.blue('📊 Query Summary:'));
      console.log(chalk.gray(`   └── Path: /${path}`));
      console.log(
        chalk.gray(
          `   └── Result type: ${isCollection ? 'Collection' : 'Field'}`
        )
      );
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
