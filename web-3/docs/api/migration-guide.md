# Migration Guide: From Direct DB Access to Service Architecture

This guide helps you migrate existing code from the old pattern (direct database access in routers) to the new service-based architecture.

## Overview of Changes

### Old Architecture
```
Router → Direct Prisma Queries → Database
```

### New Architecture
```
Router → Service Layer → Repository Layer → Database
```

## Migration Steps

### Step 1: Identify Direct Database Access

Look for patterns like these in your routers:

```typescript
// OLD: Direct database access in router
export const apartmentRouter = createTRPCRouter({
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      // ❌ Direct database query
      const apartment = await ctx.db.apartment.findUnique({
        where: { id: input.id },
        include: {
          images: true,
          nearestStations: {
            include: { station: true }
          }
        }
      });
      
      // ❌ Business logic in router
      if (!apartment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Apartment not found'
        });
      }
      
      // ❌ Data transformation in router
      const twoYearAvg = (apartment.price * 24 + (apartment.deposit || 0)) / 24;
      
      return { ...apartment, twoYearAverage: twoYearAvg };
    })
});
```

### Step 2: Create a Service

Move the business logic to a service:

```typescript
// NEW: Service with business logic
export class ApartmentService {
  constructor(
    private db: PrismaClient,
    private session: Session
  ) {}
  
  async getById(id: string) {
    // ✅ Data access through service
    const apartment = await this.db.apartment.findUnique({
      where: { id },
      include: {
        images: true,
        nearestStations: {
          include: { station: true }
        }
      }
    });
    
    // ✅ Business logic in service
    if (!apartment) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Apartment not found'
      });
    }
    
    // ✅ Data transformation in service
    const twoYearAvg = this.calculateTwoYearAverage(apartment);
    
    return { ...apartment, twoYearAverage: twoYearAvg };
  }
  
  private calculateTwoYearAverage(apartment: any): number {
    return (apartment.price * 24 + (apartment.deposit || 0)) / 24;
  }
}
```

### Step 3: Update the Router

Simplify the router to just handle HTTP concerns:

```typescript
// NEW: Thin router delegating to service
export const apartmentRouter = createTRPCRouter({
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      // ✅ Instantiate service with dependencies
      const service = new ApartmentService(ctx.db, ctx.session);
      // ✅ Delegate to service
      return await service.getById(input.id);
    })
});
```

## Common Migration Patterns

### 1. List Operations

**OLD:**
```typescript
getUserLists: protectedProcedure
  .query(async ({ ctx }) => {
    const lists = await ctx.db.list.findMany({
      where: { userId: ctx.session.user.id },
      include: {
        _count: { select: { apartments: true } }
      }
    });
    
    // Complex aggregation in router
    const listsWithMeta = await Promise.all(
      lists.map(async (list) => {
        const seenCount = await ctx.db.apartmentList.count({
          where: { listId: list.id, seen: true }
        });
        
        return {
          ...list,
          totalApartments: list._count.apartments,
          seenCount,
          unseenCount: list._count.apartments - seenCount
        };
      })
    );
    
    return listsWithMeta;
  })
```

**NEW:**
```typescript
// Router
getUserLists: protectedProcedure
  .query(async ({ ctx }) => {
    const service = new ListService(ctx.db, ctx.session);
    return await service.getUserLists();
  })

// Service
async getUserLists(): Promise<ListWithMeta[]> {
  const lists = await this.db.list.findMany({
    where: { userId: this.session.user.id },
    include: {
      _count: { select: { apartments: true } }
    }
  });
  
  // Business logic encapsulated in service
  return await this.enrichListsWithMetadata(lists);
}

private async enrichListsWithMetadata(lists: any[]): Promise<ListWithMeta[]> {
  return await Promise.all(
    lists.map(async (list) => {
      const seenCount = await this.db.apartmentList.count({
        where: { listId: list.id, seen: true }
      });
      
      return {
        ...list,
        totalApartments: list._count.apartments,
        seenCount,
        unseenCount: list._count.apartments - seenCount
      };
    })
  );
}
```

### 2. Complex Queries

**OLD:**
```typescript
searchApartments: protectedProcedure
  .input(searchSchema)
  .query(async ({ ctx, input }) => {
    // Building complex where clause in router
    const where: any = { removed: false };
    
    if (input.priceMin) where.price = { gte: input.priceMin };
    if (input.priceMax) where.price = { ...where.price, lte: input.priceMax };
    
    if (input.stationIds) {
      where.nearestStations = {
        some: {
          stationId: { in: input.stationIds },
          walkingMinutes: { lte: input.maxWalking || 15 }
        }
      };
    }
    
    const apartments = await ctx.db.apartment.findMany({
      where,
      include: { /* ... */ },
      skip: (input.page - 1) * input.limit,
      take: input.limit
    });
    
    const total = await ctx.db.apartment.count({ where });
    
    return {
      apartments,
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        hasMore: /* ... */
      }
    };
  })
```

**NEW:**
```typescript
// Router
searchApartments: protectedProcedure
  .input(searchSchema)
  .query(async ({ ctx, input }) => {
    const service = new ApartmentSearchService(ctx.db, ctx.session);
    return await service.search(input);
  })

// Service
async search(input: SearchInput): Promise<PaginatedResult> {
  const where = this.buildSearchQuery(input);
  const pagination = this.buildPagination(input);
  
  const [apartments, total] = await Promise.all([
    this.db.apartment.findMany({
      where,
      ...pagination,
      include: this.getSearchIncludes()
    }),
    this.db.apartment.count({ where })
  ]);
  
  return this.formatSearchResults(apartments, total, input);
}

private buildSearchQuery(input: SearchInput): Prisma.ApartmentWhereInput {
  const where: Prisma.ApartmentWhereInput = { removed: false };
  
  if (input.priceMin || input.priceMax) {
    where.price = {};
    if (input.priceMin) where.price.gte = input.priceMin;
    if (input.priceMax) where.price.lte = input.priceMax;
  }
  
  if (input.stationIds?.length) {
    where.nearestStations = {
      some: {
        stationId: { in: input.stationIds },
        walkingMinutes: { lte: input.maxWalking || 15 }
      }
    };
  }
  
  return where;
}
```

### 3. Mutations with Business Logic

**OLD:**
```typescript
addToFavorites: protectedProcedure
  .input(z.object({ apartmentId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // Multiple checks in router
    const apartment = await ctx.db.apartment.findUnique({
      where: { id: input.apartmentId }
    });
    
    if (!apartment) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Apartment not found'
      });
    }
    
    const existing = await ctx.db.favorite.findUnique({
      where: {
        userId_apartmentId: {
          userId: ctx.session.user.id,
          apartmentId: input.apartmentId
        }
      }
    });
    
    if (existing) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Already favorited'
      });
    }
    
    const favorite = await ctx.db.favorite.create({
      data: {
        userId: ctx.session.user.id,
        apartmentId: input.apartmentId
      }
    });
    
    // Side effects in router
    await ctx.db.user.update({
      where: { id: ctx.session.user.id },
      data: { favoriteCount: { increment: 1 } }
    });
    
    return favorite;
  })
```

**NEW:**
```typescript
// Router
addToFavorites: protectedProcedure
  .input(z.object({ apartmentId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const service = new FavoriteService(ctx.db, ctx.session);
    return await service.addFavorite(input.apartmentId);
  })

// Service
async addFavorite(apartmentId: string): Promise<Favorite> {
  // Validate apartment exists
  await this.validateApartmentExists(apartmentId);
  
  // Check not already favorited
  await this.ensureNotAlreadyFavorited(apartmentId);
  
  // Create favorite with side effects in transaction
  return await this.db.$transaction(async (tx) => {
    const favorite = await tx.favorite.create({
      data: {
        userId: this.session.user.id,
        apartmentId
      }
    });
    
    // Handle side effects in service
    await this.incrementUserFavoriteCount(tx);
    
    return favorite;
  });
}

private async validateApartmentExists(id: string): Promise<void> {
  const exists = await this.db.apartment.findUnique({
    where: { id },
    select: { id: true }
  });
  
  if (!exists) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Apartment not found'
    });
  }
}
```

## Migration Checklist

For each router file:

- [ ] Identify all procedures with direct database access
- [ ] Group related operations into logical services
- [ ] Create service classes with appropriate methods
- [ ] Move business logic from routers to services
- [ ] Move complex queries to service methods
- [ ] Extract reusable logic into private service methods
- [ ] Update routers to use services
- [ ] Add proper TypeScript types for inputs/outputs
- [ ] Add JSDoc documentation to service methods
- [ ] Write tests for the new services
- [ ] Remove old code and imports

## Best Practices During Migration

### 1. Service Granularity

Create services based on business domains, not database tables:

```typescript
// ❌ Too granular (one service per table)
class ApartmentTableService { }
class ApartmentImageTableService { }
class ApartmentStationTableService { }

// ✅ Domain-focused services
class ApartmentService { }      // All apartment operations
class ListService { }           // All list operations
class SearchService { }         // Complex search operations
```

### 2. Dependency Management

Keep services loosely coupled:

```typescript
// ❌ Services creating other services
class ListService {
  private apartmentService = new ApartmentService(this.db, this.session);
}

// ✅ Inject dependencies when needed
class ListService {
  constructor(
    private db: PrismaClient,
    private session: Session,
    private apartmentService?: ApartmentService
  ) {}
}
```

### 3. Error Handling

Maintain consistent error handling:

```typescript
// Service method
async getApartment(id: string): Promise<Apartment> {
  const apartment = await this.db.apartment.findUnique({
    where: { id }
  });
  
  if (!apartment) {
    // Use same error structure as before
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Apartment not found'
    });
  }
  
  // Check permissions
  if (!this.canUserViewApartment(apartment)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to view this apartment'
    });
  }
  
  return apartment;
}
```

### 4. Testing Strategy

Test services independently:

```typescript
describe('ApartmentService', () => {
  let service: ApartmentService;
  let mockDb: MockPrismaClient;
  
  beforeEach(() => {
    mockDb = createMockPrismaClient();
    service = new ApartmentService(mockDb, mockSession);
  });
  
  it('should throw NOT_FOUND for missing apartment', async () => {
    mockDb.apartment.findUnique.mockResolvedValue(null);
    
    await expect(service.getById('123'))
      .rejects
      .toThrow('Apartment not found');
  });
});
```

## Common Pitfalls to Avoid

1. **Don't just move code** - Refactor and improve while migrating
2. **Don't create anemic services** - Services should contain business logic
3. **Don't skip tests** - Write tests for the new services
4. **Don't mix concerns** - Keep HTTP/tRPC logic in routers only
5. **Don't forget transactions** - Use them for multi-step operations

## Benefits After Migration

1. **Testability**: Services can be unit tested without tRPC context
2. **Reusability**: Business logic can be shared between endpoints
3. **Maintainability**: Clear separation of concerns
4. **Type Safety**: Better TypeScript inference with focused methods
5. **Performance**: Easier to optimize and cache at service level

## Need Help?

- Check existing migrated services for examples
- Review the architecture documentation
- Look at service tests for patterns
- Keep the old code as reference until migration is complete

Remember: The goal is not just to move code, but to improve the architecture and make the codebase more maintainable.