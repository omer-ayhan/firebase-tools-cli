# Contributing to Firebase Tools CLI

## Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for automated versioning and changelog generation.

### Commit Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

- **feat**: A new feature (triggers minor version bump)
- **fix**: A bug fix (triggers patch version bump)
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **chore**: Changes to the build process or auxiliary tools

### Breaking Changes

Add `BREAKING CHANGE:` in the footer or `!` after the type to trigger a major version bump:

```
feat!: remove deprecated API
```

or

```
feat: add new authentication method

BREAKING CHANGE: The old auth method is no longer supported
```

### Examples

```bash
# Patch release (0.5.3 -> 0.5.4)
git commit -m "fix: resolve authentication timeout issue"

# Minor release (0.5.3 -> 0.6.0)
git commit -m "feat: add new export format for Firestore"

# Major release (0.5.3 -> 1.0.0)
git commit -m "feat!: redesign CLI interface"
```

## Automated Publishing

When you merge a PR to the `main` branch:

1. **Semantic Release** analyzes your commit messages
2. **Automatically** determines the version bump type
3. **Updates** package.json and creates a changelog
4. **Publishes** to npm if there are releasable changes
5. **Creates** a GitHub release with release notes

No manual version bumping needed! 🎉
