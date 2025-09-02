# Core Testing Infrastructure

Comprehensive testing utilities and helpers for the Tokyo Apartment Finder application.

## Overview

This module provides all the necessary tools for writing effective tests:
- Test helpers and utilities
- Mock factories for generating test data
- Database testing utilities
- Common test fixtures
- Global test setup

## Modules

### Helpers (`helpers.ts`)
General testing utilities:
```typescript
import { createMock, waitFor, suppressConsole } from '@/core/testing';

// Create a mock object
const mockService = createMock<UserService>({
  getUser: async () => userFixture,
});

// Wait for condition
await waitFor(() => screen.getByText('Loaded'));

// Suppress console output
const { getConsoleOutput } = suppressConsole();
```

### Factories (`factories.ts`)
Generate test data with realistic values:
```typescript
import { userFactory, apartmentFactory, stationFactory } from '@/core/testing';

// Create single instance
const user = userFactory.build();
const apartment = apartmentFactory.build({ rent: 100000 });

// Create multiple instances
const apartments = apartmentFactory.buildMany(10);

// Use test IDs
const userId = testIds.userId(1); // 'user_test_1'
```

### Database (`database.ts`)
Test database management:
```typescript
import { createTestDatabase, dbHelpers } from '@/core/testing';

// Setup test database
const { prisma, seed } = createTestDatabase();

// Seed data
await seed({
  users: [userFixture],
  stations: [stationFixture],
});

// Use helpers
const count = await dbHelpers.count(prisma, 'User');
const exists = await dbHelpers.exists(prisma, 'User', { email: 'test@example.com' });
```

### Fixtures (`fixtures.ts`)
Pre-defined test data:
```typescript
import { stationFixtures, apartmentFixtures, userFixtures } from '@/core/testing';

// Use real station data
const shinjuku = stationFixtures.shinjuku;
const commuteTime = transitFixtures.commuteTime(shinjuku.id, shibuya.id);

// Use apartment fixtures
const budgetApartment = apartmentFixtures.budget1K;
```

## Writing Tests

### Unit Tests
```typescript
import { describe, it, expect, vi } from '@/core/testing';

describe('calculateRent', () => {
  it('should include maintenance fee', () => {
    const result = calculateRent(100000, 5000);
    expect(result).toBe(105000);
  });
});
```

### Integration Tests
```typescript
import { createTestDatabase, apartmentFactory } from '@/core/testing';

describe('ApartmentRepository', () => {
  const { prisma } = createTestDatabase();
  
  it('should create apartment', async () => {
    const data = apartmentFactory.build();
    const apartment = await repository.create(data);
    
    expect(apartment.id).toBeDefined();
    expect(await dbHelpers.exists(prisma, 'Apartment', { id: apartment.id })).toBe(true);
  });
});
```

### Component Tests
```typescript
import { render, screen, userEvent } from '@/core/testing';

describe('ApartmentCard', () => {
  it('should display apartment details', () => {
    render(<ApartmentCard apartment={apartmentFixtures.standard1LDK} />);
    
    expect(screen.getByText('メゾン青山')).toBeInTheDocument();
    expect(screen.getByText('¥120,000')).toBeInTheDocument();
  });
});
```

## Best Practices

1. **Use factories for test data** - Generates realistic, consistent data
2. **Use fixtures for static data** - Real station names, common scenarios
3. **Clean up after tests** - Database is automatically cleared between tests
4. **Mock external dependencies** - Use `createMock` for type-safe mocks
5. **Test both success and error cases** - Use `testPatterns.testError`
6. **Use meaningful test descriptions** - Describe what, not how

## Configuration

### Test Environment
- Configured in `vitest.config.ts`
- Uses `setup.ts` for global configuration
- Test database URL: `postgresql://test:test@localhost:5432/test_[random]`

### Running Tests
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run specific test file
npm test apartment.test.ts
```

## Common Patterns

### Testing Async Operations
```typescript
const { result, duration } = await measureTime(async () => {
  return await fetchApartments();
});

expect(duration).toBeLessThan(1000);
expect(result).toHaveLength(10);
```

### Testing Error Handling
```typescript
await expectToReject(
  apartmentService.create(invalidData),
  ValidationError,
  /Invalid apartment data/
);
```

### Testing with Context
```typescript
const ctx = createTestContext(async () => ({
  user: await userFactory.build(),
  apartment: await apartmentFactory.build(),
}));

it('should work with context', () => {
  expect(ctx.user.id).toBeDefined();
});
```

## Owner: DO (DevOps Agent)