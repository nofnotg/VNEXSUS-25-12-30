export default {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/tests/**/*.spec.js',
    '<rootDir>/tests/**/*.test.cjs',
    '<rootDir>/tests/**/*.spec.cjs'
  ],
  collectCoverageFrom: [
    'services/**/*.js',
    'utils/**/*.js',
    '!**/node_modules/**'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  transform: {
    '^.+\.js$': 'babel-jest',
    '^.+\.cjs$': 'babel-jest'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(fs-extra)/)'
  ]
};