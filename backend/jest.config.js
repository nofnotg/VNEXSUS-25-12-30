export default {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/tests/**/*.test.cjs',
    '<rootDir>/tests/**/*.spec.cjs',
    '<rootDir>/tests/unit/ocrController.test.js'
  ],
  collectCoverageFrom: [
    'services/**/*.js',
    'utils/**/*.js',
    '!**/node_modules/**'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testPathIgnorePatterns: [
    '<rootDir>/tests/fileProcessingService.test.js',
    '<rootDir>/tests/largeFileHandler.test.js',
    '<rootDir>/tests/streamProcessingOptimizer.test.js',
    '<rootDir>/tests/progressiveRAG.test.js',
    '<rootDir>/tests/integration/progressiveRAG.integration.test.js'
  ]
};
