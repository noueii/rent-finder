# API Architecture Documentation

## Overview

The Tokyo Apartment Finder API is built using a layered architecture that separates concerns and promotes maintainability. This document outlines the key architectural patterns and how to work with them.

## Architecture Layers

```
┌─────────────────────────────────────────┐
│           tRPC Routers                  │  ← API endpoints
├─────────────────────────────────────────┤
│          Service Layer                  │  ← Business logic
├─────────────────────────────────────────┤
│        Repository Layer                 │  ← Data access
├─────────────────────────────────────────┤
│           Prisma ORM                    │  ← Database abstraction
├─────────────────────────────────────────┤
│         PostgreSQL DB                   │  ← Data storage
└─────────────────────────────────────────┘
```

### 1. Router Layer (`/src/server/api/routers/`)

Routers define the API endpoints and handle:
- Input validation using Zod schemas
- Authentication/authorization checks
- Delegating business logic to services
- Returning responses to clients

**Example Router Pattern:**
```typescript
export const listRouter = createTRPCRouter({
  getById: protectedProcedure
    .input(z.object({
      id: z.string().cuid(),
    }))
    .query(async ({ ctx, input }) => {
      const listService = new ListService(ctx.db, ctx.session);
      return await listService.getById(input.id);
    }),
});
```

### 2. Service Layer (`/src/server/services/`)

Services contain all business logic and orchestration:
- Complex business rules
- Data transformations
- Cross-domain operations
- Transaction coordination

**Key Services:**
- `ListService` - List management operations
- `ListQueryService` - Complex list queries
- `ListRefreshService` - Background list updates
- `ApartmentScoreService` - Scoring calculations

**Example Service Pattern:**
```typescript
export class ListService {
  constructor(
    private db: PrismaClient,
    private session: Session
  ) {}

  async getById(id: string) {
    // 1. Verify access permissions
    const list = await this.verifyListAccess(id);
    
    // 2. Fetch data with relations
    const fullList = await this.db.list.findUnique({
      where: { id },
      include: { /* relations */ },
    });
    
    // 3. Apply business logic
    // 4. Return transformed data
    return fullList;
  }
}
```

### 3. Repository Layer (`/src/server/repositories/`)

Repositories provide a clean abstraction over data access:
- Encapsulate database queries
- Handle error transformation
- Provide type-safe interfaces
- Enable easy testing with mocks

**Repository Structure:**
```
repositories/
├── interfaces/              # Repository contracts
│   ├── apartment.repository.interface.ts
│   ├── list.repository.interface.ts
│   └── station.repository.interface.ts
├── implementations/         # Concrete implementations
│   ├── apartment.repository.ts
│   ├── list.repository.ts
│   └── station.repository.ts
├── base.repository.ts       # Base repository class
└── repository.factory.ts    # Factory for DI
```

**Example Repository Pattern:**
```typescript
export class ApartmentRepository 
  extends PrismaBaseRepository<...>
  implements IApartmentRepository {
  
  async findByStation(
    stationId: string, 
    maxWalkingMinutes = 15
  ): Promise<ApartmentWithRelations[]> {
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
      include: { /* relations */ }
    });
  }
}
```

## Key Design Patterns

### 1. Dependency Injection

Services and repositories use constructor injection for dependencies:

```typescript
// Service receives dependencies via constructor
class ListService {
  constructor(
    private db: PrismaClient,
    private session: Session
  ) {}
}

// Router instantiates service with context
const listService = new ListService(ctx.db, ctx.session);
```

### 2. Interface Segregation

Repositories define clear interfaces that services depend on:

```typescript
export interface IApartmentRepository {
  findById(id: string): Promise<Apartment | null>;
  findByStation(stationId: string): Promise<Apartment[]>;
  search(filters: ApartmentSearchFilters): Promise<PaginatedApartments>;
  // ... other methods
}
```

### 3. Single Responsibility

Each layer has a clear responsibility:
- **Routers**: HTTP concerns, validation
- **Services**: Business logic, orchestration
- **Repositories**: Data access only

### 4. Error Handling

Consistent error handling across layers:

```typescript
// Repository level - transforms database errors
try {
  return await this.model.findUnique({ where: { id } });
} catch (error) {
  throw handlePrismaError(error);
}

// Service level - business rule violations
if (!list) {
  throw new TRPCError({
    code: 'NOT_FOUND',
    message: 'List not found',
  });
}
```

## Common Patterns

### 1. Access Control Pattern

Services implement consistent access control:

```typescript
private async verifyListAccess(listId: string) {
  const list = await this.db.list.findFirst({
    where: {
      id: listId,
      OR: [
        { userId: this.session.user.id },
        { isPublic: true },
      ],
    },
  });

  if (!list) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'List not found',
    });
  }

  return list;
}
```

### 2. Pagination Pattern

Consistent pagination across endpoints:

```typescript
const page = pagination.page || 1;
const limit = Math.min(pagination.limit || 20, 100);
const skip = (page - 1) * limit;

const [items, total] = await Promise.all([
  this.model.findMany({ skip, take: limit }),
  this.model.count({ where })
]);

return {
  items,
  total,
  page,
  limit,
  hasMore: skip + items.length < total
};
```

### 3. Transaction Pattern

Complex operations use transactions:

```typescript
async updateRoutes(apartmentId: string, routes: any[]) {
  await this.prisma.$transaction(async (tx) => {
    // Delete existing
    await tx.route.deleteMany({
      where: { apartmentId }
    });
    
    // Create new
    await tx.route.createMany({
      data: routes
    });
  });
}
```

## Adding New Features

### 1. Adding a New Endpoint

1. **Define Zod schema** in router file:
```typescript
const myInputSchema = z.object({
  field: z.string(),
  // ... other fields
});
```

2. **Add router method**:
```typescript
myEndpoint: protectedProcedure
  .input(myInputSchema)
  .mutation(async ({ ctx, input }) => {
    const service = new MyService(ctx.db, ctx.session);
    return await service.performAction(input);
  }),
```

3. **Implement service method**:
```typescript
async performAction(input: MyInput) {
  // Business logic here
}
```

### 2. Adding a New Service

1. **Create service file** in `/src/server/services/`:
```typescript
export class MyService {
  constructor(
    private db: PrismaClient,
    private session: Session
  ) {}
  
  // Service methods
}
```

2. **Export from index**:
```typescript
export { MyService } from './my.service';
```

3. **Use in routers** as needed

### 3. Extending Repositories

1. **Add to interface**:
```typescript
export interface IMyRepository extends BaseRepository<MyModel> {
  customMethod(): Promise<MyModel[]>;
}
```

2. **Implement in concrete class**:
```typescript
export class MyRepository 
  extends PrismaBaseRepository<...>
  implements IMyRepository {
  
  async customMethod() {
    // Implementation
  }
}
```

## Best Practices

### 1. Service Layer Guidelines

- **Keep services focused** - One service per domain concept
- **Inject dependencies** - Don't instantiate them internally
- **Return DTOs** - Transform entities to transfer objects
- **Handle transactions** - Coordinate multi-step operations
- **Validate business rules** - Not just input validation

### 2. Repository Guidelines

- **Pure data access** - No business logic
- **Use base repository** - Inherit common operations
- **Type-safe queries** - Leverage Prisma's type system
- **Handle errors consistently** - Use error transformer
- **Optimize queries** - Include only needed relations

### 3. Router Guidelines

- **Thin controllers** - Delegate to services
- **Validate inputs** - Use Zod schemas
- **Handle authentication** - Use procedure types
- **Document endpoints** - Add JSDoc comments
- **Consistent naming** - Follow REST-like conventions

## Testing Strategy

### 1. Unit Tests

Test services and repositories in isolation:

```typescript
describe('ListService', () => {
  let service: ListService;
  let mockDb: MockPrismaClient;
  
  beforeEach(() => {
    mockDb = createMockPrismaClient();
    service = new ListService(mockDb, mockSession);
  });
  
  it('should verify list access', async () => {
    // Test implementation
  });
});
```

### 2. Integration Tests

Test full API flow:

```typescript
describe('List API', () => {
  it('should create and retrieve list', async () => {
    const caller = createCaller({ session: mockSession });
    
    const list = await caller.list.create({
      name: 'Test List',
      type: 'CUSTOM'
    });
    
    expect(list).toBeDefined();
  });
});
```

## Migration Guide

### From Old Pattern to New

**Old Pattern (direct DB access in routers):**
```typescript
getList: protectedProcedure
  .query(async ({ ctx, input }) => {
    const list = await ctx.db.list.findUnique({
      where: { id: input.id }
    });
    // Complex logic mixed with data access
    return list;
  })
```

**New Pattern (service layer):**
```typescript
getList: protectedProcedure
  .query(async ({ ctx, input }) => {
    const service = new ListService(ctx.db, ctx.session);
    return await service.getById(input.id);
  })
```

### Benefits of New Architecture

1. **Testability** - Services can be unit tested
2. **Reusability** - Business logic can be shared
3. **Maintainability** - Clear separation of concerns
4. **Scalability** - Easy to add new features
5. **Type Safety** - Full TypeScript support

## Common Pitfalls to Avoid

1. **Don't put business logic in routers** - Use services
2. **Don't access DB directly from routers** - Use repositories
3. **Don't create circular dependencies** - Keep layers separate
4. **Don't skip error handling** - Handle at appropriate layer
5. **Don't forget transactions** - Use for multi-step operations

## Resources

- [tRPC Documentation](https://trpc.io/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)