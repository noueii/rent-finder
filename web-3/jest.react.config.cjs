/** @type {import('jest').Config} */
module.exports = {
  displayName: 'react',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.tsx.cjs'],
  testMatch: [
    '<rootDir>/src/presentation/**/*.test.tsx',
    '<rootDir>/src/presentation/**/*.test.ts',
    '<rootDir>/src/components/**/*.test.tsx',
    '<rootDir>/src/components/**/*.test.ts',
    '<rootDir>/src/app/**/*.test.tsx',
    '<rootDir>/src/app/**/*.test.ts',
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
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  testTimeout: 10000,
  collectCoverageFrom: [
    'src/presentation/**/*.{ts,tsx}',
    'src/components/**/*.{ts,tsx}',
    'src/app/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};