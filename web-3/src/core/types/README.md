# Core Types

Shared type definitions and utilities for type-safe development.

## Modules

### Common Types (`common.ts`)
Basic types used throughout the application:
- `Result<T, E>` - For operations that can fail
- `Coordinates`, `TimeRange` - Domain primitives
- `PaginationParams`, `PaginationInfo` - API pagination
- `Nullable<T>`, `Optional<T>`, `Maybe<T>` - Null handling

### Utility Types (`utility.ts`)
Advanced TypeScript utility types:
- `DeepPartial<T>`, `DeepReadonly<T>` - Deep type operations
- `RequiredKeys<T>`, `OptionalKeys<T>` - Key filtering
- `Path<T>`, `PathValue<T, P>` - Type-safe dot notation
- `Merge<T, U>` - Type merging

### Type Guards (`guards.ts`)
Runtime type checking:
```typescript
import { isString, assertNotNull } from '@/core/types';

// Type narrowing
if (isString(value)) {
  console.log(value.toUpperCase());
}

// Type assertion
assertNotNull(user, 'user');
console.log(user.name); // TypeScript knows user is not null
```

### Branded Types (`branded.ts`)
Type-safe domain primitives:
```typescript
import { UserId, ApartmentId, Email, Yen } from '@/core/types';

// Prevents mixing different ID types
const userId = UserId('user_123');
const apartmentId = ApartmentId('apt_456');

// Validated construction
const email = Email('user@example.com'); // Throws if invalid
const price = Yen(100000); // Throws if negative

// Type safety
function getUser(id: UserId) { /* ... */ }
getUser(apartmentId); // TypeScript error!
```

### Result Types (`result.ts`)
Functional error handling:
```typescript
import { Result, ok, err, isOk, tryCatch } from '@/core/types';

// Explicit error handling
function divide(a: number, b: number): Result<number, string> {
  if (b === 0) return err('Division by zero');
  return ok(a / b);
}

// Chaining operations
const result = divide(10, 2);
const doubled = resultMap(result, x => x * 2);

// Safe exception handling
const parsed = tryCatch(
  () => JSON.parse(input),
  error => `Parse error: ${error.message}`
);
```

## Best Practices

1. **Use branded types for domain primitives** - Prevents bugs from mixing up IDs
2. **Prefer Result over throwing** - Makes errors explicit in function signatures
3. **Use type guards for runtime validation** - Ensures type safety at boundaries
4. **Leverage utility types** - Reduces boilerplate and improves maintainability

## Guidelines

- Keep types generic and reusable
- Avoid domain-specific types (those belong in domain layer)
- Use descriptive names
- Document complex types

## Owner: DO (DevOps Agent)