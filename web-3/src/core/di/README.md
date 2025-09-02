# Dependency Injection Container

This module provides a simple but powerful DI container for managing dependencies.

## Purpose

- Manage object lifecycle (singleton, transient, scoped)
- Enable testability through dependency injection
- Reduce coupling between modules
- Support configuration-based wiring

## Components

- **Container**: Main DI container implementation
- **InjectionToken**: Type-safe tokens for registration/resolution
- **Decorators**: Optional decorators for cleaner syntax

## Usage

```typescript
import { Container, InjectionToken } from '@/core/di';

// Define tokens
const TOKENS = {
  ErrorHandler: new InjectionToken<IErrorHandler>('ErrorHandler'),
  ApartmentRepo: new InjectionToken<IApartmentRepository>('ApartmentRepo'),
};

// Register dependencies
container.registerSingleton(TOKENS.ErrorHandler, () => new ErrorHandler());
container.register(TOKENS.ApartmentRepo, (c) => 
  new ApartmentRepository(c.resolve(TOKENS.Database))
);

// Resolve dependencies
const errorHandler = container.resolve(TOKENS.ErrorHandler);
```

## Lifecycle Types

- **Singleton**: Created once, shared across all resolutions
- **Transient**: New instance created for each resolution
- **Scoped**: New instance per scope (e.g., per request)

## Owner: DO (DevOps Agent)