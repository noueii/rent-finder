# Logging Module

The logging module provides a structured, context-aware logging system with support for multiple transports, correlation IDs, and integration with Express/tRPC.

## Features

- **Structured Logging**: Log with context and metadata
- **Multiple Log Levels**: DEBUG, INFO, WARN, ERROR, FATAL
- **Correlation IDs**: Track requests across services
- **Multiple Transports**: Console, file, remote services
- **Request Context**: Automatic request/user context
- **Performance Monitoring**: Track slow requests
- **Type Safety**: Full TypeScript support

## Quick Start

```typescript
import { getLogger } from '@/core/logging';

const logger = getLogger('my-module');

logger.info('Starting process');
logger.debug('Debug information', { details: 'value' });
logger.error('Process failed', error);
```

## Log Levels

| Level | Value | Description | Use Case |
|-------|-------|-------------|----------|
| DEBUG | 0 | Detailed debugging info | Development only |
| INFO | 1 | General information | Normal operation |
| WARN | 2 | Warning conditions | Potential issues |
| ERROR | 3 | Error conditions | Recoverable errors |
| FATAL | 4 | Fatal conditions | System failures |

## Configuration

### Global Configuration

```typescript
import { configureGlobalLogger, LogLevel } from '@/core/logging';

configureGlobalLogger({
  level: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
  transports: [consoleTransport, fileTransport],
  formatters: [jsonFormatter],
  enableCorrelationId: true,
});
```

### Environment Variables

```bash
LOG_LEVEL=info  # debug, info, warn, error, fatal
```

## Context and Child Loggers

```typescript
// Create logger with context
const logger = getLogger('user-service');

// Create child logger with additional context
const userLogger = logger.child({ 
  userId: user.id,
  action: 'updateProfile' 
});

userLogger.info('Updating user profile');
// Logs: [INFO] [user-service] {userId: 123, action: 'updateProfile'} Updating user profile
```

## Correlation IDs

```typescript
// Set correlation ID for request tracking
logger.setCorrelationId(request.headers['x-correlation-id'] || uuidv4());

// All subsequent logs include the correlation ID
logger.info('Processing request');
logger.debug('Fetching user data');
```

## Middleware Integration

### Express/Next.js

```typescript
import { createRequestLoggingMiddleware } from '@/core/logging';

// Add to Express app
app.use(createRequestLoggingMiddleware());

// Access logger in routes
app.get('/api/users', (req, res) => {
  req.logger.info('Fetching users');
  // Logger includes request ID and user context
});
```

### tRPC

```typescript
import { createTRPCLoggingMiddleware } from '@/core/logging';

const loggedProcedure = t.procedure.use(createTRPCLoggingMiddleware());

export const userRouter = t.router({
  getUser: loggedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      ctx.logger.info('Fetching user', { userId: input.id });
      return userService.findById(input.id);
    }),
});
```

## Transports

### Console Transport (Default)

```typescript
import { consoleTransport, coloredConsoleTransport } from '@/core/logging';

// Basic console output
configureGlobalLogger({
  transports: [consoleTransport],
});

// Colored console output (development)
configureGlobalLogger({
  transports: [coloredConsoleTransport],
});
```

### File Transport

```typescript
import { createFileTransport } from '@/core/logging';

configureGlobalLogger({
  transports: [
    consoleTransport,
    createFileTransport('./logs/app.log'),
  ],
});
```

### Remote Transport

```typescript
import { createRemoteTransport } from '@/core/logging';

const remoteTransport = createRemoteTransport(
  'https://logs.example.com/api/logs',
  process.env.LOG_API_KEY
);

configureGlobalLogger({
  transports: [consoleTransport, remoteTransport],
});
```

### Filtered Transport

```typescript
import { createFilteredTransport, LogLevel } from '@/core/logging';

// Only send errors to remote service
const errorOnlyRemote = createFilteredTransport(
  LogLevel.ERROR,
  remoteTransport
);

configureGlobalLogger({
  transports: [consoleTransport, errorOnlyRemote],
});
```

## Formatters

### JSON Formatter

```typescript
import { jsonFormatter } from '@/core/logging';

// Outputs logs as JSON (good for production)
configureGlobalLogger({
  formatters: [jsonFormatter],
});
```

### Development Formatter

```typescript
import { devFormatter } from '@/core/logging';

// Human-readable format for development
configureGlobalLogger({
  formatters: [devFormatter],
});
```

### Custom Formatter

```typescript
const customFormatter: LogFormatter = (entry) => {
  return {
    ...entry,
    message: `[${entry.context?.service}] ${entry.message}`,
  };
};

configureGlobalLogger({
  formatters: [customFormatter],
});
```

## Error Logging

```typescript
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', error, {
    operation: 'riskyOperation',
    attemptCount: 3,
  });
}

// For fatal errors
process.on('uncaughtException', (error) => {
  logger.fatal('Uncaught exception', error);
  process.exit(1);
});
```

## Performance Monitoring

```typescript
import { createPerformanceLoggingMiddleware } from '@/core/logging';

// Log requests slower than 1 second
app.use(createPerformanceLoggingMiddleware(logger, 1000));
```

## Testing

```typescript
import { createLogger } from '@/core/logging';

describe('MyService', () => {
  let logger: Logger;
  let logSpy: jest.SpyInstance;
  
  beforeEach(() => {
    logger = createLogger('test', {
      transports: [(entry) => logSpy(entry)],
    });
    logSpy = jest.fn();
  });
  
  it('should log user actions', () => {
    const service = new MyService(logger);
    service.performAction();
    
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        level: LogLevel.INFO,
        message: 'Action performed',
      })
    );
  });
});
```

## Best Practices

1. **Use Appropriate Log Levels**
   ```typescript
   logger.debug('Detailed trace info');      // Development only
   logger.info('User logged in');            // Important events
   logger.warn('API rate limit close');      // Potential issues
   logger.error('Payment failed', error);    // Errors needing attention
   logger.fatal('Database connection lost'); // Critical failures
   ```

2. **Include Relevant Context**
   ```typescript
   // ❌ Bad
   logger.info('Processing');
   
   // ✅ Good
   logger.info('Processing payment', {
     orderId: order.id,
     amount: order.amount,
     currency: order.currency,
     userId: user.id,
   });
   ```

3. **Use Child Loggers for Modules**
   ```typescript
   // In services
   class UserService {
     private logger = getLogger('UserService');
     
     async createUser(data: CreateUserInput) {
       this.logger.info('Creating user', { email: data.email });
       // ...
     }
   }
   ```

4. **Avoid Logging Sensitive Data**
   ```typescript
   // ❌ Bad
   logger.info('User login', { password: user.password });
   
   // ✅ Good
   logger.info('User login', { 
     email: user.email,
     method: 'password',
   });
   ```

5. **Use Correlation IDs**
   ```typescript
   // In middleware
   app.use((req, res, next) => {
     const correlationId = req.headers['x-correlation-id'] || uuidv4();
     req.logger = logger.child({ correlationId });
     next();
   });
   ```

## Troubleshooting

### Logs Not Appearing

1. Check log level configuration
2. Verify transport is properly configured
3. Check if logs are being filtered

### Performance Impact

1. Use appropriate log levels in production
2. Consider batching for remote transports
3. Avoid logging in tight loops

### Memory Leaks

1. Ensure transports properly handle errors
2. Clear logger cache in tests
3. Avoid storing large objects in context