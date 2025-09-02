# End-to-End Test Suite

Comprehensive E2E tests that validate complete user journeys and ensure all refactored components work together seamlessly.

## Overview

This directory contains end-to-end tests that simulate real user workflows through the entire application. These tests verify that all layers of the application (UI, API, business logic, database) work correctly together.

## Test Structure

### 1. User Registration Flow (`user-registration-flow.test.ts`)
Tests the complete new user journey:
- User registration with email/password
- Email verification process
- Setting user preferences
- Performing first apartment search
- Error handling for invalid inputs
- Email verification edge cases

### 2. Apartment Search Flow (`apartment-search-flow.test.ts`)
Tests various apartment search scenarios:
- Search by station with filters
- Multi-filter complex searches
- Pagination and sorting
- Viewing apartment details
- Saving search results to lists
- Search history tracking
- Recommendations based on views

### 3. Commute Search Flow (`commute-search-flow.test.ts`)
Tests commute-based apartment searching:
- Setting target work station
- Finding reachable stations within time limit
- Searching apartments by commute time
- Comparing apartments by commute
- Multiple work locations
- Rush hour vs off-peak considerations
- Commute analytics and insights

### 4. List Management Flow (`list-management-flow.test.ts`)
Tests apartment list features:
- Creating and organizing lists
- Adding/removing apartments
- List sharing and collaboration
- Folders and organization
- List templates and duplication
- Permissions and privacy
- Analytics and comparisons
- Bulk operations

### 5. Admin Flow (`admin-flow.test.ts`)
Tests administrative functions:
- Admin authentication
- System statistics and monitoring
- Scraper management and execution
- Viewing logs and health checks
- Data cleanup and maintenance
- User management
- Batch operations
- Analytics and insights

## Running the Tests

### Run all E2E tests:
```bash
npm run test:e2e
```

### Run specific test suite:
```bash
npm run test:e2e -- user-registration-flow
npm run test:e2e -- apartment-search-flow
npm run test:e2e -- commute-search-flow
npm run test:e2e -- list-management-flow
npm run test:e2e -- admin-flow
```

### Run with coverage:
```bash
npm run test:e2e:coverage
```

## Test Environment Setup

The tests use the integration test framework from the Infrastructure layer:

1. **Database**: Tests use a separate test database that's cleared before each test
2. **API Mocking**: Uses MSW (Mock Service Worker) for external API calls
3. **Authentication**: Mock sessions are created for authenticated tests
4. **Test Data**: Factory functions create consistent test data

## Writing New E2E Tests

When adding new E2E tests:

1. **Focus on User Journeys**: Test complete workflows, not individual functions
2. **Use Real Services**: Integrate actual services (with test database)
3. **Test Happy Path + Edge Cases**: Cover both success and error scenarios
4. **Keep Tests Independent**: Each test should set up its own data
5. **Use Descriptive Names**: Make it clear what journey is being tested

### Example Structure:
```typescript
describe('E2E: Feature Flow', () => {
  // Setup
  beforeAll(async () => {
    // Initialize test environment
  });

  describe('Complete User Journey', () => {
    it('should complete full flow from start to finish', async () => {
      // Step 1: Initial action
      console.log('Step 1: Description...');
      // Test code...

      // Step 2: Follow-up action
      console.log('Step 2: Description...');
      // Test code...

      // Verify final state
      console.log('✅ Flow completed successfully!');
    });
  });
});
```

## Test Data Management

### Factories
Use the factory functions from the integration framework:
```typescript
import { factories } from '@/infrastructure/testing/integration';

const user = factories.user();
const apartment = factories.apartment();
const station = factories.station();
```

### Database Cleanup
Tests automatically clear the database before each test:
```typescript
beforeEach(async () => {
  await clearDatabase(prisma);
});
```

## Debugging Tests

### Enable Verbose Logging:
```bash
DEBUG=* npm run test:e2e
```

### Run Single Test:
```typescript
it.only('should test specific scenario', async () => {
  // Test code
});
```

### Inspect Database State:
```typescript
// Add console logs to inspect data
console.log(await prisma.apartment.findMany());
```

## Performance Considerations

- E2E tests are slower than unit tests
- Run in parallel where possible
- Use test database with minimal indexes
- Mock external services (geocoding, transit APIs)
- Set reasonable timeouts for async operations

## CI/CD Integration

These tests should run:
- On every pull request
- Before deployment to staging
- As smoke tests after production deployment
- Nightly for comprehensive validation

## Maintenance

Keep tests maintainable by:
- Using page object pattern for UI interactions
- Extracting common flows to helper functions
- Keeping test data minimal but realistic
- Updating tests when features change
- Removing obsolete test scenarios