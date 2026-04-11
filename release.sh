#!/usr/bin/env bash
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <version>" >&2
  echo "Example: $0 1.2.0" >&2
  exit 1
fi

VERSION="$1"
SCRIPT_DIR="$(dirname "$0")"
MANIFEST="$SCRIPT_DIR/manifest.json"

# Validate semantic versioning (MAJOR.MINOR.PATCH, optional -prerelease and +build)
if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$'; then
  echo "Error: '$VERSION' is not a valid semantic version (expected format: MAJOR.MINOR.PATCH)" >&2
  exit 1
fi

# Check that the git tag v<version> does not already exist
TAG="v$VERSION"
if git -C "$SCRIPT_DIR" rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Error: git tag '$TAG' already exists" >&2
  exit 1
fi

# Check that the version is higher than the highest existing version tag
LATEST_TAG=$(git -C "$SCRIPT_DIR" tag --list 'v[0-9]*' --sort=-version:refname | head -n1)
if [ -n "$LATEST_TAG" ]; then
  LATEST_VERSION="${LATEST_TAG#v}"
  # Compare using sort -V: if the new version sorts equal or before the latest, it's not higher
  HIGHER=$(printf '%s\n%s\n' "$LATEST_VERSION" "$VERSION" | sort -V | tail -n1)
  if [ "$HIGHER" != "$VERSION" ] || [ "$VERSION" = "$LATEST_VERSION" ]; then
    echo "Error: version '$VERSION' is not higher than the latest tag '$LATEST_TAG'" >&2
    exit 1
  fi
fi

if [ ! -f "$MANIFEST" ]; then
  echo "Error: manifest.json not found at $MANIFEST" >&2
  exit 1
fi

sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" "$MANIFEST"

echo "Version set to $VERSION in manifest.json"

git add "manifest.json" &&
  git commit -m "Version $VERSION" &&
  git push &&
  git tag "v$VERSION" &&
  git push origin "v$VERSION" &&
  zip -r "modal-browsing-$VERSION.zip" *.js LICENSE *.json *.html icons
