module.exports = {
    testEnvironment: 'jsdom',
    testMatch: ['**/extension/**/*.test.js', '**/scripts/**/*.test.js'],
    setupFilesAfterEnv: ['<rootDir>/extension/tests/setup.js'],
    collectCoverageFrom: [
        'extension/**/*.js',
        '!extension/**/*.test.js',
        '!extension/tests/**',
        '!extension/icons/**',
        'scripts/**/*.js',
        '!scripts/**/*.test.js'
    ],
    coverageDirectory: 'extension/tests/coverage',
    verbose: true
};
