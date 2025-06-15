### **Global Help:**

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
