export const documentation = `# Firestore CLI Tool - LLM Documentation

## Overview
A comprehensive command-line interface for Firebase Firestore database operations including export, import, querying, collection management, and Remote Config conversion with support for both OAuth and service account authentication.

## Authentication Methods
1. **OAuth (Interactive)**: Browser-based Google account authentication
2. **Service Account**: JSON key file authentication for automated workflows

## Core Commands

### Authentication Commands
- \`firebase-tools-cli login\` - Interactive authentication setup
  - \`--force\` - Force re-authentication
  - \`--method <oauth|service-account>\` - Specify authentication method
- \`firebase-tools-cli logout\` - Clear all credentials and configuration
- \`firebase-tools-cli reset\` - Reset configuration and credentials
  - \`--config-only\` - Reset only configuration
  - \`--credentials-only\` - Reset only credentials

### Data Operations
- \`firebase-tools-cli export\` - Export all collections
  - \`-o, --output <dir>\` - Output directory (default: ./)
  - \`--no-detailed\` - Skip detailed format export
  - \`--no-importable\` - Skip importable format export
  - \`--no-subcollections\` - Skip subcollections
  - \`-e, --exclude <collections...>\` - Exclude specific collections

- \`firebase-tools-cli import <file>\` - Import data from JSON file
  - \`-b, --batch-size <size>\` - Batch size for imports (default: 500)
  - \`-m, --merge\` - Merge documents instead of overwriting
  - \`-e, --exclude <collections...>\` - Exclude specific collections

- \`firebase-tools-cli query <collection>\` - Query a specific collection
  - \`-w, --where <field,operator,value>\` - Where clause (e.g., "age,>=,18")
  - \`-l, --limit <number>\` - Limit number of results
  - \`-o, --order-by <field,direction>\` - Order by field (e.g., "name,asc")
  - \`--json\` - Output results as JSON
  - \`--output <file>\` - Save JSON output to file

- \`firebase-tools-cli convert <file>\` - Convert JSON to Firebase Remote Config format
  - \`-o, --output <file>\` - Output file name
  - \`--version-number <number>\` - Version number for Remote Config (default: "1")
  - \`--user-email <email>\` - User email for version info
  - \`--description <text>\` - Description prefix for parameters
  - \`--add-conditions\` - Add default iOS/Android conditions
  - \`--template <type>\` - Use predefined template (basic|mobile|web)

### Management Commands
- \`firebase-tools-cli list\` - List all collections with basic info
- \`firebase-tools-cli projects\` - Manage projects
  - \`--set-default <project>\` - Set default project
  - \`--clear-default\` - Clear default project
- \`firebase-tools-cli docs\` - Print or save this documentation
  - \`--save <file>\` - Save documentation to file

### Global Options
- \`-s, --service-account <path>\` - Path to service account JSON file
- \`-p, --project <id>\` - Google Cloud Project ID (overrides default)
- \`-d, --database-url <url>\` - Firebase Realtime Database URL
- \`--database-id <id>\` - Firestore database ID (default: "(default)")

## File Formats

### Export Formats
1. **Detailed Format**: Complete document metadata including timestamps and subcollections
2. **Importable Format**: Simplified structure optimized for re-importing

### Import Format
JSON structure with collections as top-level keys:
\`\`\`json
{
  "users": {
    "user1": { "name": "John", "age": 30 },
    "user2": { "name": "Jane", "age": 25 }
  },
  "posts": {
    "post1": { "title": "Hello", "content": "World" }
  }
}
\`\`\`

### Remote Config Format
The convert command transforms simple JSON into Firebase Remote Config format:

**Input JSON:**
\`\`\`json
{
  "appName": "My App",
  "maxUsers": 100,
  "isFeatureEnabled": true,
  "config": {
    "theme": "dark",
    "version": "1.0.0"
  }
}
\`\`\`

**Output Remote Config:**
\`\`\`json
{
  "conditions": [],
  "parameters": {
    "appName": {
      "defaultValue": { "value": "My App" },
      "valueType": "STRING"
    },
    "maxUsers": {
      "defaultValue": { "value": "100" },
      "valueType": "NUMBER"
    },
    "isFeatureEnabled": {
      "defaultValue": { "value": "true" },
      "valueType": "BOOLEAN"
    },
    "config": {
      "defaultValue": { "value": "{\\"theme\\":\\"dark\\",\\"version\\":\\"1.0.0\\"}" },
      "valueType": "JSON"
    }
  },
  "version": {
    "versionNumber": "1",
    "updateTime": "2024-01-01T00:00:00.000Z",
    "updateUser": { "email": "user@example.com" },
    "updateOrigin": "CONSOLE",
    "updateType": "INCREMENTAL_UPDATE"
  }
}
\`\`\`

### Subcollections
Subcollections are handled with special naming convention:
- Format: \`parentCollection__parentDoc__subcollection\`
- Example: \`users__user1__posts\` represents posts subcollection under users/user1

## Query Operators
Supported Firestore query operators:
- \`==\` - Equal to
- \`!=\` - Not equal to
- \`<\` - Less than
- \`<=\` - Less than or equal to
- \`>\` - Greater than
- \`>=\` - Greater than or equal to
- \`array-contains\` - Array contains value
- \`array-contains-any\` - Array contains any of the values
- \`in\` - Value is in array
- \`not-in\` - Value is not in array

## Configuration Files
- \`~/.firebase-tools-cli/config.json\` - Default project and settings
- \`~/.firebase-tools-cli/credentials.json\` - OAuth credentials (auto-managed)

## Common Workflows

### Initial Setup
1. \`firebase-tools-cli login\` - Authenticate and select default project
2. \`firebase-tools-cli list\` - Verify connection and see collections

### Backup and Restore
1. \`firebase-tools-cli export -o ./backups\` - Create backup
2. \`firebase-tools-cli import backup_file.json\` - Restore from backup

### Data Analysis
1. \`firebase-tools-cli query users --where "age,>=,18" --json --output adults.json\`
2. \`firebase-tools-cli query posts --order-by "createdAt,desc" --limit 10\`

### Project Management
1. \`firebase-tools-cli projects\` - List available projects
2. \`firebase-tools-cli projects --set-default my-project\` - Set default
3. \`firebase-tools-cli --project other-project list\` - Use different project

### Remote Config Conversion
1. \`firebase-tools-cli convert app-config.json --add-conditions --description "Production Config"\` - With conditions
2. \`firebase-tools-cli convert feature-flags.json -o prod-remote-config.json --user-email admin@myapp.com --version-number "2"\` - Custom output

## Error Handling
- Authentication errors: Use \`--force\` flag or \`logout\` then \`login\`
- Permission errors: Check Firestore rules and IAM permissions
- Batch errors: Reduce \`--batch-size\` for large imports
- Network errors: Retry with exponential backoff (built-in)
- Conversion errors: Ensure valid JSON input format

## Security Notes
- OAuth tokens are automatically refreshed
- Service account keys should be kept secure
- Use IAM roles with minimal required permissions
- Credentials are stored in user home directory
- Remote Config parameters are public - avoid sensitive data

## Performance Tips
- Use \`--exclude\` to skip large collections during export
- Adjust \`--batch-size\` based on document size and network
- Use \`--limit\` for large query results
- Enable \`--no-subcollections\` for faster exports when not needed
- Keep Remote Config parameters under 1MB total size

## Integration Examples

### CI/CD Pipeline
\`\`\`bash
# Export production data
firebase-tools-cli --service-account ./prod-key.json export -o ./backups

# Import to staging
firebase-tools-cli --service-account ./staging-key.json import ./backups/firestore_export.json
\`\`\`

### Automated Backups
\`\`\`bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
firebase-tools-cli export -o "./backups/backup_$DATE"
\`\`\`

### Data Migration
\`\`\`bash
# Export from old project
firebase-tools-cli --project old-project export -o ./migration

# Import to new project
firebase-tools-cli --project new-project import ./migration/firestore_export.json
\`\`\`

## Troubleshooting

### Common Issues
1. **"Permission denied"**: Check IAM roles and Firestore rules
2. **"Project not found"**: Verify project ID and authentication
3. **"Quota exceeded"**: Reduce batch size or add delays
4. **"Invalid JSON"**: Validate input file format
5. **"Token expired"**: Run \`firebase-tools-cli login --force\`

### Debug Mode
Set environment variable for detailed logging:
\`\`\`bash
export DEBUG=firebase-tools-cli:*
firebase-tools-cli <command>
\`\`\`

### Support
- Check GitHub issues for known problems
- Verify Firebase project settings
- Test with minimal data first
- Use service account for production workflows
`;
