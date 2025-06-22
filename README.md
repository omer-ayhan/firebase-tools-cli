# firebase-tools-cli

[![NPM version][npm-image]][npm-url]
[![License][license-image]][license-url]
[![Node Version][node-badge]][npm]
[![NPM version][npm-badge]][npm]

> CLI tool for Firebase to manage Firestore, Remote Config, and Realtime Database

## Installation

```bash
npm install -g firebase-tools-cli
```

## Setup

1. Generate a service account from within the settings section of the Firebase console
2. Save the service account to `serviceAccountKey.json` within your firebase project repo (or set `SERVICE_ACCOUNT` environment variable)
3. Make sure you add `serviceAccountKey.json` to your `.gitignore` so it is not committed as part of your changes - **THIS IS EXTREMELY IMPORTANT**

## Usage

firebase-tools-cli should be used the same way that [firebase-tools](https://github.com/firebase/firebase-tools) is used - the API is as close to the same as possible:

```bash
# Export all collections
firebase-tools-cli export --limit-to-last 10 /users

# Import data
firebase-tools-cli import ./data.json

# Query collections
firebase-tools-cli query users --where "age,>=,18" --limit 10

# List collections
firebase-tools-cli list

# Remote Config operations
firebase-tools-cli remote-config:convert config.json --add-conditions
```

## Commands

### Authentication

- `firebase-tools-cli login` - Interactive authentication setup
  - `--force` - Force re-authentication
- `firebase-tools-cli reset` - Reset configuration and credentials
  - `--config-only` - Reset only configuration
  - `--credentials-only` - Reset only credentials

### Firestore Operations

- `firebase-tools-cli export` - Export all collections

  - `-o, --output <dir>` - Output directory (default: ./)
  - `--no-detailed` - Skip detailed format export
  - `--no-importable` - Skip importable format export
  - `--no-subcollections` - Skip subcollections
  - `-e, --exclude <collections...>` - Exclude specific collections

- `firebase-tools-cli import <file>` - Import data from JSON file

  - `-b, --batch-size <size>` - Batch size for imports (default: 500)
  - `-m, --merge` - Merge documents instead of overwriting
  - `-e, --exclude <collections...>` - Exclude specific collections

- `firebase-tools-cli query <collection>` - Query a specific collection
  - `-w, --where <field,operator,value>` - Where clause (e.g., "age,>=,18")
    - Supported operators: `==`, `!=`, `>=`, `<=`, `>`, `<`, `array-contains`, `in`, `not-in`
    - Values are automatically parsed: `"true"` → boolean, `"123"` → number, `"null"` → null
    - Examples: `"active,==,true"`, `"age,>=,18"`, `"status,in,active,pending"`
  - `-l, --limit <number>` - Limit number of results
  - `-o, --order-by <field,direction>` - Order by field (e.g., "name,asc" or "age,desc")
  - `--json` - Output results as JSON format
  - `--output <file>` - Save JSON output to file (automatically adds .json extension)

### Realtime Database Operations

- `firebase-tools-cli rtdb:export` - Export all data from Realtime Database

  - `-o, --output <dir>` - Output directory (default: ./)
  - `--no-detailed` - Skip detailed format export
  - `--no-importable` - Skip importable format export
  - `--no-subcollections` - Skip nested data
  - `-e, --exclude <paths...>` - Exclude specific paths

- `firebase-tools-cli rtdb:import <file>` - Import data to Realtime Database

  - `-b, --batch-size <size>` - Batch size for imports (default: 500)
  - `-m, --merge` - Merge documents instead of overwriting

- `firebase-tools-cli rtdb:query [path]` - Query Realtime Database (path defaults to root "/")
  - `-w, --where <field,operator,value>` - Where clause for filtering
    - Supported operators: `==`, `>=`, `<=`, `>`, `<` (Firebase RTDB limitations apply)
    - Values are automatically parsed: `"true"` → boolean, `"123"` → number, `"null"` → null
    - Examples: `"active,==,true"`, `"age,>=,18"`, `"score,>,85"`
    - **Note**: Firebase RTDB can't filter and order by different fields in the same query
  - `-l, --limit <number>` - Limit number of results
    - Applied after post-processing when sorting is required
  - `-o, --order-by <field,direction>` - Order by field (e.g., "name,asc" or "age,desc")
    - **Note**: Firebase RTDB object results don't preserve order, so sorting is post-processed
    - Cannot be combined with filtering on different fields due to Firebase limitations
  - `--json` - Output results as JSON format
  - `--output <file>` - Save JSON output to file (automatically adds .json extension)

### Remote Config Operations

- `firebase-tools-cli remote-config:convert <file>` - Convert JSON to Remote Config format
  - `-o, --output <file>` - Output file name
  - `--version-number <number>` - Version number (default: "1")
  - `--user-email <email>` - User email for version info
  - `--description <text>` - Description prefix for parameters
  - `--add-conditions` - Add default iOS/Android conditions
  - `--template <type>` - Use predefined template (basic|mobile|web)

### Management

- `firebase-tools-cli list` - List all collections with basic info
- `firebase-tools-cli projects` - Manage projects
  - `--set-default <project>` - Set default project
  - `--clear-default` - Clear default project
- `firebase-tools-cli docs` - Print or save documentation
  - `--save <file>` - Save documentation to file

### Global Options

- `-s, --service-account <path>` - Path to service account JSON file
- `-d, --database-url <url>` - Firebase Realtime Database URL
  - Required for all `rtdb:*` commands
  - Format: `https://your-project-default-rtdb.firebaseio.com`
  - Accepts URLs with or without trailing slash
  - Can be saved during authentication for future use

## File Formats

### Export Formats

1. **Detailed Format**: Complete document metadata including timestamps and subcollections
2. **Importable Format**: Simplified structure optimized for re-importing

### Import Format

JSON structure with collections as top-level keys:

```json
{
  "users": {
    "user1": { "name": "John", "age": 30 },
    "user2": { "name": "Jane", "age": 25 }
  },
  "posts": {
    "post1": { "title": "Hello", "content": "World" }
  }
}
```

### Remote Config Format

The convert command transforms simple JSON into Firebase Remote Config format:

**Input JSON:**

```json
{
  "appName": "My App",
  "maxUsers": 100,
  "isFeatureEnabled": true,
  "config": {
    "theme": "dark",
    "version": "1.0.0"
  }
}
```

## Query Command Examples

### Firestore Query Examples

```bash
# Basic collection query
firebase-tools-cli query users

# Filter by field value
firebase-tools-cli query users --where "active,==,true"
firebase-tools-cli query users --where "age,>=,18"
firebase-tools-cli query users --where "department,==,Engineering"

# Multiple conditions (using array operators)
firebase-tools-cli query users --where "status,in,active,pending,verified"
firebase-tools-cli query posts --where "tags,array-contains,javascript"

# Ordering and limiting
firebase-tools-cli query users --order-by "age,desc" --limit 10
firebase-tools-cli query posts --order-by "timestamp,desc" --limit 5

# Complex queries with JSON output
firebase-tools-cli query users --where "score,>,85" --order-by "score,desc" --json
firebase-tools-cli query products --where "price,<=,100" --limit 20 --output results.json

# Boolean and numeric value parsing
firebase-tools-cli query users --where "active,==,true"     # boolean true
firebase-tools-cli query users --where "age,>=,25"         # number 25
firebase-tools-cli query users --where "status,==,null"    # null value
```

### Realtime Database Query Examples

```bash
# Query root path (shows all top-level nodes)
firebase-tools-cli rtdb:query

# Query specific path
firebase-tools-cli rtdb:query users
firebase-tools-cli rtdb:query posts/2023

# Filter by field value
firebase-tools-cli rtdb:query users --where "active,==,true"
firebase-tools-cli rtdb:query users --where "age,>=,18"
firebase-tools-cli rtdb:query products --where "price,<,100"

# Ordering (with Firebase RTDB limitations)
firebase-tools-cli rtdb:query users --order-by "name,asc"
firebase-tools-cli rtdb:query posts --order-by "timestamp,desc"

# Limiting results
firebase-tools-cli rtdb:query users --limit 10
firebase-tools-cli rtdb:query posts --order-by "timestamp,desc" --limit 5

# JSON output and file saving
firebase-tools-cli rtdb:query users --json
firebase-tools-cli rtdb:query products --where "category,==,electronics" --output inventory.json

# Complex path queries
firebase-tools-cli rtdb:query users/user123/posts
firebase-tools-cli rtdb:query analytics/daily/2023-12-01
```

### Query Limitations and Best Practices

#### Firestore Limitations

- Compound queries may require composite indexes
- `array-contains` only works with single values
- `in` and `not-in` support up to 10 values
- Range queries (`>`, `<`, `>=`, `<=`) can only be used on one field per query

#### Firebase RTDB Limitations

- **Cannot filter and order by different fields** in the same query
- Object results don't preserve Firebase ordering (post-processed by CLI)
- Limited query operators compared to Firestore
- Queries are performed at the specified path level

#### Performance Tips

- Use `--limit` to avoid large result sets
- Combine filtering with ordering when possible
- Use specific paths in RTDB queries to reduce data transfer
- Save large results to files using `--output` instead of console display

### Query Troubleshooting

#### Common Error Messages

**"Error: a default value for a required argument is never used"**

- This indicates a CLI configuration issue, not a query problem
- Try updating to the latest version

**"PERMISSION_DENIED"**

- Check Firebase security rules
- Verify service account has appropriate permissions
- Ensure you're authenticated correctly

**"INDEX_NOT_DEFINED" (Firestore)**

- Create required composite indexes in Firebase Console
- Check the error message for specific index requirements

**"Firebase RTDB limitation: Cannot order by one field and filter by another"**

- This is a Firebase RTDB constraint, not a bug
- The CLI will post-process results when possible
- Consider restructuring your data or using Firestore for complex queries

#### Value Parsing Issues

If your query values aren't being parsed correctly:

```bash
# Strings should be quoted if they contain special characters
firebase-tools-cli query users --where 'name,==,"John Doe"'

# Numbers are auto-detected
firebase-tools-cli query users --where "age,>=,25"    # 25 as number

# Booleans use lowercase
firebase-tools-cli query users --where "active,==,true"   # boolean true
firebase-tools-cli query users --where "active,==,false"  # boolean false

# Null values
firebase-tools-cli query users --where "lastLogin,==,null"
```

## Common Workflows

### Initial Setup

1. `firebase-tools-cli login` - Authenticate and select default project
2. `firebase-tools-cli list` - Verify connection and see collections

### Backup and Restore

1. `firebase-tools-cli export -o ./backups` - Create backup
2. `firebase-tools-cli import ./backups/firestore_export.json` - Restore from backup

### Data Migration

1. `firebase-tools-cli --project old-project export -o ./migration`
2. `firebase-tools-cli --project new-project import ./migration/firestore_export.json`

### Remote Config Management

1. `firebase-tools-cli remote-config:convert config.json --add-conditions`
2. Review and upload the generated Remote Config file

## Security Notes

- OAuth tokens are automatically refreshed
- Service account keys should be kept secure
- Use IAM roles with minimal required permissions
- Credentials are stored in user home directory
- Remote Config parameters are public - avoid sensitive data

## Performance Tips

- Use `--exclude` to skip large collections during export
- Adjust `--batch-size` based on document size and network
- Use `--limit` for large query results
- Enable `--no-subcollections` for faster exports when not needed
- Keep Remote Config parameters under 1MB total size

## License

MIT © [Omer Ayhan](https://github.com/omer-ayhan)

```bash
firebase-tools-cli --help
# or
firebase-tools-cli -h
```

### **Command-Specific Help:**

```bash
firebase-tools-cli export --help
firebase-tools-cli import --help
firebase-tools-cli list --help
firebase-tools-cli query --help
```

### **Version:**

```bash
firebase-tools-cli --version
# or
firebase-tools-cli -V
```

## 📋 Sample Help Output

When you run `firebase-tools-cli --help`, you'll see:

```
Usage: firebase-tools-cli [options] [command]

CLI tool for Firestore database operations

Options:
  -V, --version                    display version number
  -s, --service-account <path>     Path to service account JSON file (default: "./serviceAccountKey.json")
  -d, --database-url <url>         Firebase database URL
  -h, --help                       display help for command

Commands:
  export [options]                 Export all collections from Firestore
  import [options] <file>          Import data to Firestore from JSON file
  list                            List all collections and their basic info
  query [options] <collection>     Query a specific collection
  help [command]                   display help for command
```

And for specific commands like `firebase-tools-cli export --help`:

```
Usage: firebase-tools-cli export [options]

Export all collections from Firestore

Options:
  -o, --output <dir>              Output directory (default: "./")
  --no-detailed                   Skip detailed format export
  --no-importable                 Skip importable format export
  --no-subcollections             Skip subcollections
  -e, --exclude <collections...>  Exclude specific collections
  -h, --help                      display help for command
```

## 🔧 Additional Help Features

The CLI also includes:

- **Command suggestions** if you mistype a command
- **Required argument validation** with helpful error messages
- **Option validation** with clear error descriptions
- **Usage examples** in error messages

[npm-image]: https://img.shields.io/npm/v/firebase-tools-cli.svg?style=flat-square
[npm-url]: https://npmjs.org/package/firebase-tools-cli
[license-image]: https://img.shields.io/npm/l/firebase-tools-cli.svg?style=flat-square
[license-url]: https://github.com/omer-ayhan/firebase-tools-cli/blob/main/LICENSE.txt
[node-badge]: https://img.shields.io/node/v/firebase-tools-cli.svg
[npm]: https://www.npmjs.com/package/firebase-tools-cli
[npm-badge]: https://img.shields.io/npm/v/firebase-tools-cli.svg
