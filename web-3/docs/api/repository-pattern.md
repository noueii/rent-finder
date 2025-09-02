# Repository Pattern Documentation

## Overview

The repository pattern provides an abstraction layer between your business logic and data access logic. This document explains how to use and extend the repository pattern in the Tokyo Apartment Finder application.

## Repository Structure

```
src/server/repositories/
├── interfaces/                 # Repository contracts
│   ├── apartment.repository.interface.ts
│   ├── list.repository.interface.ts
│   ├── station.repository.interface.ts
│   ├── user.repository.interface.ts
│   └── index.ts
├── implementations/            # Concrete implementations
│   ├── apartment.repository.ts
│   ├── list.repository.ts
│   ├── station.repository.ts
│   ├── user.repository.ts
│   └── index.ts
├── base.repository.ts          # Base repository class
├── repository.factory.ts       # Factory for dependency injection
└── index.ts                    # Main exports
```

## Base Repository

All repositories extend the `PrismaBaseRepository` class which provides common CRUD operations:

```typescript
export class PrismaBaseRepository<
  Model,
  CreateInput,
  UpdateInput,
  WhereInput = any,
  OrderByInput = any
> implements BaseRepository<Model> {
  constructor(
    protected prisma: PrismaClient,
    protected modelName: Prisma.ModelName
  ) {}

  // Common methods available to all repositories:
  async findById(id: string): Promise<Model | null>
  async findMany(args?: FindManyArgs): Promise<Model[]>
  async create(data: CreateInput): Promise<Model>
  async update(id: string, data: UpdateInput): Promise<Model>
  async delete(id: string): Promise<Model>
  async count(where?: WhereInput): Promise<number>
  async exists(where: WhereInput): Promise<boolean>
  async transaction<R>(fn: (tx: PrismaClient) => Promise<R>): Promise<R>
}
```

## Creating a Repository

### 1. Define the Interface

First, create an interface that defines the contract for your repository:

```typescript
// interfaces/apartment.repository.interface.ts
export interface IApartmentRepository extends BaseRepository<ApartmentWithRelations> {
  // Custom methods specific to apartments
  findByExternalId(externalId: string, sourceSite: string): Promise<ApartmentWithRelations | null>;
  findByStation(stationId: string, maxWalkingMinutes?: number): Promise<ApartmentWithRelations[]>;
  findByStations(stationIds: string[], maxWalkingMinutes?: number): Promise<ApartmentWithRelations[]>;
  search(
    filters: ApartmentSearchFilters,
    pagination: PaginationOptions,
    sort?: ApartmentSortOptions
  ): Promise<PaginatedApartments>;
  markAsRemoved(id: string): Promise<ApartmentWithRelations>;
  updateRoutes(apartmentId: string, routes: any[]): Promise<void>;
}
```

### 2. Implement the Repository

Create the concrete implementation:

```typescript
// implementations/apartment.repository.ts
export class ApartmentRepository
  extends PrismaBaseRepository<
    ApartmentWithRelations,
    Prisma.ApartmentCreateInput,
    Prisma.ApartmentUpdateInput,
    Prisma.ApartmentWhereInput,
    Prisma.ApartmentOrderByWithRelationInput
  >
  implements IApartmentRepository {
  
  constructor(prisma: PrismaClient) {
    super(prisma, 'apartment');
  }

  async findByStation(stationId: string, maxWalkingMinutes = 15): Promise<ApartmentWithRelations[]> {
    return await this.model.findMany({
      where: {
        nearestStations: {
          some: {
            stationId,
            walkingMinutes: { lte: maxWalkingMinutes }
          }
        },
        removed: false
      },
      include: {
        images: { orderBy: { order: 'asc' } },
        nearestStations: { /* ... */ },
        routes: { /* ... */ }
      }
    });
  }
  
  // ... other custom methods
}
```

## Using Repositories in Services

### Direct Usage

```typescript
export class ApartmentService {
  private apartmentRepo: IApartmentRepository;
  
  constructor(prisma: PrismaClient) {
    this.apartmentRepo = new ApartmentRepository(prisma);
  }
  
  async findApartmentsNearStation(stationId: string) {
    return await this.apartmentRepo.findByStation(stationId, 10);
  }
}
```

### With Dependency Injection

```typescript
export class ApartmentService {
  constructor(
    private apartmentRepo: IApartmentRepository,
    private session: Session
  ) {}
  
  async findApartmentsNearStation(stationId: string) {
    // Service can focus on business logic
    const apartments = await this.apartmentRepo.findByStation(stationId);
    
    // Apply business rules
    return apartments.filter(apt => this.canUserViewApartment(apt));
  }
}

// In router:
const apartmentRepo = new ApartmentRepository(ctx.db);
const service = new ApartmentService(apartmentRepo, ctx.session);
```

## Common Repository Patterns

### 1. Search with Filters

Build complex where clauses in a maintainable way:

```typescript
private buildWhereClause(filters: ApartmentSearchFilters): Prisma.ApartmentWhereInput {
  const where: Prisma.ApartmentWhereInput = {
    removed: false
  };

  // Price range
  if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
    where.price = {};
    if (filters.priceMin) where.price.gte = filters.priceMin;
    if (filters.priceMax) where.price.lte = filters.priceMax;
  }

  // Station proximity
  if (filters.stationIds?.length > 0) {
    where.nearestStations = {
      some: {
        stationId: { in: filters.stationIds },
        walkingMinutes: filters.maxWalkingMinutes 
          ? { lte: filters.maxWalkingMinutes } 
          : undefined
      }
    };
  }

  return where;
}
```

### 2. Pagination

Implement consistent pagination:

```typescript
async search(
  filters: ApartmentSearchFilters,
  pagination: PaginationOptions
): Promise<PaginatedApartments> {
  const where = this.buildWhereClause(filters);
  const page = pagination.page || 1;
  const limit = Math.min(pagination.limit || 20, 100);
  const skip = (page - 1) * limit;

  const [apartments, total] = await Promise.all([
    this.model.findMany({
      where,
      skip,
      take: limit,
      include: { /* relations */ }
    }),
    this.model.count({ where })
  ]);

  return {
    apartments,
    total,
    page,
    limit,
    hasMore: skip + apartments.length < total,
    nextCursor: apartments[apartments.length - 1]?.id
  };
}
```

### 3. Optimized Relations

Include only necessary relations:

```typescript
async findById(id: string, includeRelations = true): Promise<ApartmentWithRelations | null> {
  const include = includeRelations ? {
    images: {
      orderBy: { order: 'asc' }
    },
    nearestStations: {
      include: {
        station: {
          include: {
            lines: {
              include: { line: true }
            }
          }
        }
      },
      orderBy: { walkingMinutes: 'asc' }
    },
    routes: {
      include: { toStation: true }
    }
  } : undefined;

  return await this.model.findUnique({
    where: { id },
    include
  });
}
```

### 4. Bulk Operations

Efficient bulk operations:

```typescript
async createMany(apartments: Prisma.ApartmentCreateManyInput[]): Promise<{ count: number }> {
  return await this.model.createMany({
    data: apartments,
    skipDuplicates: true
  });
}

async updateMany(
  where: Prisma.ApartmentWhereInput,
  data: Prisma.ApartmentUpdateInput
): Promise<{ count: number }> {
  return await this.model.updateMany({
    where,
    data
  });
}
```

### 5. Transactions

Handle complex operations atomically:

```typescript
async updateRoutes(apartmentId: string, routes: RouteInput[]): Promise<void> {
  await this.transaction(async (tx) => {
    // Delete existing routes
    await tx.route.deleteMany({
      where: { apartmentId }
    });

    // Create new routes
    if (routes.length > 0) {
      await tx.route.createMany({
        data: routes.map(route => ({
          apartmentId,
          toStationId: route.toStationId,
          commuteMinutes: route.commuteMinutes,
          transferCount: route.transferCount
        }))
      });
    }

    // Update apartment metadata
    await tx.apartment.update({
      where: { id: apartmentId },
      data: { routesUpdatedAt: new Date() }
    });
  });
}
```

## Error Handling

All repositories should handle errors consistently:

```typescript
import { handlePrismaError } from '@/lib/error-handler';

async findById(id: string): Promise<Model | null> {
  try {
    return await this.model.findUnique({
      where: { id }
    });
  } catch (error) {
    throw handlePrismaError(error);
  }
}
```

The error handler transforms Prisma errors into appropriate TRPC errors:

```typescript
export function handlePrismaError(error: unknown): TRPCError {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return new TRPCError({
          code: 'CONFLICT',
          message: 'Unique constraint violation'
        });
      case 'P2025':
        return new TRPCError({
          code: 'NOT_FOUND',
          message: 'Record not found'
        });
      // ... other cases
    }
  }
  
  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Database operation failed'
  });
}
```

## Testing Repositories

### Unit Testing with Mocks

```typescript
describe('ApartmentRepository', () => {
  let repository: ApartmentRepository;
  let mockPrisma: DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    mockPrisma = mockDeep<PrismaClient>();
    repository = new ApartmentRepository(mockPrisma);
  });

  describe('findByStation', () => {
    it('should find apartments near a station', async () => {
      const mockApartments = [
        { id: '1', name: 'Apartment 1' },
        { id: '2', name: 'Apartment 2' }
      ];

      mockPrisma.apartment.findMany.mockResolvedValue(mockApartments);

      const result = await repository.findByStation('station1', 10);

      expect(mockPrisma.apartment.findMany).toHaveBeenCalledWith({
        where: {
          nearestStations: {
            some: {
              stationId: 'station1',
              walkingMinutes: { lte: 10 }
            }
          },
          removed: false
        },
        include: expect.any(Object)
      });

      expect(result).toEqual(mockApartments);
    });
  });
});
```

### Integration Testing

```typescript
describe('ApartmentRepository Integration', () => {
  let repository: ApartmentRepository;
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    repository = new ApartmentRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean database
    await prisma.apartment.deleteMany();
  });

  it('should create and retrieve apartment', async () => {
    const apartment = await repository.create({
      externalId: 'test-123',
      sourceSite: 'test',
      url: 'https://example.com',
      name: 'Test Apartment',
      price: 100000,
      size: 50
    });

    const retrieved = await repository.findById(apartment.id);
    
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('Test Apartment');
  });
});
```

## Best Practices

### 1. Keep Repositories Focused

Each repository should handle one aggregate root:
- `ApartmentRepository` - Apartments and related entities
- `ListRepository` - Lists and list items
- `UserRepository` - Users and preferences

### 2. Use Interfaces

Always depend on interfaces, not concrete implementations:

```typescript
// Good
constructor(private apartmentRepo: IApartmentRepository) {}

// Bad
constructor(private apartmentRepo: ApartmentRepository) {}
```

### 3. Optimize Queries

- Include only necessary relations
- Use pagination for large result sets
- Consider using `select` for specific fields
- Use database indexes effectively

### 4. Handle Null Cases

Always handle potential null returns:

```typescript
const apartment = await this.apartmentRepo.findById(id);
if (!apartment) {
  throw new TRPCError({
    code: 'NOT_FOUND',
    message: 'Apartment not found'
  });
}
```

### 5. Document Complex Queries

Add comments explaining complex where clauses or joins:

```typescript
async findApartmentsWithoutRoutes(limit = 100): Promise<Apartment[]> {
  return await this.model.findMany({
    where: {
      // Find apartments that have stations but no calculated routes
      routes: { none: {} },
      nearestStations: { some: {} },
      removed: false
    },
    take: limit,
    orderBy: { createdAt: 'desc' }
  });
}
```

## Extending the Pattern

### Adding a New Repository

1. Create interface in `/interfaces/`:
```typescript
export interface INewEntityRepository extends BaseRepository<NewEntity> {
  customMethod(): Promise<NewEntity[]>;
}
```

2. Create implementation in `/implementations/`:
```typescript
export class NewEntityRepository 
  extends PrismaBaseRepository<...>
  implements INewEntityRepository {
  // Implementation
}
```

3. Export from index files:
```typescript
// interfaces/index.ts
export * from './new-entity.repository.interface';

// implementations/index.ts
export * from './new-entity.repository';
```

4. Use in services as needed

### Custom Base Repositories

For domain-specific base functionality:

```typescript
export abstract class TimestampedRepository<T> extends PrismaBaseRepository<T> {
  async findRecent(days = 7): Promise<T[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    
    return await this.findMany({
      where: {
        createdAt: { gte: since }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}
```

## Conclusion

The repository pattern provides:
- **Testability** - Easy to mock for unit tests
- **Flexibility** - Switch data sources if needed
- **Consistency** - Standardized data access
- **Separation** - Business logic stays in services
- **Type Safety** - Full TypeScript support

Follow these patterns to maintain a clean, scalable data access layer.