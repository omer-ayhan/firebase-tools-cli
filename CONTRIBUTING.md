# Contributing to Firebase Tools CLI

Thank you for your interest in contributing to Firebase Tools CLI! This guide will help you get started with contributing to the project.

## Getting Started

### Prerequisites

- Node.js (version 18 or higher)
- npm or yarn

### Setting Up Your Development Environment

1. **Fork the repository** on GitHub
2. **Clone your fork** to your local machine:
   ```bash
   git clone https://github.com/YOUR_USERNAME/firebase-tools-cli.git
   cd firebase-tools-cli
   ```
3. **Install dependencies**:
   ```bash
   npm install
   # or
   yarn install
   ```
4. **Create a new branch** for your feature or fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Making Changes

### Code Style

- Follow the existing code style and conventions
- Use TypeScript for all new code
- Add appropriate type annotations
- Write clear, descriptive variable and function names

### Testing

- Add tests for new features or bug fixes
- Ensure all existing tests pass before submitting
- Run tests with: `npm test`

### Documentation

- Update documentation if your changes affect user-facing functionality
- Add JSDoc comments for new functions and classes
- Update README.md if needed

## Submitting Your Changes

### Before You Submit

1. **Test your changes** thoroughly
2. **Run the linter** to check for code style issues
3. **Make sure all tests pass**
4. **Update documentation** if necessary

### Creating a Pull Request

1. **Conventional commits** for your commit messages. For details, see [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

2. **Conventional branch names** for your branch names. For details, see [Conventional Branches](https://conventional-branch.github.io/). For example, `feat/add-new-feature` or `bugfix/fix-123`.

3. **Push your branch** to your fork:

   ```bash
   git push origin feature/your-feature-name
   ```

4. **Create a pull request** on GitHub:

   - Go to the main repository
   - Click "New Pull Request"
   - Select your branch
   - Fill out the pull request template

5. **Write a clear description** that includes:
   - What changes you made
   - Why you made them
   - Any relevant issue numbers (e.g., "Fixes #123")

### Pull Request Guidelines

- **One feature per PR**: Keep pull requests focused on a single feature or fix
- **Clear title**: Use a descriptive title that explains what the PR does
- **Detailed description**: Explain the changes and why they're needed
- **Link issues**: Reference any related issues in your description. Non-issue PRs will not be merged.

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

Example:

```
v1.0.1 - Bug fix release
v1.1.0 - New feature release
v2.0.0 - Breaking changes release
```

## Development Workflow

1. **Create feature branch** from main
2. **Make changes** and commit
3. **Open pull request** to main
4. **Code review** and approval
5. **Squash and merge** to main
6. **When ready for release**: Create GitHub release manually
7. **Automatic publishing** to npm happens via GitHub Actions

## Code Review Process

1. **Maintainers will review** your pull request
2. **Address feedback** if requested
3. **Make changes** by pushing new commits to your branch
4. **Once approved**, maintainers will merge your PR

## Types of Contributions

We welcome various types of contributions:

- **Bug fixes**: Help us fix issues and improve stability
- **New features**: Add new functionality to the CLI
- **Documentation**: Improve guides, examples, and API docs
- **Testing**: Add or improve test coverage
- **Performance**: Optimize existing code

## Getting Help

If you need help or have questions:

- **Check existing issues** on GitHub
- **Open a new issue** if you find a bug or want to suggest a feature
- **Join discussions** in existing issues and pull requests

## Code of Conduct

Please be respectful and constructive in all interactions. We're all here to make this project better!

## Questions?

If you have any questions about contributing, feel free to open an issue or reach out to the maintainers.

Thank you for contributing! 🚀
