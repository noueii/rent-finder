# Backend Agent (BE) - Refactoring Tasks

**Agent Type**: Backend (BE)
**Focus**: Data layer, services, and API
**Start Date**: After DO-004 complete (Day 3-4)
**Critical Path**: Yes - Blocks FE

## 🎯 Your Mission

You are responsible for implementing a clean data layer with proper separation of concerns. Your work directly blocks the frontend team, so focus on delivering stable interfaces quickly. The repository pattern and service layer you create will be used by all other components.

## 📋 Your Tasks

### Task BE-001: Repository Interfaces ✅
**Duration**: 1 day
**Dependencies**: DO-002, DO-003, DO-004
**Blocks**: BE-002
**Status**: COMPLETE

Design and implement repository interfaces:
```typescript
// src/domain/repositories/base.ts
// Follow contracts in REFACTOR-CONTRACTS.md
```

**Acceptance Criteria**:
- [x] Base repository interface defined
- [x] Apartment repository interface defined
- [x] User repository interface defined
- [x] List repository interface defined
- [x] All use proper TypeScript generics

### Task BE-002: Base Repository ✅
**Duration**: 1 day
**Dependencies**: BE-001
**Blocks**: BE-003
**Status**: COMPLETE

Implement base repository with Prisma:
```typescript
// src/infrastructure/database/prisma-base-repository.ts
export class PrismaBaseRepository<T> implements BaseRepository<T> {
  // Generic Prisma implementation
}
```

**Acceptance Criteria**:
- [x] All base methods implemented
- [x] Proper error handling using DO's error handler
- [x] Pagination support
- [x] Transaction support
- [x] Unit tests with mocked Prisma

### Task BE-003: Service Layer ⬜
**Duration**: 2 days
**Dependencies**: BE-002
**Blocks**: BE-004, BE-005, FE-001 (Critical!)

Extract business logic into services:
1. ApartmentService
2. UserService
3. SearchService
4. ListService

**Files to refactor from**:
- src/server/api/routers/apartment.ts
- src/server/api/routers/user.ts
- src/server/api/routers/search.ts

**Acceptance Criteria**:
- [ ] Services use repositories, not direct DB
- [ ] Business logic extracted from routers
- [ ] Services registered in DI container
- [ ] Clear service interfaces defined
- [ ] Integration tests for each service

### Task BE-004: Router Merge ⬜
**Duration**: 1 day
**Dependencies**: BE-003
**Blocks**: None

Merge duplicate routers:
1. Combine apartment.ts and apartment-optimized.ts
2. Use feature flags for optimizations
3. Clean router focuses only on HTTP concerns

**Acceptance Criteria**:
- [ ] Single apartment router
- [ ] Optimizations behind feature flags
- [ ] Router only handles HTTP, delegates to services
- [ ] All endpoints tested
- [ ] No business logic in router

### Task BE-005: Business Logic Extraction ⬜
**Duration**: 2 days
**Dependencies**: BE-003
**Blocks**: IN-004

Complete extraction of remaining business logic:
1. Score calculations → ScoreService
2. Route calculations → RouteService
3. Geocoding logic → GeocodingService

**Acceptance Criteria**:
- [ ] No business logic in routers
- [ ] All calculations in services
- [ ] Services properly typed
- [ ] Services use dependency injection
- [ ] Full test coverage

## 📁 Files You Own

```
src/
├── domain/
│   ├── entities/
│   │   ├── apartment.ts
│   │   ├── user.ts
│   │   └── list.ts
│   ├── repositories/
│   │   ├── base.ts
│   │   ├── apartment.ts
│   │   └── user.ts
│   └── services/
│       ├── apartment-service.ts
│       ├── user-service.ts
│       └── search-service.ts
├── application/
│   ├── use-cases/
│   └── dto/
├── infrastructure/
│   └── database/
│       ├── prisma-base-repository.ts
│       ├── apartment-repository.ts
│       └── user-repository.ts
└── server/
    └── api/
        └── routers/ (refactor these)
```

## 🚫 Do NOT Touch

- UI components in `src/components/`
- Scraper logic in `src/lib/scrapers/`
- Core utilities (unless using them)

## 📝 Progress Tracking

After completing each task:
1. Update REFACTOR-PROGRESS.md
2. If you change interfaces, update REFACTOR-CONTRACTS.md
3. Notify FE when BE-003 is ready
4. Use commit format: `[BE] Task: Description`

## 🔧 Quick Commands

```bash
# Run your tests
npm test src/domain src/infrastructure/database

# Test your API
npm run test:api

# Check types
npm run type-check

# See who depends on you
grep -r "BE-" docs/refactoring/REFACTOR-DEPENDENCIES.md
```

## 💡 Implementation Guide

### Repository Pattern Example
```typescript
// Don't put Prisma types in domain layer!
export class PrismaApartmentRepository implements ApartmentRepository {
  constructor(
    private prisma: PrismaClient,
    private errorHandler: ErrorHandler
  ) {}

  async findById(id: string): Promise<Apartment | null> {
    try {
      const data = await this.prisma.apartment.findUnique({
        where: { id },
        include: this.defaultInclude
      });
      return data ? this.toDomain(data) : null;
    } catch (error) {
      throw this.errorHandler.handle(error);
    }
  }

  private toDomain(data: PrismaApartment): Apartment {
    // Map Prisma type to domain type
  }
}
```

### Service Pattern Example
```typescript
export class ApartmentService {
  constructor(
    private apartmentRepo: ApartmentRepository,
    private scoreService: ScoreService,
    private logger: Logger
  ) {}

  async search(params: SearchParams): Promise<SearchResult> {
    // Business logic here, not in router!
  }
}
```

## 🚨 Critical Reminders

- FE is blocked on your BE-003! Deliver interfaces ASAP
- Keep domain layer pure - no Prisma imports
- Use DO's error handler consistently
- Register all services in DI container
- Don't break existing API contracts

## 📞 Communication

- **Blocked by DO?** Check REFACTOR-PROGRESS.md for status
- **Interface ready?** Update contracts and notify FE
- **Breaking change?** Discuss in progress file first
- **Need help?** Ask in progress file

## 🎯 Quality Checklist

Before marking any task complete:
- [ ] Types are explicit (no `any`)
- [ ] Errors handled properly
- [ ] Tests pass
- [ ] Documentation updated
- [ ] No Prisma types leak to domain
- [ ] Services registered in DI

---
*Clean architecture depends on you. Keep those layers separated! 🏗️*