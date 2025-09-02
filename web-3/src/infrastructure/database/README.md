# Database Infrastructure

This module provides the Prisma-based implementation of the repository pattern defined in the domain layer.

## Overview

The database infrastructure layer provides:
- Generic base repository implementation using Prisma
- Type-safe mapping between Prisma models and domain entities
- Transaction support
- Advanced filtering and pagination
- Proper error handling and transformation

## Usage

### Creating a Repository

For simple entities that map 1:1 with Prisma models:

```typescript
import { SimplePrismaRepository } from '~/infrastructure/database';
import { PrismaClient } from '@prisma/client';
import type { User } from '~/domain/entities';

const prisma = new PrismaClient();
const userRepository = new SimplePrismaRepository<User>(prisma, 'user');
```

For complex entities that need custom mapping:

```typescript
import { PrismaBaseRepository } from '~/infrastructure/database';
import { PrismaClient, Prisma } from '@prisma/client';
import type { Apartment as DomainApartment } from '~/domain/entities';
import type { Apartment as PrismaApartment } from '@prisma/client';

export class ApartmentRepository extends PrismaBaseRepository<DomainApartment, PrismaApartment> {
  protected readonly modelName = 'apartment' as Prisma.ModelName;

  protected toDomain(model: PrismaApartment): DomainApartment {
    // Custom mapping logic
    return {
      ...model,
      // Transform Prisma types to domain types
      nearbyStations: model.nearbyStations as any, // Parse JSON
    };
  }

  protected toPrisma(entity: Partial<DomainApartment>): any {
    const { id, createdAt, updatedAt, ...data } = entity;
    return {
      ...data,
      // Transform domain types to Prisma types
    };
  }
}
```

### Using the Repository

```typescript
// Find by ID
const user = await userRepository.findById('123');

// Find with filtering and pagination
const apartments = await apartmentRepository.findMany(
  {
    where: {
      price: { lte: 100000 },
      area: 'Shibuya',
      AND: [
        { size: { gte: 25 } },
        { removed: false }
      ]
    }
  },
  {
    page: 1,
    limit: 20,
    orderBy: { price: 'asc' },
    include: ['images', 'nearestStations']
  }
);

// Create entity
const newUser = await userRepository.create({
  email: 'test@example.com',
  name: 'Test User',
  role: 'USER'
});

// Update entity
const updated = await userRepository.update('123', {
  name: 'Updated Name'
});

// Delete entity
await userRepository.delete('123');

// Check existence
const exists = await userRepository.exists({ email: 'test@example.com' });

// Count entities
const count = await userRepository.count({ role: 'USER' });

// Transactions
const result = await userRepository.transaction(async (repo) => {
  const user = await repo.create({ ... });
  await repo.update(user.id, { ... });
  return user;
});
```

## Advanced Filtering

The repository supports complex where conditions:

```typescript
const results = await repository.findMany({
  where: {
    // Logical operators
    AND: [
      { price: { lte: 100000 } },
      { size: { gte: 25 } }
    ],
    OR: [
      { area: 'Shibuya' },
      { area: 'Shinjuku' }
    ],
    NOT: {
      removed: true
    },
    
    // Field operators
    name: { contains: 'Tokyo' },
    price: { 
      gte: 50000,
      lte: 100000 
    },
    area: { in: ['Shibuya', 'Shinjuku', 'Roppongi'] },
    description: { startsWith: 'Luxury' }
  }
});
```

## Error Handling

The repository automatically transforms Prisma errors to domain errors:

- `P2002` (Unique constraint) → `ConflictError`
- `P2003` (Foreign key constraint) → `ValidationError`
- `P2025` (Record not found) → `NotFoundError`
- Validation errors → `ValidationError`
- Connection errors → `ServiceUnavailableError`

```typescript
try {
  await repository.update('non-existent-id', { name: 'Test' });
} catch (error) {
  if (error instanceof NotFoundError) {
    // Handle not found
  }
}
```

## Testing

The repository can be easily mocked for testing:

```typescript
// Mock the Prisma client
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    // ... other methods
  }
} as unknown as PrismaClient;

const repository = new UserRepository(mockPrisma);

// Test your code
mockPrisma.user.findUnique.mockResolvedValue({ id: '1', ... });
const user = await repository.findById('1');
```

## Best Practices

1. **Always use domain types** in your application code, never Prisma types
2. **Handle errors appropriately** - catch specific error types when needed
3. **Use transactions** for operations that must be atomic
4. **Leverage filtering** capabilities instead of fetching all data
5. **Include relations** only when needed to avoid N+1 queries
6. **Test with mocked Prisma** client for unit tests