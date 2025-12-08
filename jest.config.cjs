module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/*.test.cjs'],
    collectCoverageFrom: [
        'backend/**/*.cjs',
        '!backend/node_modules/**',
    ],
};