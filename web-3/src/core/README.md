# Core Infrastructure Documentation

The `core` directory contains foundational utilities and patterns used throughout the Tokyo Apartment Finder application. This infrastructure provides consistent, type-safe, and testable patterns for all agents to use.

## Table of Contents

1. [Overview](#overview)
2. [Dependency Injection (DI)](#dependency-injection)
3. [Error Handling](#error-handling)
4. [Logging](#logging)
5. [Type System](#type-system)
6. [Validation](#validation)
7. [Testing Utilities](#testing-utilities)
8. [Utilities](#utilities)
9. [Migration Guide](#migration-guide)
10. [Best Practices](#best-practices)

## Overview

The core infrastructure provides:

- **Type Safety**: Branded types, type guards, and utility types
- **Error Handling**: Structured error hierarchy with operational vs programming errors
- **Logging**: Structured logging with correlation IDs and context
- **Validation**: Zod-based validation with type inference
- **Testing**: Comprehensive testing utilities and factories
- **DI Container**: Lightweight dependency injection for better testability

## Dependency Injection

### Basic Usage

```typescript
import { container } from '@/core/di';
import { TOKENS } from '@/core/di/tokens';

// Register a service
container.register(TOKENS.PrismaClient, {
  useFactory: () => new PrismaClient(),
  singleton: true,
});

// Resolve a service
const prisma = container.resolve(TOKENS.PrismaClient);
```

### Creating Service Tokens

```typescript
import { createToken } from '@/core/di';

// Define your service interface
interface EmailService {
  send(to: string, subject: string, body: string): Promise<void>;
}

// Create a token
export const EMAIL_SERVICE = createToken<EmailService>('EmailService');
```

### Service Registration Patterns

```typescript
// Factory registration
container.register(TOKENS.StationService, {
  useFactory: (deps) => new StationService(
    deps.resolve(TOKENS.PrismaClient),
    deps.resolve(TOKENS.Logger)
  ),
});

// Value registration
container.register(TOKENS.Config, {
  useValue: { apiKey: process.env.API_KEY },
});

// Class registration
container.register(TOKENS.UserService, {
  useClass: UserService,
  singleton: true,
});
```

### Testing with DI

```typescript
import { TestContainer } from '@/core/testing';

describe('MyService', () => {
  let container: TestContainer;
  
  beforeEach(() => {
    container = new TestContainer();
    container.registerMock(TOKENS.EmailService, {
      send: jest.fn(),
    });
  });
  
  it('should send email', async () => {
    const service = container.resolve(TOKENS.MyService);
    await service.doSomething();
    
    const emailMock = container.resolve(TOKENS.EmailService);
    expect(emailMock.send).toHaveBeenCalled();
  });
});
```

## Error Handling

### Error Hierarchy

```typescript
import { 
  ValidationError, 
  NotFoundError, 
  UnauthorizedError,
  ExternalServiceError 
} from '@/core/errors';

// Throwing structured errors
throw new ValidationError('Invalid input', {
  field: 'email',
  value: 'invalid-email',
});

throw new NotFoundError('User not found', {
  userId: 123,
});

// External service errors
throw new ExternalServiceError('API request failed', {
  service: 'suumo',
  statusCode: 500,
  originalError: error,
});
```

### Error Handler

```typescript
import { errorHandler } from '@/core/errors';

// Express middleware
app.use(errorHandler());

// Custom error handling
app.use(errorHandler({
  onError: (error, req, res) => {
    logger.error('Request failed', error);
  },
  includeStack: process.env.NODE_ENV !== 'production',
}));
```

### tRPC Error Handling

```typescript
import { handleTRPCError } from '@/core/errors';

export const userRouter = t.router({
  getUser: t.procedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      try {
        const user = await userService.findById(input.id);
        if (!user) {
          throw new NotFoundError('User not found');
        }
        return user;
      } catch (error) {
        throw handleTRPCError(error);
      }
    }),
});
```

## Logging

### Basic Logging

```typescript
import { getLogger } from '@/core/logging';

const logger = getLogger('my-module');

logger.debug('Debug message', { data: 'value' });
logger.info('User logged in', { userId: 123 });
logger.warn('Rate limit approaching', { remaining: 5 });
logger.error('Operation failed', error, { context: 'data' });
logger.fatal('System critical error', error);
```

### Request Logging

```typescript
// Express middleware
import { createRequestLoggingMiddleware } from '@/core/logging';

app.use(createRequestLoggingMiddleware());

// Access request logger
app.get('/api/users', (req, res) => {
  req.logger.info('Fetching users');
  // Logger automatically includes request ID and user ID
});
```

### tRPC Logging

```typescript
import { createTRPCLoggingMiddleware } from '@/core/logging';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
    },
  }),
});

// Add logging middleware
const loggedProcedure = t.procedure.use(createTRPCLoggingMiddleware());

export const appRouter = t.router({
  users: t.router({
    list: loggedProcedure.query(async ({ ctx }) => {
      ctx.logger.info('Listing users');
      return userService.list();
    }),
  }),
});
```

### Structured Logging

```typescript
// Create child logger with context
const userLogger = logger.child({ 
  userId: user.id,
  sessionId: session.id,
});

// Correlation IDs for distributed tracing
logger.setCorrelationId(request.headers['x-correlation-id']);

// All subsequent logs include the correlation ID
logger.info('Processing request');
```

### Custom Transports

```typescript
import { configureGlobalLogger, createFileTransport } from '@/core/logging';

// Configure logging
configureGlobalLogger({
  level: 'info',
  transports: [
    coloredConsoleTransport,
    createFileTransport('./logs/app.log'),
    createRemoteTransport('https://logs.example.com', 'api-key'),
  ],
});
```

## Type System

### Branded Types

```typescript
import { Brand, make, UserId, ApartmentId } from '@/core/types';

// Using predefined branded types
const userId = make(UserId)('123');
const apartmentId = make(ApartmentId)('apt-456');

// Creating custom branded types
type SessionId = Brand<string, 'SessionId'>;
const SessionId = (value: string) => value as SessionId;
```

### Result Type

```typescript
import { Result, ok, err, isOk, isErr } from '@/core/types';

// Function returning Result
function divide(a: number, b: number): Result<number, string> {
  if (b === 0) {
    return err('Division by zero');
  }
  return ok(a / b);
}

// Using Result
const result = divide(10, 2);
if (isOk(result)) {
  console.log('Result:', result.value); // 5
} else {
  console.log('Error:', result.error);
}

// Chaining with map
const doubled = result.map(x => x * 2);
```

### Type Guards

```typescript
import { 
  isString, 
  isNumber, 
  isNonEmptyString,
  isDefined,
  isNonNullish 
} from '@/core/types';

// Using type guards
function processValue(value: unknown) {
  if (isNonEmptyString(value)) {
    // value is string and not empty
    console.log(value.toUpperCase());
  }
  
  if (isDefined(value)) {
    // value is not undefined
  }
}

// Array filtering with type guards
const values = ['hello', '', null, 'world', undefined];
const nonEmpty = values.filter(isNonEmptyString);
// nonEmpty: string[] = ['hello', 'world']
```

## Validation

### Schema Definition

```typescript
import { z } from 'zod';
import { 
  createApiKey, 
  createSlug,
  paginationSchema,
  commuteTimeSchema 
} from '@/core/validation';

// Using common schemas
const searchInput = z.object({
  stationId: z.string(),
  commuteTime: commuteTimeSchema,
  ...paginationSchema.shape,
});

// Custom schemas with refinements
const userSchema = z.object({
  email: z.string().email(),
  username: createSlug('username'),
  apiKey: createApiKey(),
});
```

### Validation Functions

```typescript
import { validate, validateAsync } from '@/core/validation';

// Synchronous validation
const result = validate(userSchema, input);
if (result.success) {
  // result.data is fully typed
  console.log(result.data.email);
} else {
  // result.error contains validation errors
  console.error(result.error.errors);
}

// Async validation with custom refinements
const asyncSchema = userSchema.refine(
  async (data) => await checkEmailUnique(data.email),
  { message: 'Email already exists' }
);

const asyncResult = await validateAsync(asyncSchema, input);
```

### Form Validation

```typescript
// tRPC procedure with validation
export const updateProfile = loggedProcedure
  .input(
    z.object({
      name: z.string().min(1),
      email: z.string().email(),
      preferences: preferencesSchema,
    })
  )
  .mutation(async ({ input, ctx }) => {
    // input is fully typed and validated
    return userService.update(ctx.user.id, input);
  });
```

## Testing Utilities

### Database Testing

```typescript
import { createTestDatabase, seedDatabase } from '@/core/testing';

describe('UserService', () => {
  let db: PrismaClient;
  
  beforeEach(async () => {
    db = await createTestDatabase();
    await seedDatabase(db);
  });
  
  afterEach(async () => {
    await db.$disconnect();
  });
  
  it('should find user by email', async () => {
    const service = new UserService(db);
    const user = await service.findByEmail('test@example.com');
    expect(user).toBeDefined();
  });
});
```

### Test Factories

```typescript
import { createTestUser, createTestApartment } from '@/core/testing';

// Create test data
const user = createTestUser({
  email: 'custom@example.com',
});

const apartment = createTestApartment({
  stationId: 'tokyo-station',
  rent: 150000,
});

// Batch creation
const apartments = Array.from({ length: 10 }, (_, i) => 
  createTestApartment({ 
    rent: 100000 + i * 10000 
  })
);
```

### Integration Testing

```typescript
import { createTestContext, createCaller } from '@/core/testing';

describe('API Integration', () => {
  let caller: ReturnType<typeof createCaller>;
  
  beforeEach(() => {
    const ctx = createTestContext({
      user: createTestUser(),
    });
    caller = createCaller(ctx);
  });
  
  it('should search apartments', async () => {
    const result = await caller.apartments.search({
      stationId: 'shibuya',
      maxCommuteTime: 30,
    });
    
    expect(result.apartments).toHaveLength(10);
  });
});
```

## Utilities

### Common Utilities

```typescript
import { 
  sleep, 
  retry, 
  chunk, 
  debounce,
  throttle,
  memoize 
} from '@/core/utils';

// Retry with exponential backoff
const result = await retry(
  async () => fetchData(url),
  { attempts: 3, delay: 1000 }
);

// Chunk array for batch processing
const batches = chunk(items, 50);
for (const batch of batches) {
  await processBatch(batch);
}

// Debounce user input
const debouncedSearch = debounce((query: string) => {
  searchApartments(query);
}, 300);

// Memoize expensive calculations
const getStationDistance = memoize(
  (from: string, to: string) => calculateDistance(from, to)
);
```

## Migration Guide

### From Old Patterns to Core Infrastructure

#### Error Handling

```typescript
// Old pattern
try {
  // ...
} catch (error) {
  console.error(error);
  throw new Error('Something went wrong');
}

// New pattern
import { NotFoundError, handleError } from '@/core/errors';

try {
  // ...
} catch (error) {
  throw new NotFoundError('Resource not found', { 
    resourceId: id,
    originalError: error 
  });
}
```

#### Logging

```typescript
// Old pattern
console.log('User logged in:', userId);

// New pattern
import { getLogger } from '@/core/logging';
const logger = getLogger('auth');
logger.info('User logged in', { userId });
```

#### Validation

```typescript
// Old pattern
if (!input.email || !input.email.includes('@')) {
  throw new Error('Invalid email');
}

// New pattern
import { z } from 'zod';
import { validate } from '@/core/validation';

const schema = z.object({
  email: z.string().email(),
});

const result = validate(schema, input);
if (!result.success) {
  throw new ValidationError('Invalid input', result.error);
}
```

## Best Practices

### 1. Always Use Typed Errors

```typescript
// ❌ Bad
throw new Error('Not found');

// ✅ Good
throw new NotFoundError('User not found', { userId });
```

### 2. Include Context in Logs

```typescript
// ❌ Bad
logger.info('Processing');

// ✅ Good
logger.info('Processing payment', { 
  orderId, 
  amount, 
  currency 
});
```

### 3. Use Branded Types for IDs

```typescript
// ❌ Bad
function getUser(id: string) { }

// ✅ Good
function getUser(id: UserId) { }
```

### 4. Validate at Boundaries

```typescript
// ✅ Good - Validate in API routes
export const createUser = procedure
  .input(userSchema)
  .mutation(async ({ input }) => {
    // input is validated and typed
  });
```

### 5. Use Result Type for Fallible Operations

```typescript
// ✅ Good
function parseConfig(data: string): Result<Config, string> {
  try {
    return ok(JSON.parse(data));
  } catch (error) {
    return err('Invalid configuration');
  }
}
```

### 6. Leverage DI for Testing

```typescript
// ✅ Good
class UserService {
  constructor(
    private db: PrismaClient,
    private emailService: EmailService,
    private logger: Logger
  ) {}
}

// Easy to test with mocks
const service = new UserService(mockDb, mockEmail, mockLogger);
```

---

This core infrastructure provides a solid foundation for building the Tokyo Apartment Finder application. By following these patterns, all agents can write consistent, maintainable, and testable code.