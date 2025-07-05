# Contributing to Firebase Tools CLI

## Release Process

This project uses a **manual release process** where maintainers have full control over when and what gets released.

### How Releases Work

1. **Development**: Work happens in feature branches and gets merged to `main` via PRs
2. **Manual Release**: When ready, maintainers create a GitHub release manually
3. **Automatic Publishing**: GitHub Actions automatically publishes to npm based on the release

### Creating a Release

1. **Go to GitHub Releases**: Navigate to the releases page
2. **Create new release**: Click "Create a new release"
3. **Choose tag**: Create a new tag (e.g., `v1.2.3`, `v2.0.0`)
4. **Write release notes**: Describe what changed in this release
5. **Publish release**: Click "Publish release"
6. **Automatic npm publish**: GitHub Actions will automatically:
   - Run quality checks and tests
   - Update package.json with the release version
   - Build the project
   - Publish to npm
   - Update the release with npm package info

### Version Naming

Use semantic versioning for tags:

- **Patch** (v1.0.1): Bug fixes, small improvements
- **Minor** (v1.1.0): New features, backwards compatible
- **Major** (v2.0.0): Breaking changes

### Examples

```
v1.0.1 - Bug fix release
v1.1.0 - New feature release
v2.0.0 - Breaking changes release
```

## Pull Request Strategy

### Squash and Merge (Recommended)

To keep commit history clean:

1. **Enable "Squash and merge"** in your GitHub repository settings
2. **Disable "Create a merge commit"** and "Rebase and merge"
3. **Write clear commit message** in the squash commit title

#### Example:

```
PR Title: Add new Firestore export format
Multiple commits in PR:
- WIP: working on export
- fix typo
- add tests
- update docs

Squash commit message: "Add new export format for Firestore"
```

This way, only ONE commit with a clear message reaches main!

### Branch Protection Rules

Set up branch protection for `main`:

- ✅ Require pull request reviews
- ✅ Require status checks to pass
- ✅ Require branches to be up to date
- ✅ Restrict pushes to main branch

## Development Workflow

1. **Create feature branch** from main
2. **Make changes** and commit
3. **Open pull request** to main
4. **Code review** and approval
5. **Squash and merge** to main
6. **When ready for release**: Create GitHub release manually
7. **Automatic publishing** to npm happens via GitHub Actions

No manual version bumping needed! 🎉
