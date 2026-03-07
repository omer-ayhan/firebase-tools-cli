# Privacy Policy for Firebase Tools CLI

**Last Updated:** March 7, 2026

## Overview

Firebase Tools CLI ("we", "our", or "the application") is a command-line interface tool that helps users manage their Firebase resources including Firestore, Realtime Database, and Remote Config. This privacy policy explains how we handle your data when you use our application.

## Information We Collect

### Authentication Data

When you authenticate with Firebase Tools CLI, we collect and store:

- **Google Account Email Address**: Used to identify your account and display authentication status
- **OAuth Access Tokens**: Temporary tokens that allow the application to access Firebase APIs on your behalf
- **OAuth Refresh Tokens**: Used to obtain new access tokens when they expire
- **Firebase Project IDs**: The IDs of Firebase projects you choose to work with

### Service Account Data (Optional Authentication Method)

If you choose to authenticate using a service account:

- **Service Account Key File Path**: The local file path to your service account JSON file
- **Service Account Project ID**: The Firebase project associated with the service account

### Configuration Data

- **Default Project Selection**: Your chosen default Firebase project
- **Authentication Method Preference**: Whether you're using OAuth or service account authentication

## How We Store Your Data

### Local Storage Only

**All data is stored exclusively on your local machine** in the following location:

```
~/.firebase-tools-cli/
  ├── config.json          (authentication method, default project)
  └── credentials.json     (OAuth tokens - OAuth method only)
```

**We do NOT:**

- Send your data to any remote servers (except Google/Firebase APIs)
- Store your data in any cloud services
- Collect analytics or telemetry
- Track your usage
- Share your data with third parties

### Security Measures

- Credential files are stored with restricted file permissions on your local system
- OAuth tokens are encrypted in transit when communicating with Google APIs
- Service account keys remain as files on your system and are never transmitted except to Firebase APIs

## How We Use Your Data

Your data is used exclusively for the following purposes:

1. **Authentication**: To verify your identity with Google/Firebase services
2. **API Access**: To make authorized requests to Firebase APIs on your behalf
3. **Project Management**: To remember your default project and preferences
4. **Token Refresh**: To automatically refresh expired tokens for continuous access

## Data Sharing and Third Parties

### Google/Firebase APIs

Your authentication tokens are sent to Google/Firebase APIs to:

- Authenticate your requests
- Access your Firebase projects
- Manage Firestore, Realtime Database, and Remote Config data

**We only share data with Google/Firebase** - the services you're explicitly trying to access.

### No Other Third Parties

We do not share, sell, rent, or trade your data with any other third parties.

## Data Retention

### OAuth Tokens

- Access tokens expire after 1 hour (managed by Google)
- Refresh tokens remain valid until revoked
- You can delete all tokens at any time using `firebase-tools-cli reset`

### Configuration Data

- Stored indefinitely on your local machine
- Can be deleted at any time using `firebase-tools-cli reset`

## Your Rights and Choices

### Access Your Data

All your data is stored locally at `~/.firebase-tools-cli/`. You can view it anytime.

### Delete Your Data

You can delete all authentication data and configuration using:

```bash
firebase-tools-cli reset
```

Or manually delete the directory:

```bash
rm -rf ~/.firebase-tools-cli
```

### Revoke Access

You can revoke Firebase Tools CLI's access to your Google account at any time:

1. Visit [Google Account Permissions](https://myaccount.google.com/permissions)
2. Find "firebase-tools-cli"
3. Click "Remove Access"

## Children's Privacy

Firebase Tools CLI is not intended for use by children under 13 years of age. We do not knowingly collect data from children.

## Open Source

Firebase Tools CLI is open source software. You can review our code at:
[https://github.com/omer-ayhan/firebase-tools-cli](https://github.com/omer-ayhan/firebase-tools-cli)

## Changes to This Policy

We may update this privacy policy from time to time. Changes will be posted in this document with an updated "Last Updated" date.

## Data Protection Rights (GDPR/CCPA)

If you are located in the European Union or California, you have additional rights:

- **Right to Access**: Request copies of your data (stored locally on your machine)
- **Right to Rectification**: Update your authentication or configuration
- **Right to Erasure**: Delete all data using the `reset` command
- **Right to Data Portability**: Export your configuration from local JSON files
- **Right to Object**: Stop using the application and delete all data

## Contact

For questions or concerns about this privacy policy or data handling:

- **GitHub Issues**: [https://github.com/omer-ayhan/firebase-tools-cli/issues](https://github.com/omer-ayhan/firebase-tools-cli/issues)
- **Repository Owner**: [https://github.com/omer-ayhan](https://github.com/omer-ayhan)

## Consent

By using Firebase Tools CLI, you consent to this privacy policy and our data handling practices as described above.

---

**Important Note**: Firebase Tools CLI is an independent tool and is not officially affiliated with or endorsed by Google or Firebase. Your use of Firebase services through this tool is subject to [Google's Privacy Policy](https://policies.google.com/privacy) and [Firebase Terms of Service](https://firebase.google.com/terms).
