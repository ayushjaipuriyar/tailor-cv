const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const scriptPath = path.join(__dirname, 'update-extension-version.js');
const testManifestDir = path.join(__dirname, '../extension');
const testManifestPath = path.join(testManifestDir, 'manifest.json');

describe('update-extension-version script', () => {
    let originalManifest;

    beforeEach(() => {
        // Backup original manifest
        if (fs.existsSync(testManifestPath)) {
            originalManifest = fs.readFileSync(testManifestPath, 'utf8');
        }
    });

    afterEach(() => {
        // Restore original manifest
        if (originalManifest) {
            fs.writeFileSync(testManifestPath, originalManifest, 'utf8');
        }
    });

    describe('valid version updates', () => {
        test('updates major version', () => {
            execSync(`node ${scriptPath} 2.0.0`, { cwd: path.join(__dirname, '..') });
            const manifest = JSON.parse(fs.readFileSync(testManifestPath, 'utf8'));
            expect(manifest.version).toBe('2.0.0');
        });

        test('updates minor version', () => {
            execSync(`node ${scriptPath} 1.5.0`, { cwd: path.join(__dirname, '..') });
            const manifest = JSON.parse(fs.readFileSync(testManifestPath, 'utf8'));
            expect(manifest.version).toBe('1.5.0');
        });

        test('updates patch version', () => {
            execSync(`node ${scriptPath} 1.0.7`, { cwd: path.join(__dirname, '..') });
            const manifest = JSON.parse(fs.readFileSync(testManifestPath, 'utf8'));
            expect(manifest.version).toBe('1.0.7');
        });

        test('preserves JSON formatting with 2-space indentation', () => {
            execSync(`node ${scriptPath} 1.2.3`, { cwd: path.join(__dirname, '..') });
            const manifestContent = fs.readFileSync(testManifestPath, 'utf8');

            // Check for 2-space indentation
            expect(manifestContent).toContain('  "manifest_version"');
            expect(manifestContent).toContain('  "version"');
        });

        test('preserves other manifest fields', () => {
            const originalData = JSON.parse(fs.readFileSync(testManifestPath, 'utf8'));
            execSync(`node ${scriptPath} 1.2.3`, { cwd: path.join(__dirname, '..') });
            const updatedData = JSON.parse(fs.readFileSync(testManifestPath, 'utf8'));

            expect(updatedData.manifest_version).toBe(originalData.manifest_version);
            expect(updatedData.name).toBe(originalData.name);
            expect(updatedData.description).toBe(originalData.description);
        });
    });

    describe('invalid version format handling', () => {
        test('rejects invalid version format', () => {
            expect(() => {
                execSync(`node ${scriptPath} invalid`, {
                    cwd: path.join(__dirname, '..'),
                    stdio: 'pipe'
                });
            }).toThrow();
        });

        test('rejects version with only major number', () => {
            expect(() => {
                execSync(`node ${scriptPath} 1`, {
                    cwd: path.join(__dirname, '..'),
                    stdio: 'pipe'
                });
            }).toThrow();
        });

        test('rejects version with only major.minor', () => {
            expect(() => {
                execSync(`node ${scriptPath} 1.2`, {
                    cwd: path.join(__dirname, '..'),
                    stdio: 'pipe'
                });
            }).toThrow();
        });
    });

    describe('missing manifest.json file handling', () => {
        test('handles missing manifest.json file', () => {
            const backupPath = testManifestPath + '.backup';
            fs.renameSync(testManifestPath, backupPath);

            try {
                expect(() => {
                    execSync(`node ${scriptPath} 1.2.3`, {
                        cwd: path.join(__dirname, '..'),
                        stdio: 'pipe'
                    });
                }).toThrow();
            } finally {
                fs.renameSync(backupPath, testManifestPath);
            }
        });
    });

    describe('malformed JSON handling', () => {
        test('handles malformed JSON in manifest', () => {
            const malformedJSON = '{ "version": "1.0.0", invalid }';
            fs.writeFileSync(testManifestPath, malformedJSON, 'utf8');

            expect(() => {
                execSync(`node ${scriptPath} 1.2.3`, {
                    cwd: path.join(__dirname, '..'),
                    stdio: 'pipe'
                });
            }).toThrow();
        });
    });

    describe('no version argument', () => {
        test('exits with error when no version provided', () => {
            expect(() => {
                execSync(`node ${scriptPath}`, {
                    cwd: path.join(__dirname, '..'),
                    stdio: 'pipe'
                });
            }).toThrow();
        });
    });
});
