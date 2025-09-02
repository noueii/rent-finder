# API Documentation

Welcome to the Tokyo Apartment Finder API documentation. This guide covers the architecture, patterns, and best practices for working with the API layer.

## Table of Contents

1. **[Architecture Overview](./architecture.md)**
   - Layered architecture explanation
   - Router → Service → Repository → Database flow
   - Key design patterns and principles

2. **[Service Layer Guide](./service-layer.md)**
   - Creating and using services
   - Common service patterns
   - Business logic organization
   - Testing strategies

3. **[Repository Pattern](./repository-pattern.md)**
   - Repository structure and interfaces
   - Creating custom repositories
   - Query optimization techniques
   - Error handling

4. **[Adding New Endpoints](./adding-endpoints.md)**
   - Step-by-step guide for new features
   - Input validation with Zod
   - Common endpoint patterns
   - Documentation templates

5. **[Migration Guide](./migration-guide.md)**
   - Migrating from old patterns
   - Before/after examples
   - Best practices during migration
   - Common pitfalls to avoid

## Quick Start

### Understanding the Architecture

The API uses a layered architecture:

```
┌─────────────────────────┐
│     tRPC Routers       │  ← HTTP layer (validation, auth)
├─────────────────────────┤
│    Service Layer       │  ← Business logic & orchestration
├─────────────────────────┤
│  Repository Layer      │  ← Data access abstraction
├─────────────────────────┤
│    Prisma ORM         │  ← Database queries
└─────────────────────────┘
```

### Key Concepts

1. **Routers** handle HTTP concerns:
   - Input validation with Zod
   - Authentication/authorization
   - Delegating to services

2. **Services** contain business logic:
   - Complex operations
   - Data transformations
   - Cross-domain coordination

3. **Repositories** abstract data access:
   - Database queries
   - Error handling
   - Query optimization

### Example: Creating a New Feature

Here's a simplified example of adding a "favorite apartments" feature:

```typescript
// 1. Router (thin, delegates to service)
export const favoriteRouter = createTRPCRouter({
  add: protectedProcedure
    .input(z.object({ apartmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const service = new FavoriteService(ctx.db, ctx.session);
      return await service.addFavorite(input.apartmentId);
    })
});

// 2. Service (business logic)
export class FavoriteService {
  async addFavorite(apartmentId: string) {
    // Validate apartment exists
    const apartment = await this.getApartment(apartmentId);
    
    // Check not already favorited
    await this.ensureNotFavorited(apartmentId);
    
    // Create favorite
    return await this.db.favorite.create({
      data: {
        userId: this.session.user.id,
        apartmentId
      }
    });
  }
}

// 3. Repository (if needed for complex queries)
export class FavoriteRepository {
  async findUserFavorites(userId: string) {
    return await this.model.findMany({
      where: { userId },
      include: { apartment: true }
    });
  }
}
```

## Project Structure

```
src/server/
├── api/
│   ├── routers/        # tRPC routers
│   │   ├── apartment.ts
│   │   ├── list.ts
│   │   └── ...
│   ├── root.ts         # Root router
│   └── trpc.ts         # tRPC setup
├── services/           # Business logic
│   ├── apartment.service.ts
│   ├── list.service.ts
│   └── index.ts
└── repositories/       # Data access
    ├── interfaces/     # Repository contracts
    ├── implementations/# Concrete implementations
    └── base.repository.ts
```

## Common Tasks

### Adding a New Endpoint

1. Define types and validation schema
2. Create/update service with business logic
3. Add router method
4. Test the implementation
5. Document the endpoint

See [Adding New Endpoints](./adding-endpoints.md) for detailed steps.

### Refactoring Old Code

1. Identify direct database access in routers
2. Extract business logic to services
3. Update router to use service
4. Add tests for the service
5. Remove old code

See [Migration Guide](./migration-guide.md) for examples.

### Writing Tests

```typescript
// Service test example
describe('ListService', () => {
  it('should create a list', async () => {
    const service = new ListService(mockDb, mockSession);
    const list = await service.create({
      name: 'Test List',
      type: 'CUSTOM'
    });
    
    expect(list.name).toBe('Test List');
    expect(list.userId).toBe(mockSession.user.id);
  });
});
```

## Best Practices

### Do's ✅

- Keep routers thin - delegate to services
- Put business logic in services
- Use repositories for complex data access
- Write comprehensive tests
- Document service methods with JSDoc
- Use TypeScript types extensively
- Handle errors appropriately

### Don'ts ❌

- Don't put business logic in routers
- Don't access DB directly from routers
- Don't create circular dependencies
- Don't skip input validation
- Don't forget error handling
- Don't create god services

## API Conventions

### Naming

- **Services**: `[Domain]Service` (e.g., `ListService`, `ApartmentService`)
- **Repositories**: `[Entity]Repository` (e.g., `ApartmentRepository`)
- **Router methods**: RESTful names (`getAll`, `getById`, `create`, `update`, `delete`)

### Error Codes

- `NOT_FOUND` - Resource doesn't exist
- `FORBIDDEN` - No permission
- `BAD_REQUEST` - Invalid input
- `CONFLICT` - Duplicate/conflict
- `INTERNAL_SERVER_ERROR` - Unexpected error

### Response Format

```typescript
// Single resource
{
  id: string;
  // ... resource fields
}

// Collection with pagination
{
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  }
}

// Operation result
{
  success: boolean;
  message?: string;
  data?: any;
}
```

## Getting Help

1. Check the specific guide for your task
2. Look at existing implementations for patterns
3. Review tests for usage examples
4. Check TypeScript types for API contracts

## Contributing

When adding new API features:

1. Follow the established patterns
2. Write comprehensive tests
3. Document your service methods
4. Update relevant documentation
5. Consider backwards compatibility

---

*Last updated: January 2024*