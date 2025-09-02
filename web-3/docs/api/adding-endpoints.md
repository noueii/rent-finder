# Adding New API Endpoints

This guide walks through the process of adding new API endpoints to the Tokyo Apartment Finder application using the new service-based architecture.

## Overview

Adding a new endpoint involves:
1. Define the data types
2. Create/update the service
3. Add the router endpoint
4. Test the implementation
5. Document the endpoint

## Step-by-Step Example: Adding a Favorites Feature

Let's walk through adding a feature where users can favorite apartments.

### Step 1: Define Types

First, define the TypeScript types and Zod schemas:

```typescript
// src/types/favorites.ts
export interface FavoriteApartment {
  id: string;
  userId: string;
  apartmentId: string;
  notes?: string;
  createdAt: Date;
  apartment?: ApartmentWithRelations;
}

export interface AddFavoriteInput {
  apartmentId: string;
  notes?: string;
}

export interface UpdateFavoriteInput {
  id: string;
  notes?: string;
}
```

### Step 2: Update Database Schema (if needed)

If the feature requires new tables:

```prisma
// prisma/schema.prisma
model Favorite {
  id          String    @id @default(cuid())
  userId      String
  apartmentId String
  notes       String?
  createdAt   DateTime  @default(now())
  
  user        User      @relation(fields: [userId], references: [id])
  apartment   Apartment @relation(fields: [apartmentId], references: [id])
  
  @@unique([userId, apartmentId])
  @@index([userId])
  @@index([apartmentId])
}
```

Run migrations:
```bash
npx prisma migrate dev --name add-favorites
```

### Step 3: Create Repository (if needed)

For complex data operations, create a repository:

```typescript
// src/server/repositories/interfaces/favorite.repository.interface.ts
export interface IFavoriteRepository extends BaseRepository<Favorite> {
  findByUser(userId: string): Promise<FavoriteWithApartment[]>;
  findByUserAndApartment(userId: string, apartmentId: string): Promise<Favorite | null>;
  removeByUserAndApartment(userId: string, apartmentId: string): Promise<void>;
}

// src/server/repositories/implementations/favorite.repository.ts
export class FavoriteRepository 
  extends PrismaBaseRepository<Favorite, Prisma.FavoriteCreateInput, Prisma.FavoriteUpdateInput>
  implements IFavoriteRepository {
  
  constructor(prisma: PrismaClient) {
    super(prisma, 'favorite');
  }

  async findByUser(userId: string): Promise<FavoriteWithApartment[]> {
    return await this.model.findMany({
      where: { userId },
      include: {
        apartment: {
          include: {
            images: { orderBy: { order: 'asc' }, take: 1 },
            nearestStations: {
              include: { station: true },
              orderBy: { walkingMinutes: 'asc' },
              take: 3
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findByUserAndApartment(userId: string, apartmentId: string): Promise<Favorite | null> {
    return await this.model.findUnique({
      where: {
        userId_apartmentId: { userId, apartmentId }
      }
    });
  }

  async removeByUserAndApartment(userId: string, apartmentId: string): Promise<void> {
    await this.model.delete({
      where: {
        userId_apartmentId: { userId, apartmentId }
      }
    });
  }
}
```

### Step 4: Create Service

Create a service to handle the business logic:

```typescript
// src/server/services/favorite.service.ts
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import type { Session } from "next-auth";

export class FavoriteService {
  constructor(
    private db: PrismaClient,
    private session: Session
  ) {}

  /**
   * Get all favorites for the current user
   */
  async getUserFavorites() {
    const favorites = await this.db.favorite.findMany({
      where: { userId: this.session.user.id },
      include: {
        apartment: {
          include: {
            images: { orderBy: { order: 'asc' }, take: 1 },
            nearestStations: {
              include: { station: true },
              orderBy: { walkingMinutes: 'asc' },
              take: 3
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Add additional metadata
    return favorites.map(fav => ({
      ...fav,
      apartment: {
        ...fav.apartment,
        isFavorited: true,
        twoYearAverage: this.calculateTwoYearAverage(fav.apartment)
      }
    }));
  }

  /**
   * Add apartment to favorites
   */
  async addFavorite(input: AddFavoriteInput) {
    // Check if apartment exists
    const apartment = await this.db.apartment.findUnique({
      where: { id: input.apartmentId }
    });

    if (!apartment) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Apartment not found'
      });
    }

    // Check if already favorited
    const existing = await this.db.favorite.findUnique({
      where: {
        userId_apartmentId: {
          userId: this.session.user.id,
          apartmentId: input.apartmentId
        }
      }
    });

    if (existing) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Apartment already in favorites'
      });
    }

    // Add to favorites
    return await this.db.favorite.create({
      data: {
        userId: this.session.user.id,
        apartmentId: input.apartmentId,
        notes: input.notes
      },
      include: {
        apartment: true
      }
    });
  }

  /**
   * Update favorite notes
   */
  async updateFavorite(input: UpdateFavoriteInput) {
    // Verify ownership
    const favorite = await this.db.favorite.findFirst({
      where: {
        id: input.id,
        userId: this.session.user.id
      }
    });

    if (!favorite) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Favorite not found'
      });
    }

    return await this.db.favorite.update({
      where: { id: input.id },
      data: { notes: input.notes }
    });
  }

  /**
   * Remove from favorites
   */
  async removeFavorite(apartmentId: string) {
    const result = await this.db.favorite.deleteMany({
      where: {
        userId: this.session.user.id,
        apartmentId
      }
    });

    if (result.count === 0) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Favorite not found'
      });
    }

    return { success: true };
  }

  /**
   * Check if apartments are favorited
   */
  async checkFavorites(apartmentIds: string[]): Promise<Record<string, boolean>> {
    const favorites = await this.db.favorite.findMany({
      where: {
        userId: this.session.user.id,
        apartmentId: { in: apartmentIds }
      },
      select: { apartmentId: true }
    });

    const favoriteSet = new Set(favorites.map(f => f.apartmentId));
    
    return apartmentIds.reduce((acc, id) => {
      acc[id] = favoriteSet.has(id);
      return acc;
    }, {} as Record<string, boolean>);
  }

  private calculateTwoYearAverage(apartment: any): number {
    const twoYearTotal = 
      apartment.price * 24 + 
      (apartment.deposit || apartment.price * 2) + 
      (apartment.keyMoney || 0) + 
      (apartment.reikin || 0);
    
    return Math.round(twoYearTotal / 24);
  }
}
```

### Step 5: Create Router

Add the tRPC router with input validation:

```typescript
// src/server/api/routers/favorite.ts
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { FavoriteService } from "~/server/services";

// Input validation schemas
const addFavoriteSchema = z.object({
  apartmentId: z.string().cuid(),
  notes: z.string().max(500).optional()
});

const updateFavoriteSchema = z.object({
  id: z.string().cuid(),
  notes: z.string().max(500).optional()
});

const checkFavoritesSchema = z.object({
  apartmentIds: z.array(z.string().cuid()).max(100)
});

export const favoriteRouter = createTRPCRouter({
  /**
   * Get all user's favorites
   */
  getAll: protectedProcedure
    .query(async ({ ctx }) => {
      const service = new FavoriteService(ctx.db, ctx.session);
      return await service.getUserFavorites();
    }),

  /**
   * Add apartment to favorites
   */
  add: protectedProcedure
    .input(addFavoriteSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new FavoriteService(ctx.db, ctx.session);
      return await service.addFavorite(input);
    }),

  /**
   * Update favorite notes
   */
  update: protectedProcedure
    .input(updateFavoriteSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new FavoriteService(ctx.db, ctx.session);
      return await service.updateFavorite(input);
    }),

  /**
   * Remove from favorites
   */
  remove: protectedProcedure
    .input(z.object({ apartmentId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new FavoriteService(ctx.db, ctx.session);
      return await service.removeFavorite(input.apartmentId);
    }),

  /**
   * Check which apartments are favorited
   */
  checkFavorites: protectedProcedure
    .input(checkFavoritesSchema)
    .query(async ({ ctx, input }) => {
      const service = new FavoriteService(ctx.db, ctx.session);
      return await service.checkFavorites(input.apartmentIds);
    })
});
```

### Step 6: Register Router

Add the router to the root API:

```typescript
// src/server/api/root.ts
import { favoriteRouter } from "./routers/favorite";

export const appRouter = createTRPCRouter({
  // ... existing routers
  favorite: favoriteRouter,
});
```

### Step 7: Export Service

Export the service from the index:

```typescript
// src/server/services/index.ts
export { FavoriteService } from './favorite.service';
```

### Step 8: Test the Implementation

Create comprehensive tests:

```typescript
// src/server/services/__tests__/favorite.service.test.ts
import { FavoriteService } from '../favorite.service';
import { createMockPrismaClient, createMockSession } from '~/test/mocks';

describe('FavoriteService', () => {
  let service: FavoriteService;
  let mockDb: MockPrismaClient;
  let mockSession: Session;

  beforeEach(() => {
    mockDb = createMockPrismaClient();
    mockSession = createMockSession({ userId: 'user123' });
    service = new FavoriteService(mockDb, mockSession);
  });

  describe('addFavorite', () => {
    it('should add apartment to favorites', async () => {
      // Mock apartment exists
      mockDb.apartment.findUnique.mockResolvedValue({
        id: 'apt123',
        name: 'Test Apartment'
      });

      // Mock no existing favorite
      mockDb.favorite.findUnique.mockResolvedValue(null);

      // Mock create
      mockDb.favorite.create.mockResolvedValue({
        id: 'fav123',
        userId: 'user123',
        apartmentId: 'apt123',
        notes: 'Great location',
        createdAt: new Date(),
        apartment: { id: 'apt123', name: 'Test Apartment' }
      });

      const result = await service.addFavorite({
        apartmentId: 'apt123',
        notes: 'Great location'
      });

      expect(result.id).toBe('fav123');
      expect(mockDb.favorite.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          apartmentId: 'apt123',
          notes: 'Great location'
        },
        include: { apartment: true }
      });
    });

    it('should throw if apartment not found', async () => {
      mockDb.apartment.findUnique.mockResolvedValue(null);

      await expect(
        service.addFavorite({ apartmentId: 'apt123' })
      ).rejects.toThrow('Apartment not found');
    });

    it('should throw if already favorited', async () => {
      mockDb.apartment.findUnique.mockResolvedValue({ id: 'apt123' });
      mockDb.favorite.findUnique.mockResolvedValue({ id: 'fav123' });

      await expect(
        service.addFavorite({ apartmentId: 'apt123' })
      ).rejects.toThrow('Apartment already in favorites');
    });
  });
});
```

### Step 9: Use in Frontend

Use the new endpoint in React components:

```typescript
// src/components/ApartmentCard.tsx
import { api } from "~/utils/api";

export function ApartmentCard({ apartment }: { apartment: Apartment }) {
  const utils = api.useContext();
  
  const { data: isFavorited } = api.favorite.checkFavorites.useQuery({
    apartmentIds: [apartment.id]
  });

  const addFavorite = api.favorite.add.useMutation({
    onSuccess: () => {
      utils.favorite.invalidate();
      toast.success("Added to favorites");
    }
  });

  const removeFavorite = api.favorite.remove.useMutation({
    onSuccess: () => {
      utils.favorite.invalidate();
      toast.success("Removed from favorites");
    }
  });

  const handleToggleFavorite = () => {
    if (isFavorited?.[apartment.id]) {
      removeFavorite.mutate({ apartmentId: apartment.id });
    } else {
      addFavorite.mutate({ apartmentId: apartment.id });
    }
  };

  return (
    <div className="apartment-card">
      {/* ... apartment details ... */}
      <button onClick={handleToggleFavorite}>
        {isFavorited?.[apartment.id] ? "❤️" : "🤍"}
      </button>
    </div>
  );
}
```

## Common Patterns for Different Endpoint Types

### 1. Query Endpoints (GET)

For fetching data:

```typescript
// Router
getById: protectedProcedure
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx, input }) => {
    const service = new MyService(ctx.db, ctx.session);
    return await service.getById(input.id);
  }),

// Service
async getById(id: string) {
  const item = await this.db.myModel.findUnique({
    where: { id },
    include: { /* relations */ }
  });
  
  if (!item) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Item not found'
    });
  }
  
  return this.transformToDTO(item);
}
```

### 2. Mutation Endpoints (POST/PUT/DELETE)

For modifying data:

```typescript
// Router
update: protectedProcedure
  .input(updateSchema)
  .mutation(async ({ ctx, input }) => {
    const service = new MyService(ctx.db, ctx.session);
    return await service.update(input);
  }),

// Service
async update(input: UpdateInput) {
  // Verify ownership
  await this.verifyOwnership(input.id);
  
  // Validate business rules
  await this.validateUpdate(input);
  
  // Perform update
  const updated = await this.db.myModel.update({
    where: { id: input.id },
    data: input.data
  });
  
  // Post-update actions
  await this.handlePostUpdate(updated);
  
  return updated;
}
```

### 3. Bulk Operations

For operations on multiple items:

```typescript
// Router
bulkDelete: protectedProcedure
  .input(z.object({ ids: z.array(z.string()).max(100) }))
  .mutation(async ({ ctx, input }) => {
    const service = new MyService(ctx.db, ctx.session);
    return await service.bulkDelete(input.ids);
  }),

// Service
async bulkDelete(ids: string[]) {
  // Verify ownership of all items
  const items = await this.db.myModel.findMany({
    where: {
      id: { in: ids },
      userId: this.session.user.id
    }
  });
  
  if (items.length !== ids.length) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Some items not found or not owned by user'
    });
  }
  
  // Perform bulk delete
  const result = await this.db.myModel.deleteMany({
    where: { id: { in: ids } }
  });
  
  return {
    deleted: result.count,
    requested: ids.length
  };
}
```

### 4. Paginated Queries

For large datasets:

```typescript
// Router
list: protectedProcedure
  .input(z.object({
    page: z.number().min(1).default(1),
    limit: z.number().min(1).max(100).default(20),
    filters: filtersSchema.optional(),
    sort: sortSchema.optional()
  }))
  .query(async ({ ctx, input }) => {
    const service = new MyService(ctx.db, ctx.session);
    return await service.list(input);
  }),

// Service
async list(input: ListInput) {
  const where = this.buildWhereClause(input.filters);
  const orderBy = this.buildOrderBy(input.sort);
  
  const skip = (input.page - 1) * input.limit;
  
  const [items, total] = await Promise.all([
    this.db.myModel.findMany({
      where,
      orderBy,
      skip,
      take: input.limit
    }),
    this.db.myModel.count({ where })
  ]);
  
  return {
    items,
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.ceil(total / input.limit),
      hasMore: skip + items.length < total
    }
  };
}
```

## Input Validation Best Practices

### 1. Use Strict Schemas

```typescript
const createApartmentSchema = z.object({
  name: z.string().min(1).max(200),
  price: z.number().positive().max(10000000),
  size: z.number().positive().max(1000),
  layout: z.enum(['1R', '1K', '1DK', '1LDK', '2K', '2DK', '2LDK', '3LDK']),
  address: z.string().min(1).max(500),
  nearestStations: z.array(z.object({
    stationId: z.string().cuid(),
    walkingMinutes: z.number().min(1).max(60)
  })).min(1).max(5)
});
```

### 2. Validate Business Rules in Service

```typescript
async create(input: CreateInput) {
  // Schema validates format, service validates business rules
  
  // Check duplicates
  const existing = await this.db.apartment.findFirst({
    where: {
      externalId: input.externalId,
      sourceSite: input.sourceSite
    }
  });
  
  if (existing) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'Apartment already exists'
    });
  }
  
  // Check user limits
  const userApartmentCount = await this.db.apartment.count({
    where: { userId: this.session.user.id }
  });
  
  if (userApartmentCount >= 1000) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Apartment limit reached'
    });
  }
  
  // Create apartment
  return await this.db.apartment.create({ data: input });
}
```

## Error Handling Guidelines

### 1. Use Appropriate Error Codes

```typescript
// NOT_FOUND - Resource doesn't exist
if (!apartment) {
  throw new TRPCError({
    code: 'NOT_FOUND',
    message: 'Apartment not found'
  });
}

// FORBIDDEN - User doesn't have permission
if (apartment.userId !== this.session.user.id) {
  throw new TRPCError({
    code: 'FORBIDDEN',
    message: 'You do not have permission to edit this apartment'
  });
}

// BAD_REQUEST - Invalid input
if (input.price < 0) {
  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: 'Price must be positive'
  });
}

// CONFLICT - Resource already exists
if (duplicate) {
  throw new TRPCError({
    code: 'CONFLICT',
    message: 'An apartment with this ID already exists'
  });
}

// INTERNAL_SERVER_ERROR - Unexpected errors
try {
  // operation
} catch (error) {
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred'
  });
}
```

### 2. Provide Helpful Error Messages

```typescript
// Bad: Generic message
throw new TRPCError({
  code: 'BAD_REQUEST',
  message: 'Invalid input'
});

// Good: Specific message
throw new TRPCError({
  code: 'BAD_REQUEST',
  message: 'Apartment size must be between 10 and 500 square meters'
});
```

## Documentation Template

Document your endpoints in the router file:

```typescript
/**
 * Favorite Router
 * 
 * Manages user's favorite apartments. Users can:
 * - Add apartments to favorites with optional notes
 * - Remove apartments from favorites
 * - View all favorited apartments
 * - Check if specific apartments are favorited
 * 
 * All operations are scoped to the authenticated user.
 */
export const favoriteRouter = createTRPCRouter({
  /**
   * Get all user's favorites
   * 
   * @returns Array of favorites with apartment details
   * @throws {UNAUTHORIZED} If user is not authenticated
   * 
   * @example
   * const favorites = await trpc.favorite.getAll.query();
   */
  getAll: protectedProcedure.query(/* ... */),

  /**
   * Add apartment to favorites
   * 
   * @param apartmentId - ID of apartment to favorite
   * @param notes - Optional notes about the apartment
   * @returns Created favorite object
   * @throws {NOT_FOUND} If apartment doesn't exist
   * @throws {CONFLICT} If already favorited
   * 
   * @example
   * await trpc.favorite.add.mutate({
   *   apartmentId: 'apt123',
   *   notes: 'Great location near station'
   * });
   */
  add: protectedProcedure.input(/* ... */).mutation(/* ... */),
});
```

## Checklist for New Endpoints

- [ ] Define TypeScript types
- [ ] Create/update Prisma schema if needed
- [ ] Run database migrations
- [ ] Create repository if complex data access needed
- [ ] Create/update service with business logic
- [ ] Add input validation schemas
- [ ] Create router endpoint
- [ ] Register router in root
- [ ] Export service from index
- [ ] Write unit tests for service
- [ ] Write integration tests for endpoint
- [ ] Document the endpoint
- [ ] Update API documentation
- [ ] Create frontend hooks/components

## Common Mistakes to Avoid

1. **Don't put business logic in routers** - Use services
2. **Don't skip input validation** - Always use Zod schemas
3. **Don't forget error handling** - Handle all edge cases
4. **Don't expose sensitive data** - Transform responses appropriately
5. **Don't skip authorization** - Always check permissions
6. **Don't forget to test** - Write comprehensive tests
7. **Don't create god services** - Keep services focused

By following this guide, you'll create consistent, maintainable, and well-tested API endpoints that follow the established patterns of the application.