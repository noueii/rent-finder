/** @type {import('jest').Config} */
module.exports = {
  displayName: 'integration',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/src/infrastructure/testing/integration/**/*.test.ts',
    '<rootDir>/src/**/*.integration.test.ts',
  ],
  transform: {
    '^.+\\.(t|j)sx?$': '@swc/jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(p-limit|yocto-queue|p-queue|eventemitter3|msw-trpc|msw|@mswjs|strict-event-emitter|cookie|set-cookie-parser|path-to-regexp)/)'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^~/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/src/infrastructure/testing/integration/setup.ts'],
  testTimeout: 30000,
  maxWorkers: 1, // Run integration tests serially
  // Uncomment these when test database is available
  // globalSetup: '<rootDir>/src/infrastructure/testing/integration/global-setup.ts',
  // globalTeardown: '<rootDir>/src/infrastructure/testing/integration/global-teardown.ts',
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/infrastructure/testing/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};