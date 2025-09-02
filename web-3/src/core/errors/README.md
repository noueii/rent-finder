# Core Errors Module

This module provides centralized error handling for the entire application.

## Purpose

- Standardize error responses across the application
- Distinguish between operational and programming errors
- Provide consistent error logging with context
- Handle errors appropriately based on environment (dev vs prod)

## Components

- **ErrorHandler**: Main error handling service
- **BaseError**: Base class for all custom errors
- **Operational Errors**: Expected errors (validation, not found, etc.)
- **Error Context**: Additional information for debugging

## Usage

```typescript
import { ErrorHandler, BaseError } from '@/core/errors';

// In your service
throw new BaseError('USER_NOT_FOUND', 404, true, 'User not found');

// In your API handler
const errorHandler = container.resolve(ErrorHandler);
const response = errorHandler.handle(error, { userId, operation: 'getUser' });
```

## Owner: DO (DevOps Agent)