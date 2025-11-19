#!/bin/bash

# Helper script to create test branches and commits for testing the release workflow
# This script helps developers quickly test different release scenarios

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
	echo ""
	echo -e "${BLUE}=== $1 ===${NC}"
	echo ""
}

print_info() {
	echo -e "${YELLOW}→${NC} $1"
}

print_success() {
	echo -e "${GREEN}✓${NC} $1"
}

# Check if we're in a git repository
if [ ! -d ".git" ]; then
	echo "Error: Not in a git repository"
	exit 1
fi

# Check if extension directory exists
if [ ! -d "extension" ]; then
	echo "Error: extension directory not found"
	exit 1
fi

print_header "Extension Release Workflow Test Helper"

echo "This script helps you create test branches and commits to test the release workflow."
echo ""
echo "Available test scenarios:"
echo "  1. Feature release (minor version bump) - feature/test-*"
echo "  2. Bug fix release (patch version bump) - hotfix/test-*"
echo "  3. Breaking change (major version bump) - feature/test-*"
echo "  4. Development prerelease - dev/test-*"
echo "  5. Path filtering test (non-extension changes)"
echo ""

read -p "Select a scenario (1-5): " scenario

case $scenario in
1)
	print_header "Creating Feature Release Test"
	BRANCH_NAME="feature/test-release-$(date +%s)"
	COMMIT_MSG="feat: add test feature for release workflow validation

This commit tests the feature release workflow with a minor version bump."
	FILE_TO_MODIFY="extension/popup.js"
	CHANGE_CONTENT="// Test feature added at $(date)"
	;;
2)
	print_header "Creating Bug Fix Release Test"
	BRANCH_NAME="hotfix/test-bugfix-$(date +%s)"
	COMMIT_MSG="fix: resolve test issue for release workflow validation

This commit tests the bug fix release workflow with a patch version bump."
	FILE_TO_MODIFY="extension/content.js"
	CHANGE_CONTENT="// Bug fix applied at $(date)"
	;;
3)
	print_header "Creating Breaking Change Test"
	BRANCH_NAME="feature/test-breaking-$(date +%s)"
	COMMIT_MSG="feat!: introduce breaking change for release workflow validation

BREAKING CHANGE: This commit tests the breaking change workflow with a major version bump.
The exclamation mark in the commit type indicates a breaking change."
	FILE_TO_MODIFY="extension/background.js"
	CHANGE_CONTENT="// Breaking change introduced at $(date)"
	;;
4)
	print_header "Creating Development Prerelease Test"
	BRANCH_NAME="dev/test-prerelease-$(date +%s)"
	COMMIT_MSG="feat: add development feature for prerelease testing

This commit tests the development prerelease workflow."
	FILE_TO_MODIFY="extension/settings.js"
	CHANGE_CONTENT="// Development feature added at $(date)"
	;;
5)
	print_header "Creating Path Filtering Test"
	BRANCH_NAME="test/path-filter-$(date +%s)"
	COMMIT_MSG="docs: update documentation (should not trigger extension release)

This commit modifies non-extension files to test path filtering."
	FILE_TO_MODIFY="README.md"
	CHANGE_CONTENT="<!-- Test change at $(date) -->"
	;;
*)
	echo "Invalid selection"
	exit 1
	;;
esac

print_info "Branch name: $BRANCH_NAME"
print_info "File to modify: $FILE_TO_MODIFY"
echo ""

# Check if there are uncommitted changes
if ! git diff-index --quiet HEAD --; then
	echo "Warning: You have uncommitted changes. Please commit or stash them first."
	exit 1
fi

# Create and checkout new branch
print_info "Creating branch: $BRANCH_NAME"
git checkout -b "$BRANCH_NAME"
print_success "Branch created"

# Make the change
print_info "Modifying file: $FILE_TO_MODIFY"
echo "" >>"$FILE_TO_MODIFY"
echo "$CHANGE_CONTENT" >>"$FILE_TO_MODIFY"
print_success "File modified"

# Stage the change
print_info "Staging changes"
git add "$FILE_TO_MODIFY"
print_success "Changes staged"

# Show the diff
echo ""
echo "Changes to be committed:"
git diff --cached "$FILE_TO_MODIFY"
echo ""

# Commit
print_info "Creating commit"
git commit -m "$COMMIT_MSG"
print_success "Commit created"

# Show commit details
echo ""
echo "Commit details:"
git log -1 --pretty=format:"%h - %s%n%b" HEAD
echo ""
echo ""

print_header "Next Steps"

if [ "$scenario" = "5" ]; then
	echo "This test should NOT trigger the extension release workflow."
	echo ""
	echo "To test:"
	echo "  1. Push the branch: git push origin $BRANCH_NAME"
	echo "  2. Go to GitHub Actions tab"
	echo "  3. Verify that 'Extension Release' workflow does NOT run"
	echo "  4. Other workflows may run, but extension release should be skipped"
else
	echo "This test should trigger the extension release workflow."
	echo ""
	echo "To test:"
	echo "  1. Push the branch: git push origin $BRANCH_NAME"
	echo "  2. Go to GitHub Actions tab"
	echo "  3. Wait for 'Extension Release' workflow to complete"
	echo "  4. Check GitHub Releases for the new release"
	echo "  5. Verify:"
	echo "     - Version was updated in manifest.json"
	echo "     - CHANGELOG.md was generated"
	echo "     - ZIP artifact was attached to release"
	echo "     - Release is marked as prerelease (for non-main branches)"
fi

echo ""
echo "To push the branch now, run:"
echo -e "${GREEN}git push origin $BRANCH_NAME${NC}"
echo ""
echo "To return to your previous branch:"
echo -e "${GREEN}git checkout -${NC}"
echo ""
echo "To delete this test branch later:"
echo -e "${GREEN}git branch -D $BRANCH_NAME${NC}"
echo -e "${GREEN}git push origin --delete $BRANCH_NAME${NC}"
