#!/bin/bash

# Test script to verify ZIP packaging for extension releases
# This validates requirements 3.1, 3.2, 3.3, 3.4

set -e

echo "=== Testing ZIP Packaging for Extension Release ==="
echo ""

# Test version
TEST_VERSION="1.0.0-test"
ZIP_NAME="cv-tailor-extension-v${TEST_VERSION}.zip"

# Clean up any existing test ZIP
if [ -f "$ZIP_NAME" ]; then
	echo "Cleaning up existing test ZIP..."
	rm "$ZIP_NAME"
fi

echo "1. Verifying ZIP command is available..."
if ! command -v zip &>/dev/null; then
	echo "❌ FAIL: ZIP command not found"
	exit 1
fi
echo "✓ ZIP command is available"
echo ""

echo "2. Creating test ZIP package..."
cd extension && zip -r ../"$ZIP_NAME" . -x '*.git*' -x '*node_modules*' -x '*tests*' -x '*.md' -x 'package*.json' && cd ..
echo "✓ ZIP created successfully"
echo ""

echo "3. Verifying ZIP file naming pattern..."
if [ ! -f "$ZIP_NAME" ]; then
	echo "❌ FAIL: ZIP file not found with expected name: $ZIP_NAME"
	exit 1
fi
echo "✓ ZIP file follows naming pattern: cv-tailor-extension-v{version}.zip"
echo ""

echo "4. Extracting ZIP to temporary directory for validation..."
TEST_DIR="test-extract-$$"
mkdir -p "$TEST_DIR"
unzip -q "$ZIP_NAME" -d "$TEST_DIR"
echo "✓ ZIP extracted successfully"
echo ""

echo "5. Verifying runtime files are included..."
REQUIRED_FILES=(
	"manifest.json"
	"background.js"
	"content.js"
	"popup.js"
	"popup.html"
	"popup.css"
	"settings.js"
	"settings.html"
	"settings.css"
	"errors.js"
	"network.js"
	"security.js"
	"validation.js"
	"icons/icon16.png"
	"icons/icon48.png"
	"icons/icon128.png"
)

MISSING_FILES=()
for file in "${REQUIRED_FILES[@]}"; do
	if [ ! -f "$TEST_DIR/$file" ]; then
		MISSING_FILES+=("$file")
	fi
done

if [ ${#MISSING_FILES[@]} -gt 0 ]; then
	echo "❌ FAIL: Missing required runtime files:"
	for file in "${MISSING_FILES[@]}"; do
		echo "  - $file"
	done
	rm -rf "$TEST_DIR"
	rm "$ZIP_NAME"
	exit 1
fi
echo "✓ All required runtime files are included"
echo ""

echo "6. Verifying development files are excluded..."
EXCLUDED_PATTERNS=(
	"*.md"
	".gitignore"
	"tests/"
	"package.json"
	"package-lock.json"
)

FOUND_EXCLUDED=()

# Check for .md files
if ls "$TEST_DIR"/*.md 2>/dev/null | grep -q .; then
	FOUND_EXCLUDED+=("*.md files found")
fi

# Check for .gitignore
if [ -f "$TEST_DIR/.gitignore" ]; then
	FOUND_EXCLUDED+=(".gitignore")
fi

# Check for tests directory
if [ -d "$TEST_DIR/tests" ]; then
	FOUND_EXCLUDED+=("tests/ directory")
fi

# Check for package files
if [ -f "$TEST_DIR/package.json" ] || [ -f "$TEST_DIR/package-lock.json" ]; then
	FOUND_EXCLUDED+=("package*.json files")
fi

if [ ${#FOUND_EXCLUDED[@]} -gt 0 ]; then
	echo "❌ FAIL: Found excluded files/directories that should not be in ZIP:"
	for item in "${FOUND_EXCLUDED[@]}"; do
		echo "  - $item"
	done
	rm -rf "$TEST_DIR"
	rm "$ZIP_NAME"
	exit 1
fi
echo "✓ All development files are properly excluded"
echo ""

echo "7. Listing ZIP contents for verification..."
echo "Files in ZIP:"
unzip -l "$ZIP_NAME" | tail -n +4 | head -n -2
echo ""

# Clean up
echo "8. Cleaning up test files..."
rm -rf "$TEST_DIR"
rm "$ZIP_NAME"
echo "✓ Cleanup complete"
echo ""

echo "=== All ZIP Packaging Tests Passed ✓ ==="
echo ""
echo "Summary:"
echo "  ✓ ZIP command is available in environment"
echo "  ✓ ZIP creation excludes development files (tests, .md, .gitignore)"
echo "  ✓ ZIP includes all runtime files (js, html, css, manifest.json, icons)"
echo "  ✓ ZIP file naming follows pattern: cv-tailor-extension-v{version}.zip"
