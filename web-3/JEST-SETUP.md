# Jest Testing Configuration

## Overview

Jest has been configured with three different test environments to support all testing needs:

1. **Unit Tests** - For testing individual functions and modules
2. **React Tests** - For testing React components and UI
3. **Integration Tests** - For testing API endpoints and database interactions

## Running Tests

### All Tests
```bash
npm test              # Run default unit tests
npm run test:all      # Run all test suites
```

### Unit Tests
```bash
npm run test:unit     # Run unit tests
```

### React Component Tests
```bash
npm run test:react    # Run React component tests
npm run test:react:watch  # Run in watch mode
npm run test:react:coverage  # Run with coverage
```

### Integration Tests
```bash
npm run test:integration  # Run integration tests
npm run test:integration:watch  # Run in watch mode
npm run test:integration:coverage  # Run with coverage
```

### E2E Tests
```bash
npm run test:e2e  # Currently shows "not configured" message
```

## Configuration Files

- `jest.config.cjs` - Unit test configuration (Node environment)
- `jest.react.config.cjs` - React component test configuration (jsdom environment)
- `jest.integration.config.cjs` - Integration test configuration
- `jest.setup.tsx.cjs` - React test setup (mocks Next.js router, etc.)

## Test File Naming Conventions

- **Unit Tests**: `*.test.ts` or `*.test.tsx` (excluding integration tests)
- **React Tests**: Any test in `src/presentation/`, `src/components/`, or `src/app/`
- **Integration Tests**: `*.integration.test.ts` or tests in `src/infrastructure/testing/integration/`

## Dependencies Installed

- `jest` - Test runner
- `@swc/jest` - Fast TypeScript/JSX transformer
- `@swc/core` - SWC core for transformations
- `ts-jest` - TypeScript Jest transformer (backup option)
- `@testing-library/react` - React testing utilities
- `@testing-library/jest-dom` - DOM matchers
- `@testing-library/user-event` - User interaction simulation
- `@testing-library/dom` - DOM testing utilities
- `identity-obj-proxy` - CSS module mocking
- `jest-environment-jsdom` - Browser-like environment for React tests
- `jest-mock-extended` - Enhanced mocking capabilities
- `msw` - API mocking
- `msw-trpc` - tRPC-specific mocking

## Path Aliases

Both `@/` and `~/` are configured to map to the `src/` directory:

```typescript
import { someFunction } from '@/lib/utils';
import { Component } from '~/components/ui/button';
```

## Known Issues

1. **Integration Tests**: Require a running test database. The global setup/teardown are currently commented out in `jest.integration.config.cjs`.

2. **ES Modules**: The project uses CommonJS configs (`.cjs`) to avoid ESM compatibility issues.

3. **MSW-tRPC**: May show import warnings but doesn't affect test execution.

## Quick Test Examples

### Unit Test
```typescript
// src/lib/utils.test.ts
describe('formatCurrency', () => {
  it('should format yen correctly', () => {
    expect(formatCurrency(1000)).toBe('¥1,000');
  });
});
```

### React Component Test
```typescript
// src/components/button.test.tsx
import { render, screen } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
});
```

### Integration Test
```typescript
// src/api/apartments.integration.test.ts
describe('Apartments API', () => {
  it('should return apartments within commute range', async () => {
    // Test with mocked database
  });
});
```

## Troubleshooting

If you encounter issues:

1. Clear Jest cache: `npx jest --clearCache`
2. Ensure all dependencies are installed: `npm install --legacy-peer-deps`
3. Check that test files match the naming patterns
4. For integration tests, ensure test database is running

## Next Steps for E2E Tests

When ready to add E2E tests, consider:
- Playwright or Cypress for browser automation
- Separate E2E test directory
- Docker compose for test environment
- CI/CD integration