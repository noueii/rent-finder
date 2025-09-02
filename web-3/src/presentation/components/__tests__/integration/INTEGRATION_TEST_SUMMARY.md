# Integration Test Summary

## Overview
This directory contains comprehensive integration tests for the Tokyo Apartment Finder UI components, ensuring all refactored components work together seamlessly.

## Test Coverage

### 1. Search Page Integration (`SearchPageIntegration.test.tsx`)
Tests the complete search experience including:
- ✅ Component rendering and layout
- ✅ Filter application and state updates
- ✅ View mode switching (list/map)
- ✅ Apartment selection in map view
- ✅ Sorting functionality
- ✅ Refresh mechanism
- ✅ Loading and error states
- ✅ Pagination
- ✅ Mobile filter drawer
- ✅ Context integration
- ✅ Toast notifications

**Key Integration Points:**
- SearchForm + Filters + Results + Map
- State management via hooks
- TRPC API calls
- Responsive behavior

### 2. Apartment Card Integration (`ApartmentCardIntegration.test.tsx`)
Tests the apartment card ecosystem:
- ✅ All sub-components rendering together
- ✅ Image gallery interaction
- ✅ Action handlers (view/like/bookmark)
- ✅ List management context integration
- ✅ Loading states during mutations
- ✅ Score display variations
- ✅ Price display edge cases
- ✅ Responsive layouts
- ✅ Error handling
- ✅ State persistence
- ✅ Missing data handling

**Key Integration Points:**
- Card + Actions + Score + Price + Images
- ListManagementContext integration
- TRPC mutations
- Navigation handling

### 3. Form Integration (`FormIntegration.test.tsx`)
Tests complex form scenarios:
- ✅ All form field types working together
- ✅ Complex validation rules
- ✅ Nested field validation
- ✅ Form state persistence
- ✅ Real-time validation
- ✅ Form reset functionality
- ✅ Conditional fields
- ✅ Submission states
- ✅ Async validation
- ✅ Error message display

**Key Integration Points:**
- Form + Fields + Validation
- Zod schema integration
- React Hook Form integration
- Custom validation logic

### 4. State Management Integration (`StateManagementIntegration.test.tsx`)
Tests all contexts working together:
- ✅ Three contexts without conflicts
- ✅ Search mode transitions
- ✅ LocalStorage persistence
- ✅ Complex filtering scenarios
- ✅ Station management
- ✅ Filter/station synchronization
- ✅ Preference resets
- ✅ Error handling
- ✅ Rapid state updates

**Key Integration Points:**
- SearchContext + ListManagementContext + UserPreferencesContext
- LocalStorage synchronization
- Cross-context state updates
- Error boundaries

## Running Integration Tests

```bash
# Run all integration tests
npm test -- src/presentation/components/__tests__/integration/

# Run specific test suite
npm test -- SearchPageIntegration.test.tsx

# Run with coverage
npm test -- --coverage src/presentation/components/__tests__/integration/

# Watch mode for development
npm test -- --watch src/presentation/components/__tests__/integration/
```

## Test Utilities
The `test-utils.tsx` file provides:
- Custom render function with all providers
- Mock data factories
- Common test helpers
- Properly mocked dependencies

## Key Testing Patterns

### 1. Provider Wrapping
All tests use the custom render function that wraps components with necessary providers:
```typescript
render(<Component />, {
  initialSearchFilters: {...},
  session: mockSession,
});
```

### 2. User Interactions
Using Testing Library's user-event for realistic interactions:
```typescript
const user = userEvent.setup();
await user.click(button);
await user.type(input, 'text');
```

### 3. Async Operations
Proper handling of async state updates:
```typescript
await waitFor(() => {
  expect(element).toBeInTheDocument();
});
```

### 4. Mock Management
Consistent mocking pattern for external dependencies:
```typescript
jest.mock('~/trpc/react', () => ({
  api: {
    apartment: {
      search: {
        useQuery: jest.fn(),
      },
    },
  },
}));
```

## Coverage Goals
- ✅ All major user flows tested
- ✅ Component interactions verified
- ✅ State management integration confirmed
- ✅ Error scenarios handled
- ✅ Loading states tested
- ✅ Responsive behavior verified

## Maintenance Notes
1. Update tests when adding new features
2. Keep mock data factories up to date
3. Test both happy paths and error cases
4. Ensure tests remain isolated and fast
5. Document any complex test scenarios

## Future Improvements
- [ ] Add visual regression tests
- [ ] Performance benchmarks
- [ ] Accessibility integration tests
- [ ] E2E tests for critical paths
- [ ] Snapshot tests for component structure