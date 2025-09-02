# Backend Architecture Migration Checklist

This checklist ensures that all backend code follows the new layered architecture after the refactoring effort.

## ✅ Architecture Requirements

### 1. Router Layer (API Endpoints)
- [ ] Routers are thin HTTP handlers only
- [ ] No business logic in routers
- [ ] No direct database calls (`ctx.db`) in routers
- [ ] All operations delegated to services
- [ ] Input validation using Zod schemas
- [ ] Proper error handling with tRPC errors

### 2. Service Layer (Business Logic)
- [ ] All business logic encapsulated in services
- [ ] Services handle complex operations and workflows
- [ ] Services use repositories for data access
- [ ] Services never import Prisma directly
- [ ] Proper error handling and validation
- [ ] Services are testable with mocked dependencies

### 3. Repository Layer (Data Access)
- [ ] All database operations go through repositories
- [ ] Repositories handle domain-to-persistence mapping
- [ ] Repositories return domain entities, not Prisma models
- [ ] Transaction support for complex operations
- [ ] No business logic in repositories
- [ ] Repositories extend BaseRepository when applicable

### 4. Domain Layer (Core Business)
- [ ] Domain entities have no infrastructure dependencies
- [ ] Business rules encoded in domain objects
- [ ] Value objects for complex types
- [ ] Domain events for cross-boundary communication

## 🔍 Migration Verification Steps

### Step 1: Audit Routers
Check each router file for:
```typescript
// ❌ BAD - Direct database call
const user = await ctx.db.user.findUnique({ where: { id } });

// ✅ GOOD - Using service
const userService = new UserService(ctx.db);
const user = await userService.findById(id);
```

### Step 2: Audit Services
Check each service file for:
```typescript
// ❌ BAD - Direct Prisma usage
import { PrismaClient } from '@prisma/client';
const users = await this.prisma.user.findMany();

// ✅ GOOD - Using repository
import { UserRepository } from '~/server/repositories';
const users = await this.userRepository.findMany();
```

### Step 3: Audit Imports
Search for problematic imports:
```bash
# Find direct Prisma imports outside infrastructure
grep -r "from '@prisma/client'" src/ | grep -v infrastructure | grep -v server/db.ts

# Find direct database usage in routers
grep -r "ctx.db." src/server/api/routers/

# Find repository usage in wrong places
grep -r "Repository" src/app/
```

### Step 4: Test Coverage
Ensure proper test coverage:
- [ ] All services have unit tests
- [ ] All repositories have integration tests
- [ ] Mocked dependencies in tests
- [ ] No database calls in unit tests

## 📋 Router-by-Router Status

| Router | Service Layer | Repository Usage | Direct DB Calls | Status |
|--------|--------------|------------------|-----------------|---------|
| auth.ts | ✅ AuthService | ✅ UserRepository | ❌ None | ✅ Complete |
| station.ts | ✅ StationService | ✅ StationRepository | ❌ None | ✅ Complete |
| score.ts | ✅ ApartmentScoreService | ❌ Uses Prisma | ❌ None | ✅ Complete |
| list.ts | ✅ ListService | ⚠️ Mixed | ❌ None | ✅ Complete |
| post.ts | ❌ No service | N/A | ❌ None | ✅ Simple placeholder |
| search.ts | ✅ SearchService (DI) | ✅ Via service | ⚠️ 1 session create | 🔄 Minor fix needed |
| apartment.ts | ✅ ApartmentService | ✅ Via service | ❌ None | ✅ Complete |
| user.ts | ✅ UserService | ✅ UserRepository | ❌ None | ✅ Complete |
| admin.ts | ✅ Multiple services | ⚠️ Mixed | ⚠️ 2 (acceptable) | ✅ Complete |

## 🚨 Exceptions

These patterns are acceptable exceptions:

1. **Health Checks**: Raw SQL queries for database health
   ```typescript
   await ctx.db.$queryRaw`SELECT 1`; // OK for health checks
   ```

2. **Session Management**: Direct session creates in auth flows
   ```typescript
   await ctx.db.session.create({ ... }); // OK in auth context
   ```

3. **Prisma in Services**: Some services may use Prisma directly if they don't have complex domain logic
   - ApartmentScoreService (scoring is calculation-heavy)
   - Background job services

## 🎯 Final Verification

Run these commands to ensure migration is complete:

```bash
# No direct DB calls in routers (except admin health check)
grep -r "ctx\.db\." src/server/api/routers/ | grep -v "admin.ts" | grep -v "SELECT 1"

# All routers use services
grep -r "Service" src/server/api/routers/ | wc -l  # Should be > 20

# No Prisma imports in app layer
grep -r "@prisma/client" src/app/ | wc -l  # Should be 0

# Services are properly exported
grep -r "export.*Service" src/server/services/index.ts
```

## ✨ Benefits Achieved

1. **Separation of Concerns**: Clear boundaries between layers
2. **Testability**: Easy to mock dependencies
3. **Maintainability**: Business logic in one place
4. **Flexibility**: Easy to swap data sources
5. **Type Safety**: Domain types separate from persistence

## 📚 Resources

- [Architecture Documentation](../api/Architecture.md)
- [Repository Pattern Guide](../api/Repository-pattern.md)
- [Service Layer Guide](../api/Service-layer.md)
- [Migration Examples](../api/Migration-guide.md)

---

*This checklist ensures the backend refactoring maintains architectural integrity and follows best practices.*