module.exports = `# Firestore CLI Tool - LLM Documentation

## Overview
A comprehensive command-line interface for Firebase Firestore database operations including export, import, querying, collection management, and Remote Config conversion with support for both OAuth and service account authentication.

## Authentication Methods
1. **OAuth (Interactive)**: Browser-based Google account authentication
2. **Service Account**: JSON key file authentication for automated workflows

## Core Commands

### Authentication Commands
- \`firestore-cli login\` - Interactive authentication setup
  - \`--force\` - Force re-authentication
  - \`--method <oauth|service-account>\` - Specify authentication method
- \`firestore-cli logout\` - Clear all credentials and configuration
- \`firestore-cli reset\` - Reset configuration and credentials
  - \`--config-only\` - Reset only configuration
  - \`--credentials-only\` - Reset only credentials

### Data Operations
- \`firestore-cli export\` - Export all collections
  - \`-o, --output <dir>\` - Output directory (default: ./)
  - \`--no-detailed\` - Skip detailed format export
  - \`--no-importable\` - Skip importable format export
  - \`--no-subcollections\` - Skip subcollections
  - \`-e, --exclude <collections...>\` - Exclude specific collections

- \`firestore-cli import <file>\` - Import data from JSON file
  - \`-b, --batch-size <size>\` - Batch size for imports (default: 500)
  - \`-m, --merge\` - Merge documents instead of overwriting
  - \`-e, --exclude <collections...>\` - Exclude specific collections

- \`firestore-cli query <collection>\` - Query a specific collection
  - \`-w, --where <field,operator,value>\` - Where clause (e.g., "age,>=,18")
  - \`-l, --limit <number>\` - Limit number of results
  - \`-o, --order-by <field,direction>\` - Order by field (e.g., "name,asc")
  - \`--json\` - Output results as JSON
  - \`--output <file>\` - Save JSON output to file

- \`firestore-cli convert <file>\` - Convert JSON to Firebase Remote Config format
  - \`-o, --output <file>\` - Output file name
  - \`--version-number <number>\` - Version number for Remote Config (default: "1")
  - \`--user-email <email>\` - User email for version info
  - \`--description <text>\` - Description prefix for parameters
  - \`--add-conditions\` - Add default iOS/Android conditions
  - \`--template <type>\` - Use predefined template (basic|mobile|web)

### Management Commands
- \`firestore-cli list\` - List all collections with basic info
- \`firestore-cli projects\` - Manage projects
  - \`--set-default <project>\` - Set default project
  - \`--clear-default\` - Clear default project
- \`firestore-cli docs\` - Print or save this documentation
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
- \`~/.firestore-cli/config.json\` - Default project and settings
- \`~/.firestore-cli/credentials.json\` - OAuth credentials (auto-managed)

## Common Workflows

### Initial Setup
1. \`firestore-cli login\` - Authenticate and select default project
2. \`firestore-cli list\` - Verify connection and see collections

### Backup and Restore
1. \`firestore-cli export -o ./backups\` - Create backup
2. \`firestore-cli import backup_file.json\` - Restore from backup

### Data Analysis
1. \`firestore-cli query users --where "age,>=,18" --json --output adults.json\`
2. \`firestore-cli query posts --order-by "createdAt,desc" --limit 10\`

### Project Management
1. \`firestore-cli projects\` - List available projects
2. \`firestore-cli projects --set-default my-project\` - Set default
3. \`firestore-cli --project other-project list\` - Use different project

### Remote Config Conversion
1. \`firestore-cli convert app-config.json --add-conditions --description "Production Config"\` - With conditions
2. \`firestore-cli convert feature-flags.json -o prod-remote-config.json --user-email admin@myapp.com --version-number "2"\` - Custom output

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
# Backup before deployment
firestore-cli --service-account ./key.json --project prod export -o ./backup

# Deploy changes
# ...

# Restore if needed
firestore-cli --service-account ./key.json --project prod import ./backup/file.json
\`\`\`

### Data Migration
\`\`\`bash
# Export from source
firestore-cli --project source-project export -o ./migration

# Import to destination
firestore-cli --project dest-project import ./migration/firestore_importable_*.json
\`\`\`

### Analytics Query
\`\`\`bash
# Get active users data
firestore-cli query users --where "lastActive,>=,2024-01-01" --json --output active_users.json

# Get recent posts
firestore-cli query posts --order-by "timestamp,desc" --limit 100 --json
\`\`\`

### Remote Config Workflow
\`\`\`bash
# Convert app configuration to Remote Config
firestore-cli convert app-config.json --add-conditions --description "Production Config"

# Convert with custom settings
firestore-cli convert feature-flags.json -o prod-remote-config.json --user-email admin@myapp.com --version-number "2"
\`\`\`

## Troubleshooting

### Common Issues
1. **"Cannot modify a WriteBatch that has been committed"**
   - Fixed in current version with proper batch management

2. **"Permission denied"**
   - Check Firestore security rules
   - Verify IAM permissions
   - Ensure project has Firestore enabled

3. **"Authentication timeout"**
   - Check network connectivity
   - Try \`--force\` flag
   - Use service account for automated workflows

4. **"No projects found"**
   - Verify Google account has project access
   - Check if projects have Firestore enabled
   - Try service account authentication

5. **"Invalid JSON file"**
   - Ensure input file is valid JSON
   - Check for syntax errors and proper encoding
   - Use JSON validator tools if needed

### Debug Commands
- \`firestore-cli projects\` - Verify project access
- \`firestore-cli list\` - Test database connection
- \`firestore-cli reset --credentials-only\` - Clear auth issues
- \`firestore-cli login --force\` - Force re-authentication

## Version Information
- Node.js: >=14.0.0 required
- Firebase Admin SDK: v12.0.0+
- Supports all current Firestore features and regions
- Remote Config REST API v1 compatible
`;
