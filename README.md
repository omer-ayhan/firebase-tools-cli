# firebase-cli

[![NPM version][npm-image]][npm-url]
[![License][license-image]][license-url]
[![Node Version][node-badge]][npm]
[![NPM version][npm-badge]][npm]

> CLI tool for Firebase to manage Firestore, Remote Config, and Realtime Database

## Installation

```bash
npm install -g firebase-cli
```

## Setup

1. Generate a service account from within the settings section of the Firebase console
2. Save the service account to `serviceAccountKey.json` within your firebase project repo (or set `SERVICE_ACCOUNT` environment variable)
3. Make sure you add `serviceAccountKey.json` to your `.gitignore` so it is not committed as part of your changes - **THIS IS EXTREMELY IMPORTANT**

## Usage

firebase-cli should be used the same way that [firebase-tools](https://github.com/firebase/firebase-tools) is used - the API is as close to the same as possible:

```bash
# Export all collections
firebase-cli export --limit-to-last 10 /users

# Import data
firebase-cli import ./data.json

# Query collections
firebase-cli query users --where "age,>=,18" --limit 10

# List collections
firebase-cli list

# Remote Config operations
firebase-cli remote-config:convert config.json --add-conditions
```

## Commands

### Authentication

- `firebase-cli login` - Interactive authentication setup
  - `--force` - Force re-authentication
- `firebase-cli reset` - Reset configuration and credentials
  - `--config-only` - Reset only configuration
  - `--credentials-only` - Reset only credentials

### Firestore Operations

- `firebase-cli export` - Export all collections

  - `-o, --output <dir>` - Output directory (default: ./)
  - `--no-detailed` - Skip detailed format export
  - `--no-importable` - Skip importable format export
  - `--no-subcollections` - Skip subcollections
  - `-e, --exclude <collections...>` - Exclude specific collections

- `firebase-cli import <file>` - Import data from JSON file

  - `-b, --batch-size <size>` - Batch size for imports (default: 500)
  - `-m, --merge` - Merge documents instead of overwriting
  - `-e, --exclude <collections...>` - Exclude specific collections

- `firebase-cli query <collection>` - Query a specific collection
  - `-w, --where <field,operator,value>` - Where clause (e.g., "age,>=,18")
  - `-l, --limit <number>` - Limit number of results
  - `-o, --order-by <field,direction>` - Order by field (e.g., "name,asc")
  - `--json` - Output results as JSON
  - `--output <file>` - Save JSON output to file

### Realtime Database Operations

- `firebase-cli rtdb:export` - Export all data from Realtime Database

  - `-o, --output <dir>` - Output directory (default: ./)
  - `--no-detailed` - Skip detailed format export
  - `--no-importable` - Skip importable format export
  - `--no-subcollections` - Skip nested data
  - `-e, --exclude <paths...>` - Exclude specific paths

- `firebase-cli rtdb:import <file>` - Import data to Realtime Database

  - `-b, --batch-size <size>` - Batch size for imports (default: 500)
  - `-m, --merge` - Merge documents instead of overwriting

- `firebase-cli rtdb:query <path>` - Query Realtime Database
  - `-w, --where <field,operator,value>` - Where clause
  - `-l, --limit <number>` - Limit number of results
  - `-o, --order-by <field,direction>` - Order by field
  - `--json` - Output results as JSON
  - `--output <file>` - Save JSON output to file

### Remote Config Operations

- `firebase-cli remote-config:convert <file>` - Convert JSON to Remote Config format
  - `-o, --output <file>` - Output file name
  - `--version-number <number>` - Version number (default: "1")
  - `--user-email <email>` - User email for version info
  - `--description <text>` - Description prefix for parameters
  - `--add-conditions` - Add default iOS/Android conditions
  - `--template <type>` - Use predefined template (basic|mobile|web)

### Management

- `firebase-cli list` - List all collections with basic info
- `firebase-cli projects` - Manage projects
  - `--set-default <project>` - Set default project
  - `--clear-default` - Clear default project
- `firebase-cli docs` - Print or save documentation
  - `--save <file>` - Save documentation to file

### Global Options

- `-s, --service-account <path>` - Path to service account JSON file
- `-d, --database-url <url>` - Firebase Realtime Database URL

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

## Common Workflows

### Initial Setup

1. `firebase-cli login` - Authenticate and select default project
2. `firebase-cli list` - Verify connection and see collections

### Backup and Restore

1. `firebase-cli export -o ./backups` - Create backup
2. `firebase-cli import ./backups/firestore_export.json` - Restore from backup

### Data Migration

1. `firebase-cli --project old-project export -o ./migration`
2. `firebase-cli --project new-project import ./migration/firestore_export.json`

### Remote Config Management

1. `firebase-cli remote-config:convert config.json --add-conditions`
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
firebase-cli --help
# or
firebase-cli -h
```

### **Command-Specific Help:**

```bash
firebase-cli export --help
firebase-cli import --help
firebase-cli list --help
firebase-cli query --help
```

### **Version:**

```bash
firebase-cli --version
# or
firebase-cli -V
```

## 📋 Sample Help Output

When you run `firebase-cli --help`, you'll see:

```
Usage: firebase-cli [options] [command]

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

And for specific commands like `firebase-cli export --help`:

```
Usage: firebase-cli export [options]

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

[npm-image]: https://img.shields.io/npm/v/firebase-cli.svg?style=flat-square
[npm-url]: https://npmjs.org/package/firebase-cli
[license-image]: https://img.shields.io/npm/l/firebase-cli.svg?style=flat-square
[license-url]: https://github.com/omer-ayhan/firebase-cli/blob/master/LICENSE
[node-badge]: https://img.shields.io/node/v/firebase-cli.svg
[npm]: https://www.npmjs.com/package/firebase-cli
[npm-badge]: https://img.shields.io/npm/v/firebase-cli.svg
