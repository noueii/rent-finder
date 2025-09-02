/**
 * End-to-End Test Suite
 * 
 * Comprehensive E2E tests that validate complete user journeys
 * and ensure all refactored components work together seamlessly.
 */

// Export all E2E test suites
export * from './user-registration-flow.test';
export * from './apartment-search-flow.test';
export * from './commute-search-flow.test';
export * from './list-management-flow.test';
export * from './admin-flow.test';

// Test execution helpers
export const runAllE2ETests = () => {
  console.log('Running all E2E tests...');
  
  const testSuites = [
    'user-registration-flow',
    'apartment-search-flow',
    'commute-search-flow',
    'list-management-flow',
    'admin-flow',
  ];

  return testSuites;
};

// Test configuration
export const E2E_TEST_CONFIG = {
  // Timeouts for different test types
  timeouts: {
    registration: 30000,
    search: 20000,
    commute: 25000,
    list: 15000,
    admin: 30000,
  },
  
  // Test data seeds
  seeds: {
    users: 5,
    apartments: 50,
    stations: 20,
    lists: 10,
  },
  
  // Feature flags for conditional tests
  features: {
    emailVerification: true,
    multipleWorkLocations: true,
    listCollaboration: true,
    adminAnalytics: true,
  },
};

// Test utilities
export const E2ETestUtils = {
  /**
   * Wait for async operations to complete
   */
  waitForAsync: (ms: number = 1000) => new Promise(resolve => setTimeout(resolve, ms)),
  
  /**
   * Retry failed operations
   */
  retryOperation: async <T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    delay: number = 1000
  ): Promise<T> => {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts) {
          await E2ETestUtils.waitForAsync(delay);
        }
      }
    }
    
    throw lastError;
  },
  
  /**
   * Verify data consistency across services
   */
  verifyDataConsistency: async (prisma: any, expectedState: any) => {
    const actualState = {
      users: await prisma.user.count(),
      apartments: await prisma.apartment.count(),
      stations: await prisma.station.count(),
      lists: await prisma.list.count(),
    };
    
    return Object.keys(expectedState).every(
      key => actualState[key] === expectedState[key]
    );
  },
};