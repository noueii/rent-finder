# Integration Testing Framework

This directory contains the integration testing framework for the Tokyo Apartment Finder application.

## Overview

The integration testing framework provides utilities and helpers for testing the complete application flow, including:
- API endpoints
- Database operations
- External service integrations
- Scraper functionality
- End-to-end user flows

## Structure

```
integration/
├── setup.ts              # Test environment setup and configuration
├── api-helpers.ts        # Utilities for testing tRPC API endpoints
├── fixtures.ts           # Test data factories and seeding functions
├── mocks.ts              # Mock external services and responses
├── index.ts              # Central exports
├── __tests__/
│   ├── api.test.ts       # API endpoint integration tests
│   ├── full-flow.test.ts # End-to-end user flow tests
│   └── scraper.test.ts   # Scraper integration tests
└── README.md             # This file
```

## Setup

### Prerequisites

1. Docker running with PostgreSQL test database:
```bash
docker run -d \
  --name rentfinder-test-db \
  -e POSTGRES_USER=test \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=rentfinder_test \
  -p 5433:5432 \
  postgres:15
```

2. Test environment variables in `.env.test`:
```env
DATABASE_URL="postgresql://test:test@localhost:5433/rentfinder_test"
NODE_ENV="test"
```

### Installation

```bash
# Install testing dependencies
npm install --save-dev @jest/globals jest-mock-extended msw msw-trpc @faker-js/faker
```

## Usage

### Running Tests

```bash
# Run all integration tests
npm run test:integration

# Run specific test suite
npm run test:integration -- api.test.ts

# Run with coverage
npm run test:integration -- --coverage
```

### Test Utilities

#### 1. Test Environment Setup

```typescript
import { setupTestEnvironment } from '@/infrastructure/testing/integration';

// Add to your test file
setupTestEnvironment();
```

#### 2. Database Helpers

```typescript
import { createTestPrismaClient, clearDatabase, seedDatabase } from '@/infrastructure/testing/integration';

// Create test database connection
const prisma = await createTestPrismaClient();

// Clear all data
await clearDatabase(prisma);

// Seed with test data
const { users, stations, apartments } = await seedDatabase(prisma);
```

#### 3. API Testing

```typescript
import { createTestTRPCClient, testTRPCProcedure } from '@/infrastructure/testing/integration';

// Create test client
const trpc = createTestTRPCClient();

// Test a procedure
const result = await testTRPCProcedure(
  apartmentRouter.searchByCommute,
  { workStationId: 'test-id', maxCommuteTime: 30 },
  { session: mockSession }
);
```

#### 4. Test Data Factories

```typescript
import { factories } from '@/infrastructure/testing/integration';

// Create test entities
const user = factories.user({ email: 'test@example.com' });
const apartment = factories.apartment({ rent: 100000 });
const station = factories.station({ name: 'Test Station' });
```

#### 5. Mock External Services

```typescript
import { server, externalServiceHandlers, mockServiceFailure } from '@/infrastructure/testing/integration';

// Use mock handlers
server.use(...externalServiceHandlers);

// Simulate service failure
server.use(mockServiceFailure('suumo'));
```

## Test Patterns

### 1. API Endpoint Testing

```typescript
describe('Apartment API', () => {
  it('should search apartments by commute time', async () => {
    // Arrange
    const { stations } = await seedDatabase(prisma);
    
    // Act
    const results = await trpc.apartments.searchByCommute.query({
      workStationId: stations[0].id,
      maxCommuteTime: 30,
    });
    
    // Assert
    expect(results.apartments).toHaveLength(greaterThan(0));
  });
});
```

### 2. Full Flow Testing

```typescript
describe('User Journey', () => {
  it('should complete search to favorite flow', async () => {
    // Search → View Details → Add to Favorites
    const search = await trpc.apartments.search.query({...});
    const details = await trpc.apartments.getById.query({ id: search[0].id });
    const favorite = await trpc.users.addFavorite.mutate({ apartmentId: details.id });
    
    expect(favorite).toBeDefined();
  });
});
```

### 3. Error Handling

```typescript
describe('Error Cases', () => {
  it('should handle external service failures', async () => {
    server.use(mockServiceFailure('transit-api'));
    
    const result = await trpc.stations.getReachable.query({...});
    
    expect(result.error).toBeDefined();
    expect(result.fallbackData).toBeDefined();
  });
});
```

### 4. Concurrent Operations

```typescript
describe('Concurrency', () => {
  it('should handle multiple users', async () => {
    const operations = users.map(user =>
      trpc.apartments.search.query({...})
    );
    
    const results = await Promise.all(operations);
    
    expect(results).toHaveLength(users.length);
  });
});
```

## Best Practices

1. **Isolation**: Each test should be independent
   - Clear database before each test
   - Reset mock handlers
   - Don't rely on test order

2. **Realistic Data**: Use factories for consistent test data
   - Use faker for realistic values
   - Create complete object graphs
   - Test edge cases

3. **Performance**: Keep tests fast
   - Use transactions for cleanup
   - Minimize database operations
   - Mock external services

4. **Debugging**: Make failures clear
   - Use descriptive test names
   - Add context to assertions
   - Log important state

5. **Coverage**: Test critical paths
   - Happy paths
   - Error cases
   - Edge cases
   - Concurrent operations

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Ensure test database is running
   - Check DATABASE_URL in .env.test
   - Verify migrations are applied

2. **Timeout Errors**
   - Increase jest timeout: `jest.setTimeout(30000)`
   - Check for missing await statements
   - Verify external service mocks

3. **Flaky Tests**
   - Add proper cleanup in afterEach
   - Don't rely on timing
   - Use waitFor for async operations

4. **Mock Not Working**
   - Ensure MSW server is started
   - Check handler URL patterns
   - Verify mock is registered before test

## Future Enhancements

1. **Visual Regression Testing**
   - Screenshot comparisons
   - Component visual tests

2. **Performance Testing**
   - Load testing for scrapers
   - API response time benchmarks

3. **Contract Testing**
   - External API contract validation
   - Schema compatibility checks

4. **Monitoring Integration**
   - Test metric collection
   - Error tracking validation

## Contributing

When adding new integration tests:

1. Follow existing patterns
2. Add appropriate helpers if needed
3. Document complex test scenarios
4. Ensure tests are deterministic
5. Keep tests focused and fast

Remember: Integration tests verify that different parts of the system work together correctly. They should test realistic scenarios while remaining maintainable and reliable.