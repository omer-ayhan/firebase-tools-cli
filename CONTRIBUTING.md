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
