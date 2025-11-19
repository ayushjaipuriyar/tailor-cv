#!/bin/bash

# Script to verify ZIP command availability in GitHub Actions Ubuntu runner
# This can be run locally or in CI to confirm ZIP is available

echo "=== Verifying ZIP Command for GitHub Actions ==="
echo ""

echo "Operating System:"
uname -a
echo ""

echo "Checking ZIP command availability..."
if command -v zip &>/dev/null; then
	echo "✓ ZIP command is available"
	echo ""
	echo "ZIP version:"
	zip -v | head -n 2
	echo ""
	echo "✓ ZIP command is ready for use in workflow"
else
	echo "❌ ZIP command not found"
	echo "Note: Ubuntu runners in GitHub Actions include ZIP by default"
	exit 1
fi

echo ""
echo "=== Verification Complete ==="
