# Application Services

This directory contains the business logic layer of the application, implementing the service pattern to separate business logic from the tRPC routers.

## Architecture

- **Service Interfaces** (`interfaces.ts`) - Define contracts for all services
- **Service Implementations** - Concrete implementations of service interfaces
- **Dependency Injection** - Services are registered in the DI container and injected into routers

## Services

### ApartmentService
Handles all apartment-related business logic:
- CRUD operations for apartments
- Search with filters, pagination, and sorting
- Route calculations
- Ward management
- Data refresh operations

### UserService
Manages user-related operations:
- User preferences management
- Profile management
- Score weights configuration
- Account deletion

### SearchService
Handles search functionality:
- Standard apartment search
- Commute-based search
- Search suggestions
- Popular searches
- Fast concurrent search across multiple sources
- Apartment refresh operations

### ListService
Manages apartment lists:
- List CRUD operations
- Apartment management within lists
- Scoring and marking apartments
- Bulk operations
- Progress tracking

## Usage

Services are accessed through the DI container in tRPC routers:

```typescript
const apartmentService = ctx.container.resolve(ApartmentServiceToken);
const result = await apartmentService.search(filters, pagination, sort);
```

## Benefits

1. **Separation of Concerns** - Business logic is separated from HTTP handling
2. **Testability** - Services can be unit tested independently
3. **Reusability** - Services can be used in different contexts (tRPC, CLI, etc.)
4. **Type Safety** - Full TypeScript support with interfaces
5. **Dependency Injection** - Easy to mock for testing