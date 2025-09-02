/** @type {import('jest').Config} */
module.exports = {
  displayName: 'unit',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/src/**/*.test.ts',
    '<rootDir>/src/**/*.test.tsx',
    '!<rootDir>/src/**/*.integration.test.ts',
    '!<rootDir>/src/infrastructure/testing/**',
    '!<rootDir>/src/presentation/**/*.test.tsx',
    '!<rootDir>/src/presentation/**/*.test.ts',
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
  testTimeout: 10000,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/infrastructure/testing/**',
    '!src/presentation/**',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};