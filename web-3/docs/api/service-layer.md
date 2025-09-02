# Service Layer Guide

## Overview

The service layer contains all business logic and orchestrates operations between the API layer (routers) and the data layer (repositories). This guide explains how to create and use services effectively.

## Service Architecture

```
API Layer (Routers)
    ↓ uses
Service Layer ← [Business Logic & Orchestration]
    ↓ uses
Repository Layer
    ↓ uses
Database (Prisma)
```

## Core Service Patterns

### Basic Service Structure

```typescript
export class ListService {
  constructor(
    private db: PrismaClient,
    private session: Session
  ) {}

  // Service methods implement business logic
  async getById(id: string) {
    // 1. Authorization check
    const list = await this.verifyListAccess(id);
    
    // 2. Data retrieval
    const fullList = await this.db.list.findUnique({
      where: { id },
      include: { _count: { select: { apartments: true } } }
    });
    
    // 3. Business logic & enrichment
    const metadata = await this.calculateListMetadata(fullList);
    
    // 4. Return transformed result
    return { ...fullList, ...metadata };
  }
}
```

## Service Types

### 1. Domain Services

Handle operations for a specific domain entity:

```typescript
// list.service.ts - Manages list operations
export class ListService {
  async create(input: CreateListInput) { }
  async update(input: UpdateListInput) { }
  async delete(id: string) { }
  async addApartment(listId: string, apartmentId: string) { }
}

// apartment.service.ts - Manages apartment operations  
export class ApartmentService {
  async create(input: CreateApartmentInput) { }
  async updateDetails(id: string, details: ApartmentDetails) { }
  async calculateScore(id: string) { }
}
```

### 2. Query Services

Handle complex read operations and aggregations:

```typescript
// list-query.service.ts
export class ListQueryService {
  async getApartments(
    listId: string,
    pagination?: PaginationOptions,
    filters?: ApartmentFilters,
    sort?: SortOptions
  ): Promise<PaginatedResult<ApartmentWithMeta>> {
    // Complex query logic with filtering, sorting, pagination
  }

  async getApartmentStats(listId: string): Promise<ListStats> {
    // Aggregation queries
  }
}
```

### 3. Process Services

Orchestrate multi-step business processes:

```typescript
// list-refresh.service.ts
export class ListRefreshService {
  async refreshListings(listId: string): Promise<RefreshResult> {
    // 1. Get list configuration
    const list = await this.getList(listId);
    
    // 2. Determine what needs refreshing
    const staleApartments = await this.findStaleApartments(list);
    
    // 3. Scrape updated data
    const updates = await this.scrapeApartments(staleApartments);
    
    // 4. Update database
    await this.applyUpdates(updates);
    
    // 5. Calculate new routes if needed
    await this.updateRoutes(list, updates);
    
    return { updated: updates.length, status: 'completed' };
  }
}
```

### 4. Integration Services

Handle external system interactions:

```typescript
// apartment-score.service.ts
export class ApartmentScoreService {
  async calculateScores(
    apartmentId: string,
    userId: string
  ): Promise<ApartmentScores> {
    // Integrate multiple data sources
    const apartment = await this.getApartmentDetails(apartmentId);
    const userPreferences = await this.getUserPreferences(userId);
    const marketData = await this.getMarketData(apartment.ward);
    
    // Apply scoring algorithm
    return this.scoreAlgorithm(apartment, userPreferences, marketData);
  }
}
```

## Common Service Patterns

### 1. Authorization Pattern

Consistent access control across services:

```typescript
export class ListService {
  /**
   * Verify user has access to a list (owner or public)
   */
  private async verifyListAccess(listId: string): Promise<List> {
    const list = await this.db.list.findFirst({
      where: {
        id: listId,
        OR: [
          { userId: this.session.user.id },
          { isPublic: true }
        ]
      }
    });

    if (!list) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'List not found'
      });
    }

    return list;
  }

  /**
   * Verify user owns a list
   */
  private async verifyListOwnership(listId: string): Promise<void> {
    const list = await this.db.list.findFirst({
      where: {
        id: listId,
        userId: this.session.user.id
      }
    });

    if (!list) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to modify this list'
      });
    }
  }
}
```

### 2. Data Transformation Pattern

Transform database entities to DTOs:

```typescript
export class ListService {
  /**
   * Transform list entity to response DTO
   */
  private transformToListDTO(
    list: ListWithRelations,
    metadata: ListMetadata
  ): ListResponseDTO {
    return {
      id: list.id,
      name: list.name,
      type: list.type,
      totalApartments: list._count.apartments,
      seenCount: metadata.seenCount,
      unseenCount: metadata.unseenCount,
      apartmentsWithoutRoutes: metadata.apartmentsWithoutRoutes,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt
    };
  }

  /**
   * Calculate 2-year average monthly cost
   */
  private calculateTwoYearAverage(apartment: Apartment): number {
    const twoYearTotal = 
      apartment.price * 24 + 
      (apartment.deposit || apartment.price * 2) + 
      (apartment.keyMoney || 0) + 
      (apartment.reikin || 0);
    
    return Math.round(twoYearTotal / 24);
  }
}
```

### 3. Bulk Operation Pattern

Efficient handling of multiple items:

```typescript
export class ListService {
  /**
   * Bulk add apartments to list
   */
  async bulkAddApartments(
    listId: string, 
    apartmentIds: string[]
  ): Promise<BulkOperationResult> {
    // Verify ownership once
    await this.verifyListOwnership(listId);

    // Validate all apartments exist
    const existingApartments = await this.db.apartment.findMany({
      where: { id: { in: apartmentIds } },
      select: { id: true }
    });

    const existingIds = new Set(existingApartments.map(a => a.id));
    const invalidIds = apartmentIds.filter(id => !existingIds.has(id));

    if (invalidIds.length > 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Invalid apartment IDs: ${invalidIds.join(', ')}`
      });
    }

    // Bulk insert with duplicate handling
    const result = await this.db.apartmentList.createMany({
      data: apartmentIds.map(apartmentId => ({
        apartmentId,
        listId
      })),
      skipDuplicates: true
    });

    return {
      requested: apartmentIds.length,
      added: result.count,
      skipped: apartmentIds.length - result.count
    };
  }
}
```

### 4. Transaction Pattern

Ensure data consistency:

```typescript
export class ApartmentService {
  /**
   * Update apartment with all related data
   */
  async updateApartmentComplete(
    id: string,
    updates: ApartmentUpdateInput
  ): Promise<Apartment> {
    return await this.db.$transaction(async (tx) => {
      // Update main apartment record
      const apartment = await tx.apartment.update({
        where: { id },
        data: {
          name: updates.name,
          price: updates.price,
          size: updates.size,
          // ... other fields
        }
      });

      // Update images if provided
      if (updates.images) {
        await tx.apartmentImage.deleteMany({
          where: { apartmentId: id }
        });

        await tx.apartmentImage.createMany({
          data: updates.images.map((img, idx) => ({
            apartmentId: id,
            url: img.url,
            order: idx
          }))
        });
      }

      // Update nearest stations if provided
      if (updates.nearestStations) {
        await tx.apartmentStation.deleteMany({
          where: { apartmentId: id }
        });

        await tx.apartmentStation.createMany({
          data: updates.nearestStations
        });
      }

      return apartment;
    });
  }
}
```

### 5. Caching Pattern

Optimize repeated operations:

```typescript
export class StationService {
  private stationCache = new Map<string, Station>();

  async getStation(id: string): Promise<Station> {
    // Check cache first
    if (this.stationCache.has(id)) {
      return this.stationCache.get(id)!;
    }

    // Load from database
    const station = await this.db.station.findUnique({
      where: { id }
    });

    if (!station) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Station not found'
      });
    }

    // Cache for future use
    this.stationCache.set(id, station);
    return station;
  }

  clearCache() {
    this.stationCache.clear();
  }
}
```

## Service Guidelines

### 1. Single Responsibility

Each service should have one clear purpose:

```typescript
// Good: Focused services
export class ListService { }          // List CRUD operations
export class ListQueryService { }     // Complex list queries
export class ListRefreshService { }   // List refresh process

// Bad: God service doing everything
export class ApartmentService {
  async create() { }
  async search() { }
  async score() { }
  async scrape() { }
  async calculateRoutes() { }
  // Too many responsibilities!
}
```

### 2. Dependency Injection

Services should receive dependencies via constructor:

```typescript
// Good: Dependencies injected
export class ListService {
  constructor(
    private db: PrismaClient,
    private session: Session,
    private scoreService: ApartmentScoreService
  ) {}
}

// Bad: Creating dependencies internally
export class ListService {
  private db = new PrismaClient();  // Don't do this!
  private scoreService = new ApartmentScoreService();
}
```

### 3. Error Handling

Use appropriate error codes and messages:

```typescript
export class ListService {
  async addApartment(listId: string, apartmentId: string) {
    // Check list exists and user owns it
    const list = await this.db.list.findFirst({
      where: { id: listId, userId: this.session.user.id }
    });

    if (!list) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'List not found or you do not have permission'
      });
    }

    // Check apartment exists
    const apartment = await this.db.apartment.findUnique({
      where: { id: apartmentId }
    });

    if (!apartment) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Apartment not found'
      });
    }

    // Check not already in list
    const existing = await this.db.apartmentList.findUnique({
      where: {
        apartmentId_listId: { apartmentId, listId }
      }
    });

    if (existing) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Apartment already in list'
      });
    }

    // Add to list
    return await this.db.apartmentList.create({
      data: { apartmentId, listId }
    });
  }
}
```

### 4. Method Documentation

Use JSDoc comments for complex methods:

```typescript
export class ListQueryService {
  /**
   * Get paginated apartments from a list with filters and sorting
   * 
   * @param listId - The list to query
   * @param pagination - Page number and limit
   * @param filters - Optional filters (price, size, etc.)
   * @param sort - Sort field and order
   * @param excludeListTypes - Exclude apartments in these list types
   * @returns Paginated apartment results with metadata
   * 
   * @example
   * const apartments = await service.getApartments(
   *   'list123',
   *   { page: 1, limit: 20 },
   *   { priceMax: 100000, sizeMin: 40 },
   *   { field: 'price', order: 'asc' }
   * );
   */
  async getApartments(
    listId: string,
    pagination?: PaginationOptions,
    filters?: ApartmentFilters,
    sort?: SortOptions,
    excludeListTypes?: ListType[]
  ): Promise<PaginatedApartments> {
    // Implementation
  }
}
```

### 5. Testing Services

Write comprehensive tests:

```typescript
describe('ListService', () => {
  let service: ListService;
  let mockDb: MockPrismaClient;
  let mockSession: Session;

  beforeEach(() => {
    mockDb = createMockPrismaClient();
    mockSession = createMockSession({ userId: 'user123' });
    service = new ListService(mockDb, mockSession);
  });

  describe('addApartment', () => {
    it('should add apartment to list', async () => {
      // Arrange
      mockDb.list.findFirst.mockResolvedValue({
        id: 'list123',
        userId: 'user123'
      });
      
      mockDb.apartment.findUnique.mockResolvedValue({
        id: 'apt123'
      });
      
      mockDb.apartmentList.findUnique.mockResolvedValue(null);
      
      mockDb.apartmentList.create.mockResolvedValue({
        apartmentId: 'apt123',
        listId: 'list123'
      });

      // Act
      const result = await service.addApartment('list123', 'apt123');

      // Assert
      expect(result).toEqual({
        apartmentId: 'apt123',
        listId: 'list123'
      });
      
      expect(mockDb.apartmentList.create).toHaveBeenCalledWith({
        data: {
          apartmentId: 'apt123',
          listId: 'list123'
        }
      });
    });

    it('should throw if list not found', async () => {
      mockDb.list.findFirst.mockResolvedValue(null);

      await expect(
        service.addApartment('list123', 'apt123')
      ).rejects.toThrow(TRPCError);
    });
  });
});
```

## Creating New Services

### Step 1: Define Service Interface

```typescript
// types/services/my-service.types.ts
export interface CreateMyEntityInput {
  name: string;
  description?: string;
}

export interface MyEntityFilters {
  search?: string;
  status?: EntityStatus;
}

export interface MyEntityWithMetadata extends MyEntity {
  metadata: {
    relatedCount: number;
    lastActivity: Date;
  };
}
```

### Step 2: Create Service Class

```typescript
// server/services/my-entity.service.ts
export class MyEntityService {
  constructor(
    private db: PrismaClient,
    private session: Session
  ) {}

  async create(input: CreateMyEntityInput): Promise<MyEntity> {
    // Validation
    if (!input.name.trim()) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Name is required'
      });
    }

    // Business logic
    const entity = await this.db.myEntity.create({
      data: {
        ...input,
        userId: this.session.user.id
      }
    });

    // Post-processing
    await this.notifyCreation(entity);

    return entity;
  }

  private async notifyCreation(entity: MyEntity) {
    // Notification logic
  }
}
```

### Step 3: Export from Index

```typescript
// server/services/index.ts
export { MyEntityService } from './my-entity.service';
```

### Step 4: Use in Router

```typescript
// server/api/routers/my-entity.ts
export const myEntityRouter = createTRPCRouter({
  create: protectedProcedure
    .input(createMyEntitySchema)
    .mutation(async ({ ctx, input }) => {
      const service = new MyEntityService(ctx.db, ctx.session);
      return await service.create(input);
    })
});
```

## Advanced Patterns

### 1. Service Composition

Compose services for complex operations:

```typescript
export class ApartmentSearchService {
  constructor(
    private apartmentService: ApartmentService,
    private routeService: RouteService,
    private scoreService: ApartmentScoreService
  ) {}

  async searchWithScoring(
    filters: SearchFilters,
    userId: string
  ): Promise<ScoredApartment[]> {
    // Use apartment service to search
    const apartments = await this.apartmentService.search(filters);

    // Use route service to calculate commutes
    const withRoutes = await this.routeService.calculateRoutes(
      apartments,
      filters.workplaceStationId
    );

    // Use score service to score results
    const scored = await this.scoreService.scoreMultiple(
      withRoutes,
      userId
    );

    return scored.sort((a, b) => b.score - a.score);
  }
}
```

### 2. Event-Driven Services

Emit events for decoupled operations:

```typescript
export class ListService extends EventEmitter {
  async create(input: CreateListInput): Promise<List> {
    const list = await this.db.list.create({
      data: { ...input, userId: this.session.user.id }
    });

    // Emit event for other services to react
    this.emit('listCreated', {
      listId: list.id,
      userId: this.session.user.id,
      type: list.type
    });

    return list;
  }
}

// Other services can listen
listService.on('listCreated', async (event) => {
  await analyticsService.trackListCreation(event);
});
```

### 3. Service Decorators

Add cross-cutting concerns via decorators:

```typescript
function Cached(ttl: number) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const cache = new Map();

    descriptor.value = async function (...args: any[]) {
      const key = JSON.stringify(args);
      const cached = cache.get(key);

      if (cached && cached.expires > Date.now()) {
        return cached.value;
      }

      const result = await originalMethod.apply(this, args);
      
      cache.set(key, {
        value: result,
        expires: Date.now() + ttl
      });

      return result;
    };
  };
}

export class StationService {
  @Cached(60000) // Cache for 1 minute
  async getPopularStations(): Promise<Station[]> {
    return await this.db.station.findMany({
      orderBy: { apartmentCount: 'desc' },
      take: 10
    });
  }
}
```

## Conclusion

The service layer is where your application's value lives. By following these patterns:

- **Keep business logic in services**, not in routers or repositories
- **Use dependency injection** for testability
- **Handle errors appropriately** with meaningful messages
- **Document complex operations** for maintainability
- **Write comprehensive tests** to ensure reliability

This creates a maintainable, testable, and scalable application architecture.