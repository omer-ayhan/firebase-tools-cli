import chalk from 'chalk';
import * as admin from 'firebase-admin';
import fs from 'fs';

type QueryCommandOptionsType = {
  where?: string;
  limit?: string;
  orderBy?: string;
  field?: string;
  json?: boolean;
  output?: string;
};

type QueryDocumentSnapshotType = admin.firestore.QueryDocumentSnapshot<
  admin.firestore.DocumentData,
  admin.firestore.DocumentData
>;

// Helper function to get nested field value using dot notation
function getNestedFieldValue(obj: any, fieldPath: string): any {
  const keys = fieldPath.split('.');
  let current = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }

    // Handle array indices
    if (!isNaN(Number(key)) && Array.isArray(current)) {
      current = current[Number(key)];
    } else if (typeof current === 'object') {
      current = current[key];
    } else {
      return undefined;
    }
  }

  return current;
}

// Helper function to format field value for display
function formatFieldValue(
  value: any,
  indent: string = '',
  isRoot: boolean = true
): string {
  if (value === null) return chalk.gray('null');
  if (value === undefined) return chalk.gray('undefined');

  if (typeof value === 'string') {
    return chalk.green(`"${value}"`);
  }

  if (typeof value === 'number') {
    return chalk.cyan(value.toString());
  }

  if (typeof value === 'boolean') {
    return value ? chalk.green('true') : chalk.red('false');
  }

  if (value instanceof admin.firestore.Timestamp) {
    const date = value.toDate();
    return chalk.magenta(`${date.toISOString()} (${date.toLocaleString()})`);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return chalk.gray('No items found');
    }

    let result = '';
    if (isRoot) {
      result += chalk.blue(`Array with ${value.length} items:\n`);
    } else {
      result += chalk.blue(`[${value.length} items]\n`);
    }

    // Show ALL items, no truncation
    for (let i = 0; i < value.length; i++) {
      const itemIndent = indent + '  ';
      const itemValue = formatFieldValue(value[i], itemIndent, false);
      result += `${indent}${chalk.yellow(`[${i}]`)} ${itemValue}\n`;
    }

    return result.trim();
  }

  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value);

    if (entries.length === 0) {
      return chalk.gray('(empty object)');
    }

    let result = '';
    if (isRoot) {
      result += chalk.blue(`Object with ${entries.length} fields:\n`);
    } else {
      result += chalk.blue(`{${entries.length} fields}\n`);
    }

    // Show ALL fields, no truncation
    for (let i = 0; i < entries.length; i++) {
      const [key, val] = entries[i];
      const fieldIndent = indent + '  ';
      const fieldValue = formatFieldValue(val, fieldIndent, false);
      result += `${indent}${chalk.white(key)}: ${fieldValue}\n`;
    }

    return result.trim();
  }

  return chalk.white(String(value));
}

export async function queryCollection(
  collectionPath: string[],
  options: QueryCommandOptionsType
) {
  try {
    const collectionPathStr = collectionPath.join(' => ');
    console.log(chalk.blue(`🔍 Querying Firestore: ${collectionPathStr}\n`));

    const db = admin.firestore();

    // Check if we're querying a document or a collection
    const isDocumentQuery = collectionPath.length % 2 === 0;

    if (isDocumentQuery) {
      // Even number of segments means we're querying a specific document
      await queryDocument(db, collectionPath, options, collectionPathStr);
    } else {
      // Odd number of segments means we're querying a collection
      if (options.field) {
        console.log(
          chalk.yellow(
            '⚠️  --field option is only available for document queries, not collection queries'
          )
        );
        console.log(
          chalk.gray(
            '   Use an even number of path segments to query a specific document\n'
          )
        );
      }
      await queryCollectionData(db, collectionPath, options, collectionPathStr);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(chalk.red('❌ Query failed:'), errorMessage);
    throw error;
  }
}

async function queryDocument(
  db: admin.firestore.Firestore,
  collectionPath: string[],
  options: QueryCommandOptionsType,
  collectionPathStr: string
) {
  // Build document reference
  let docRef: admin.firestore.DocumentReference = db
    .collection(collectionPath[0])
    .doc(collectionPath[1]);

  // Build nested document reference if needed
  for (let i = 2; i < collectionPath.length; i += 2) {
    docRef = docRef.collection(collectionPath[i]).doc(collectionPath[i + 1]);
  }

  const docSnapshot = await docRef.get();

  if (!docSnapshot.exists) {
    console.log(chalk.yellow('⚠️  Document not found'));
    return;
  }

  console.log(chalk.green(`✅ Document found\n`));

  const documentData = docSnapshot.data();

  // Handle field-specific query
  if (options.field && documentData) {
    let fieldValue = getNestedFieldValue(documentData, options.field);

    if (fieldValue === undefined) {
      console.log(
        chalk.yellow(`⚠️  Field '${options.field}' not found in document`)
      );
      return;
    }

    console.log(chalk.white(`📄 Document: ${docSnapshot.id}`));
    console.log(chalk.gray(`   └── Path: ${docSnapshot.ref.path}`));
    console.log(chalk.cyan(`   └── Field: ${options.field}`));

    // Apply filtering, ordering, and limiting if specified
    let processedFieldValue = fieldValue;
    let appliedFilters: string[] = [];

    // Handle filtering and ordering for arrays and objects
    if (Array.isArray(fieldValue)) {
      let filteredArray = [...fieldValue];
      let originalLength = filteredArray.length;

      // Apply where clause filtering
      if (options.where) {
        const [filterField, operator, value] = options.where.split(',');
        if (!filterField || !operator || value === undefined) {
          throw new Error(
            'Where clause must be in format "field,operator,value" (e.g., "page_type,==,question-page_v1")'
          );
        }

        const trimmedField = filterField.trim();
        const trimmedOperator = operator.trim();
        let parsedValue: any = value.trim();

        // Parse value to appropriate type (similar to collection queries)
        if (parsedValue === 'true') parsedValue = true;
        else if (parsedValue === 'false') parsedValue = false;
        else if (parsedValue === 'null') parsedValue = null;
        else if (!isNaN(Number(parsedValue)) && parsedValue.length <= 15) {
          // Only convert to number if it's not too long to avoid precision loss
          parsedValue = Number(parsedValue);
        }

        filteredArray = filteredArray.filter((item) => {
          if (typeof item !== 'object' || item === null) {
            return false; // Can't filter non-objects
          }

          const itemValue = getNestedFieldValue(item, trimmedField);

          switch (trimmedOperator) {
            case '==':
            case '=':
              return itemValue === parsedValue;
            case '!=':
              return itemValue !== parsedValue;
            case '>':
              return itemValue > parsedValue;
            case '>=':
              return itemValue >= parsedValue;
            case '<':
              return itemValue < parsedValue;
            case '<=':
              return itemValue <= parsedValue;
            case 'array-contains':
              return (
                Array.isArray(itemValue) && itemValue.includes(parsedValue)
              );
            case 'in':
              // For 'in' operator, expect comma-separated values
              const inValues = parsedValue
                .split('|')
                .map((v: string) => v.trim());
              return inValues.includes(itemValue);
            default:
              throw new Error(
                `Unsupported operator: ${trimmedOperator}. Supported: ==, !=, >, >=, <, <=, array-contains, in`
              );
          }
        });

        appliedFilters.push(
          `Filter: ${trimmedField} ${trimmedOperator} ${parsedValue} (${filteredArray.length}/${originalLength} items)`
        );
      }

      // Apply ordering
      if (options.orderBy) {
        const [orderField, direction] = options.orderBy.split(',');
        if (!orderField) {
          throw new Error(
            'Order by field is required (e.g., "page_order,asc" or "page_order,desc")'
          );
        }

        const trimmedField = orderField.trim();
        const orderDirection = (direction?.trim() || 'asc').toLowerCase();

        if (orderDirection !== 'asc' && orderDirection !== 'desc') {
          throw new Error('Order direction must be "asc" or "desc"');
        }

        filteredArray.sort((a, b) => {
          if (
            typeof a !== 'object' ||
            typeof b !== 'object' ||
            a === null ||
            b === null
          ) {
            return 0; // Can't sort non-objects
          }

          const aVal = getNestedFieldValue(a, trimmedField);
          const bVal = getNestedFieldValue(b, trimmedField);

          // Handle undefined/null values (put them at the end)
          if (aVal === undefined || aVal === null) {
            if (bVal === undefined || bVal === null) return 0;
            return 1;
          }
          if (bVal === undefined || bVal === null) return -1;

          if (orderDirection === 'desc') {
            if (aVal > bVal) return -1;
            if (aVal < bVal) return 1;
            return 0;
          } else {
            if (aVal < bVal) return -1;
            if (aVal > bVal) return 1;
            return 0;
          }
        });

        appliedFilters.push(`Order: ${trimmedField} ${orderDirection}`);
      }

      // Apply limit
      if (options.limit) {
        const limitNum = parseInt(options.limit);
        if (isNaN(limitNum) || limitNum <= 0) {
          throw new Error('Limit must be a positive number');
        }

        const beforeLimit = filteredArray.length;
        filteredArray = filteredArray.slice(0, limitNum);
        appliedFilters.push(
          `Limit: ${limitNum} (showing ${filteredArray.length}/${beforeLimit} items)`
        );
      }

      processedFieldValue = filteredArray;
    } else if (typeof fieldValue === 'object' && fieldValue !== null) {
      // For objects, we can filter the object properties
      if (options.where || options.orderBy || options.limit) {
        console.log(
          chalk.yellow(
            '⚠️  Filtering, ordering, and limiting are only supported for array fields'
          )
        );
        console.log(
          chalk.gray(
            `   Field '${options.field}' is an object. Use array fields for filtering/ordering.`
          )
        );
      }
    } else {
      // For primitive values, filtering doesn't make sense
      if (options.where || options.orderBy || options.limit) {
        console.log(
          chalk.yellow(
            '⚠️  Filtering, ordering, and limiting are only supported for array fields'
          )
        );
        console.log(
          chalk.gray(
            `   Field '${options.field}' is a primitive value. Use array fields for filtering/ordering.`
          )
        );
      }
    }

    // Show applied filters
    if (appliedFilters.length > 0) {
      console.log();
      for (const filter of appliedFilters) {
        console.log(chalk.gray(`   └── ${filter}`));
      }
    }

    console.log();

    // Show field value
    if (!options.json) {
      console.log(chalk.white('🔍 Field Value:'));
      console.log();
      const formattedValue = formatFieldValue(processedFieldValue);
      console.log(formattedValue);
      console.log();
    }

    // Prepare output data for field query
    const outputData = {
      type: 'document_field',
      path: collectionPathStr,
      documentPath: docSnapshot.ref.path,
      field: options.field,
      fieldValue: processedFieldValue,
      originalFieldValue: fieldValue, // Keep original for reference
      query: {
        ...(options.where && { where: options.where }),
        ...(options.orderBy && { orderBy: options.orderBy }),
        ...(options.limit && { limit: parseInt(options.limit) }),
      },
      document: {
        id: docSnapshot.id,
        createTime: docSnapshot.createTime,
        updateTime: docSnapshot.updateTime,
      },
      timestamp: new Date().toISOString(),
    };

    // Handle file output
    if (options.output) {
      const outputFile = options.output.endsWith('.json')
        ? options.output
        : `${options.output}.json`;

      fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
      console.log(chalk.green(`📄 Field data saved to: ${outputFile}`));

      const fileSize = (fs.statSync(outputFile).size / 1024).toFixed(2);
      console.log(chalk.gray(`   └── File size: ${fileSize} KB`));
    }

    // Handle JSON console output
    if (options.json) {
      console.log(JSON.stringify(outputData, null, 2));
    } else if (!options.output) {
      // Show detailed summary only if not in JSON mode and no file output
      console.log(chalk.blue('📊 Field Query Summary:'));
      console.log(chalk.gray(`   └── Document ID: ${docSnapshot.id}`));
      console.log(chalk.gray(`   └── Path: ${docSnapshot.ref.path}`));
      console.log(chalk.gray(`   └── Field: ${options.field}`));
      console.log(
        chalk.gray(
          `   └── Field Type: ${
            Array.isArray(processedFieldValue)
              ? 'Array'
              : typeof processedFieldValue
          }`
        )
      );
      if (Array.isArray(processedFieldValue)) {
        console.log(
          chalk.gray(`   └── Array Length: ${processedFieldValue.length}`)
        );
        if (
          Array.isArray(fieldValue) &&
          processedFieldValue.length !== fieldValue.length
        ) {
          console.log(
            chalk.gray(`   └── Original Length: ${fieldValue.length}`)
          );
        }
      } else if (
        typeof processedFieldValue === 'object' &&
        processedFieldValue !== null
      ) {
        console.log(
          chalk.gray(
            `   └── Object Keys: ${Object.keys(processedFieldValue).length}`
          )
        );
      }
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

    return;
  }

  // Regular document query (no specific field)
  const docData = {
    id: docSnapshot.id,
    data: docSnapshot.data(),
    createTime: docSnapshot.createTime,
    updateTime: docSnapshot.updateTime,
    path: docSnapshot.ref.path,
  };

  // Show console output if not JSON mode
  if (!options.json) {
    console.log(chalk.white(`📄 Document: ${docSnapshot.id}`));
    console.log(chalk.gray(`   └── Path: ${docSnapshot.ref.path}`));
    console.log();

    // Show field values in detail
    const data = docSnapshot.data();
    if (data) {
      const entries = Object.entries(data);

      for (const [key, value] of entries) {
        let displayValue: string;

        if (typeof value === 'object' && value !== null) {
          // Handle nested objects
          if (Array.isArray(value)) {
            displayValue = `[Array with ${value.length} items]`;
          } else if (value instanceof admin.firestore.Timestamp) {
            displayValue = `${value.toDate().toISOString()}`;
          } else {
            displayValue = `[Object with ${Object.keys(value).length} keys]`;
          }
        } else if (typeof value === 'string' && value.length > 100) {
          // Truncate long strings
          displayValue = `${value.substring(0, 100)}...`;
        } else {
          displayValue = String(value);
        }

        console.log(chalk.gray(`   └── ${key}: ${displayValue}`));
      }
    }
    console.log();
  }

  // Prepare output data
  const outputData = {
    type: 'document',
    path: collectionPathStr,
    documentPath: docSnapshot.ref.path,
    document: docData,
    timestamp: new Date().toISOString(),
  };

  // Handle file output
  if (options.output) {
    const outputFile = options.output.endsWith('.json')
      ? options.output
      : `${options.output}.json`;

    fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
    console.log(chalk.green(`📄 Document data saved to: ${outputFile}`));

    const fileSize = (fs.statSync(outputFile).size / 1024).toFixed(2);
    console.log(chalk.gray(`   └── File size: ${fileSize} KB`));
  }

  // Handle JSON console output
  if (options.json) {
    console.log(JSON.stringify(outputData, null, 2));
  } else if (!options.output) {
    // Show detailed summary only if not in JSON mode and no file output
    console.log(chalk.blue('📊 Document Summary:'));
    console.log(chalk.gray(`   └── Document ID: ${docSnapshot.id}`));
    console.log(chalk.gray(`   └── Path: ${docSnapshot.ref.path}`));
    const documentData = docSnapshot.data();
    console.log(
      chalk.gray(
        `   └── Fields: ${documentData ? Object.keys(documentData).length : 0}`
      )
    );
    console.log(chalk.gray(`   └── Project: ${admin.app().options.projectId}`));
  }
}

async function queryCollectionData(
  db: admin.firestore.Firestore,
  collectionPath: string[],
  options: QueryCommandOptionsType,
  collectionPathStr: string
) {
  // Build the collection reference based on the path segments
  let query: admin.firestore.Query<
    admin.firestore.DocumentData,
    admin.firestore.DocumentData
  >;

  if (collectionPath.length === 1) {
    // Simple top-level collection
    query = db.collection(collectionPath[0]);
  } else {
    // Nested collection path
    let ref:
      | admin.firestore.DocumentReference
      | admin.firestore.CollectionReference = db.collection(collectionPath[0]);

    for (let i = 1; i < collectionPath.length; i += 2) {
      // We have both document and subcollection
      ref = (ref as admin.firestore.CollectionReference)
        .doc(collectionPath[i])
        .collection(collectionPath[i + 1]);
    }
    query = ref as admin.firestore.Query<
      admin.firestore.DocumentData,
      admin.firestore.DocumentData
    >;
  }

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
    const directionType = direction?.trim() as admin.firestore.OrderByDirection;

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
    type: 'collection',
    collection: collectionPathStr,
    collectionPath: collectionPath,
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
    console.log(chalk.gray(`   └── Collection: ${collectionPathStr}`));
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
    console.log(chalk.gray(`   └── Project: ${admin.app().options.projectId}`));
  }
}
