# Firebase Tools CLI

[![NPM version][npm-image]][npm-url]
[![License][license-image]][license-url]
[![Node Version][node-badge]][npm]
[![NPM version][npm-badge]][npm]
[![Bun compatible][bun-badge]][bun-url]

The Firebase Tools CLI is a command-line interface for managing Firebase services including Firestore, Realtime Database, and Remote Config. It provides powerful tools to export, import, query, and manage your Firebase data from the command line.

- Export/Import data from Firestore and Realtime Database
- Query collections and documents with advanced filtering
- Convert JSON files to Firebase Remote Config format
- Manage authentication and project settings
- Batch operations with customizable batch sizes

To get started with Firebase Tools CLI, read the full list of commands below or check out the [documentation](https://github.com/omer-ayhan/firebase-tools-cli#readme).

## Installation

### Node Package

You can install Firebase Tools CLI using npm (the Node Package Manager). Note that you will need to install [Node.js](http://nodejs.org/) and [npm](https://npmjs.org/). Installing Node.js should install npm as well.

To download and install Firebase Tools CLI run the following command:

```bash
npm install -g firebase-tools-cli
```

This will provide you with the globally accessible `firebase-tools-cli` command.

### Bun

Firebase Tools CLI also supports [Bun](https://bun.sh/) (>=1.0.0) as a runtime. You can install it globally using Bun's package manager:

```bash
bun install -g firebase-tools-cli
```

Or run commands directly with Bun after a local install:

```bash
bun run firebase-tools-cli --help
```

> **Note:** Core features are expected to be compatible with Bun. Some interactive prompts that rely on Node.js-specific stdin handling may behave slightly differently under Bun. If you encounter issues, please [open an issue](https://github.com/omer-ayhan/firebase-tools-cli/issues).

## Commands

**The command `firebase-tools-cli --help` lists the available commands and `firebase-tools-cli <command> --help` shows more details for an individual command.**

If a command is project-specific, you must have either a valid Firebase service account key file

Below is a brief list of the available commands and their function:

### Authentication Commands

| Command      | Description                                                                                |
| ------------ | ------------------------------------------------------------------------------------------ |
| **login**    | Authenticate with service account key file.                                                |
| **projects** | List available projects and manage default project settings.                               |
| **reset**    | Reset all configuration and credentials. Options to reset config-only or credentials-only. |

### Firestore Commands

| Command              | Description                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **firestore:export** | Export all collections from Firestore to a single compact importable JSON file (`firestore_export.json`). Supports subcollection handling and collection exclusions. |
| **firestore:import** | Import data to Firestore from JSON file. Supports batch operations and merge functionality.                         |
| **firestore:list**   | List all collections and their basic information from the current project's Firestore database.                     |
| **firestore:query**  | Query a collection or fetch a specific document. Supports subcollection paths (e.g., `users user1 orders`), collection group queries (`--collection-group`), advanced filtering, ordering, and field-specific queries. |

### Realtime Database Commands

| Command         | Description                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| **rtdb:export** | Export all data from Realtime Database to a single compact importable JSON file (`rtdb_export.json`). Supports exclusion options and top-level-only export. |
| **rtdb:import** | Import data to Realtime Database from JSON file. Supports batch operations and merge functionality.         |
| **rtdb:list**   | List all top-level nodes and their basic information from the current project's Realtime Database.          |
| **rtdb:query**  | Query a specific path in Realtime Database. Supports deep nested paths (e.g., `/root/a/b/c`), nested field filters (`field/subfield,==,value`), ordering, and JSON output with file saving. |

### Remote Config Commands

| Command                   | Description                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| **remote-config:convert** | Convert JSON file to Firebase Remote Config format. Supports templates and condition generation. |

## Authentication

### General

The Firebase Tools CLI currently only supports one authentication method:

- **Service Account** - set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable to point to the path of a JSON service account key file. For more details, see Google Cloud's [Getting started with authentication](https://cloud.google.com/docs/authentication/getting-started) guide.

### Multiple Projects

By default the CLI can work with multiple Firebase projects. Use `firebase-tools-cli projects` to list available projects and set a default project for easier command execution.

To set the default project for a specific directory, run `firebase-tools-cli projects --set-default <project-id>` from within the directory.

To clear the default project setting, run `firebase-tools-cli projects --clear-default`.

## Examples

### Export and Import Workflow

```bash
# Export Firestore data
firebase-tools-cli firestore:export --output ./backup-$(date +%Y%m%d)/

# Import data to another project
firebase-tools-cli firestore:import ./backup-20231201/firestore_export.json

# Export Realtime Database
firebase-tools-cli rtdb:export --database-url https://source-project-rtdb.firebaseio.com/ --output ./rtdb-backup/

# Import to target database
firebase-tools-cli rtdb:import ./rtdb-backup/rtdb_export.json --database-url https://target-project-rtdb.firebaseio.com/
```

### Advanced Querying

```bash
# Query Firestore collections with conditions
firebase-tools-cli firestore:query users --where "age,>=,18" --limit 10
firebase-tools-cli firestore:query users --order-by "name,asc"

# Query Firestore subcollections (nested paths)
firebase-tools-cli firestore:query users user1 orders
firebase-tools-cli firestore:query users user1 orders --where "status,==,shipped" --limit 5
firebase-tools-cli firestore:query users user1 orders order1

# Query Firestore collection groups (all subcollections with the same name)
firebase-tools-cli firestore:query orders --collection-group
firebase-tools-cli firestore:query orders --collection-group --where "status,==,shipped" --limit 20

# Query specific document fields
firebase-tools-cli firestore:query users user1 --field profile.settings

# Query Realtime Database with filtering
firebase-tools-cli rtdb:query users --where "age,>=,18" --limit 10 --database-url https://my-project-rtdb.firebaseio.com/
firebase-tools-cli rtdb:query posts --order-by "timestamp,desc" --json --output results.json

# Query Realtime Database at a nested path
firebase-tools-cli rtdb:query users/user4/active --database-url https://my-project-rtdb.firebaseio.com/
firebase-tools-cli rtdb:query users user4 active --database-url https://my-project-rtdb.firebaseio.com/

# Query Realtime Database with nested field filters
firebase-tools-cli rtdb:query users --where "workouts/appVersion,==,2.3.1" --database-url https://my-project-rtdb.firebaseio.com/
firebase-tools-cli rtdb:query workouts --where "settings/difficulty,>=,3" --order-by "settings/duration,desc" --database-url https://my-project-rtdb.firebaseio.com/
```

### Remote Config Management

```bash
# Convert app config to Remote Config format
firebase-tools-cli remote-config:convert app-config.json --template mobile --add-conditions

# Convert with custom settings
firebase-tools-cli remote-config:convert config.json --version-number 2 --user-email admin@example.com --description "Production config"
```

## Requirements

- Node.js >= 18.0.0 **or** Bun >= 1.0.0
- Valid Firebase project with appropriate permissions
- Service account key

## Contributing

We welcome contributions to Firebase Tools CLI! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute.

## License

Firebase Tools CLI is licensed under the [MIT License](LICENSE.txt).

## Support

- **Issues**: Report bugs and request features on [GitHub Issues](https://github.com/omer-ayhan/firebase-tools-cli/issues)
- **Documentation**: Full documentation available in the [repository](https://github.com/omer-ayhan/firebase-tools-cli)
- **Author**: [Omer Ayhan](https://github.com/omer-ayhan)

## Contributors

<a href="https://github.com/omer-ayhan/firebase-tools-cli/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=omer-ayhan/firebase-tools-cli" />
</a>

[npm-image]: https://img.shields.io/npm/v/firebase-tools-cli.svg?style=flat-square
[npm-url]: https://npmjs.org/package/firebase-tools-cli
[license-image]: https://img.shields.io/npm/l/firebase-tools-cli.svg?style=flat-square
[license-url]: https://github.com/omer-ayhan/firebase-tools-cli/blob/main/LICENSE.txt
[node-badge]: https://img.shields.io/node/v/firebase-tools-cli.svg
[npm]: https://www.npmjs.com/package/firebase-tools-cli
[npm-badge]: https://img.shields.io/npm/v/firebase-tools-cli.svg
[bun-badge]: https://img.shields.io/badge/bun-%3E%3D1.0.0-black?logo=bun
[bun-url]: https://bun.sh
