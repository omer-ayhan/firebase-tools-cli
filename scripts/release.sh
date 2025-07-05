#!/bin/bash
set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 <version>"
    echo "Example: $0 0.5.2"
    exit 1
fi

VERSION=$1

# Update package.json version
npm version $VERSION --no-git-tag-version

# Commit changes
git add package.json
git commit -m "chore: bump version to $VERSION"

# Create and push tag
git tag "v$VERSION"
git push origin main
git push origin "v$VERSION"

echo "Release v$VERSION initiated!"