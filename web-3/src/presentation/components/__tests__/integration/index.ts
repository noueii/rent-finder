// Integration test exports for easy importing
export * from './test-utils';

// Re-export test suites for reference
export { default as SearchPageIntegrationTests } from './SearchPageIntegration.test';
export { default as ApartmentCardIntegrationTests } from './ApartmentCardIntegration.test';
export { default as FormIntegrationTests } from './FormIntegration.test';
export { default as StateManagementIntegrationTests } from './StateManagementIntegration.test';

// Test helpers
export const integrationTestSuites = [
  'SearchPageIntegration',
  'ApartmentCardIntegration', 
  'FormIntegration',
  'StateManagementIntegration',
] as const;

export type IntegrationTestSuite = typeof integrationTestSuites[number];