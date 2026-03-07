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

1. **Run all checks** to ensure everything passes:

   ```bash
   npm ci
   npx tsc --noEmit
   npx prettier --check "src/**/*.{ts,js,json}"
   npm run build
   npm pack && npm install -g firebase-tools-cli-*.tgz && firebase-tools-cli --help
   ```

2. **Update documentation** if your changes affect user-facing functionality.

### Commit Message Convention

All commit messages **must** follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). This is enforced by the **Commitlint** CI workflow — non-conforming commits will fail the check.

**Format:** `type(scope)!: subject`

| Field | Details |
|-------|---------|
| `type` | `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert` |
| `scope` | Optional: `cli`, `firestore`, `rtdb`, `remote-config`, `auth`, `config`, `release`, `docs`, `deps` |
| `!` | Optional: marks a breaking change |
| `subject` | Describe the change (no format enforcement) |

**Examples:**

```
feat(cli): add --dry-run flag to firestore export
fix(rtdb): handle missing databaseURL gracefully
docs: update README with new auth commands
chore: bump version to 0.6.0
```

### PR Title Convention

PR titles **must** follow the same Conventional Commits format as commit messages. This is enforced by the **Conventional PR Title** CI workflow.

```
type(scope)!: subject
```

**Common failure messages:**

- `❌ PR title does not follow Conventional Commits format.` — Fix: rename your PR title to match the format above.
- `✖ type must be one of [feat, fix, ...]` (commitlint) — Fix: use an allowed type.

### Branch Naming Conventions

Follow the pattern `type/short-description`:

```
feat/add-auth-login
fix/rtdb-timeout
docs/update-contributing
chore/bump-dependencies
```

### Creating a Pull Request

1. **Push your branch** to your fork:

   ```bash
   git push origin feat/your-feature-name
   ```

2. **Create a pull request** on GitHub:

   - Go to the main repository
   - Click "New Pull Request"
   - Select your branch
   - Fill out the pull request template

3. **Write a clear description** that includes:
   - What changes you made
   - Why you made them
   - Any relevant issue numbers (e.g., "Fixes #123")

### Pull Request Guidelines

- **One feature per PR**: Keep pull requests focused on a single feature or fix
- **Conventional title**: PR title must follow the Conventional Commits format — enforced by CI
- **Conventional commits**: All commits must follow Conventional Commits — enforced by CI
- **Detailed description**: Explain the changes and why they're needed
- **Link issues**: Reference any related issues in your description. Non-issue PRs will not be merged.

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
