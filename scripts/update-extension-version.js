#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Updates the version field in extension/manifest.json
 * Usage: node scripts/update-extension-version.js <version>
 */

// Validate semantic version format
function isValidSemanticVersion(version) {
    const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/;
    return semverRegex.test(version);
}

function updateExtensionVersion(newVersion) {
    const manifestPath = path.join(process.cwd(), 'extension', 'manifest.json');

    // Validate version format
    if (!isValidSemanticVersion(newVersion)) {
        console.error(`Error: Invalid semantic version format: ${newVersion}`);
        console.error('Expected format: MAJOR.MINOR.PATCH (e.g., 1.2.3)');
        process.exit(1);
    }

    // Check if manifest.json exists
    if (!fs.existsSync(manifestPath)) {
        console.error(`Error: manifest.json not found at ${manifestPath}`);
        process.exit(1);
    }

    // Read and parse manifest.json
    let manifestContent;
    let manifest;

    try {
        manifestContent = fs.readFileSync(manifestPath, 'utf8');
    } catch (error) {
        console.error(`Error: Failed to read manifest.json: ${error.message}`);
        process.exit(1);
    }

    try {
        manifest = JSON.parse(manifestContent);
    } catch (error) {
        console.error(`Error: Failed to parse manifest.json: ${error.message}`);
        console.error('The file may contain malformed JSON');
        process.exit(1);
    }

    // Update version field
    const oldVersion = manifest.version;
    manifest.version = newVersion;

    // Write updated JSON back to file with 2-space indentation
    try {
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
        console.log(`Successfully updated extension version from ${oldVersion} to ${newVersion}`);
    } catch (error) {
        console.error(`Error: Failed to write manifest.json: ${error.message}`);
        process.exit(1);
    }
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0) {
    console.error('Error: No version specified');
    console.error('Usage: node scripts/update-extension-version.js <version>');
    console.error('Example: node scripts/update-extension-version.js 1.2.3');
    process.exit(1);
}

const newVersion = args[0];
updateExtensionVersion(newVersion);
