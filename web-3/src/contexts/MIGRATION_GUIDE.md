# State Management Migration Guide

This guide explains how to migrate components from prop-based state management to context-based state management.

## Overview

We've introduced three main contexts to eliminate prop drilling and centralize state management:

1. **SearchContext** - Manages search filters and commute search state
2. **UserPreferencesContext** - Manages user preferences like view mode, sort order, and list toggles
3. **ListManagementContext** - Manages apartment list actions (like, bookmark, view, etc.)

## Migration Steps

### 1. Update Component Imports

Replace individual imports with context imports:

```tsx
// Before
import { ApartmentFilters } from '~/components/apartment-filters';
import { ApartmentList } from '~/components/apartment-list';

// After
import { ApartmentFiltersWithContext } from '~/components/apartment-filters-with-context';
import { ApartmentListWithContext } from '~/components/apartment-list-with-context';
```

### 2. Remove State Management Props

#### ApartmentFilters Migration

Before:
```tsx
<ApartmentFilters
  initialFilters={filters}
  onFiltersChange={handleFiltersChange}
  onSearchButtonClick={handleSearch}
  showApplyButton={true}
/>
```

After:
```tsx
<ApartmentFiltersWithContext
  onSearchButtonClick={handleSearch}
  showApplyButton={true}
/>
```

The component now uses `useSearch()` internally to manage filters.

#### ApartmentList Migration

Before:
```tsx
<ApartmentList
  apartments={apartments}
  onViewApartment={handleView}
  onLikeApartment={handleLike}
  onBookmarkApartment={handleBookmark}
  onRemoveFromList={handleRemove}
  variant="grid"
/>
```

After:
```tsx
<ApartmentListWithContext
  apartments={apartments}
  variant="grid"
  listId={currentListId} // Optional, for remove action
/>
```

The component now uses `useListManagement()` for all actions.

### 3. Use Hooks in Parent Components

Replace local state with context hooks:

```tsx
// Before
const [filters, setFilters] = useState<ApartmentSearchFilters>({});
const [sortBy, setSortBy] = useState('addedAt');
const [viewMode, setViewMode] = useState('list');

// After
import { useSearch, useUserPreferences } from '~/contexts';

const { filters, updateFilters } = useSearch();
const { sortBy, setSortBy, viewMode, setViewMode } = useUserPreferences();
```

### 4. Update Search Pages

Example migration for search page:

```tsx
// Before
export default function SearchPage() {
  const [filters, setFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  
  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
  };
  
  const handleSearch = (searchType, data) => {
    // Complex search logic
  };
  
  return (
    <ApartmentFilters
      initialFilters={filters}
      onFiltersChange={handleFiltersChange}
      onSearchButtonClick={handleSearch}
    />
  );
}

// After
export default function SearchPage() {
  const { filters, searchMode } = useSearch();
  const { apartments, isLoading, refreshApartments } = useApartmentSearch();
  const [showFilters, setShowFilters] = useState(false);
  
  const handleSearch = (searchType) => {
    // Simplified - filters are already in context
    refreshApartments();
  };
  
  return (
    <ApartmentFiltersWithContext
      onSearchButtonClick={handleSearch}
    />
  );
}
```

### 5. Update List Pages

Example migration for list detail page:

```tsx
// Before
export default function ListDetailPage() {
  const [showLiked, setShowLiked] = useState(true);
  const [showBookmarked, setShowBookmarked] = useState(true);
  const [sortField, setSortField] = useState('addedAt');
  
  const handleApartmentAction = (action, apartment) => {
    // Handle various actions
  };
  
  return (
    <ApartmentList
      apartments={apartments}
      onViewApartment={(apt) => handleApartmentAction('view', apt)}
      onLikeApartment={(apt) => handleApartmentAction('like', apt)}
    />
  );
}

// After
export default function ListDetailPage() {
  const { showLiked, showBookmarked } = useUserPreferences();
  const { onViewApartment, onLikeApartment } = useListActions(listId);
  
  return (
    <ApartmentListWithContext
      apartments={apartments}
      listId={listId}
    />
  );
}
```

## Custom Hooks

Use the provided custom hooks for common patterns:

### useApartmentSearch

Combines search context with API calls:

```tsx
const {
  apartments,
  total,
  isLoading,
  refreshApartments,
  startCommuteSearch,
} = useApartmentSearch();
```

### useListActions

Provides all list management actions:

```tsx
const {
  onViewApartment,
  onLikeApartment,
  onBookmarkApartment,
  createList,
  deleteList,
  bulkAddToList,
} = useListActions(listId);
```

## Benefits

1. **No Prop Drilling** - State is accessible anywhere in the component tree
2. **Centralized Logic** - All state mutations happen in one place
3. **Persistent Preferences** - User preferences are automatically saved to localStorage
4. **Type Safety** - Full TypeScript support with proper types
5. **Better Performance** - Reduced re-renders with proper context splitting

## Testing

Update your tests to wrap components with providers:

```tsx
import { SearchProvider, UserPreferencesProvider } from '~/contexts';

const AllTheProviders = ({ children }) => {
  return (
    <SearchProvider>
      <UserPreferencesProvider>
        {children}
      </UserPreferencesProvider>
    </SearchProvider>
  );
};

const customRender = (ui, options) =>
  render(ui, { wrapper: AllTheProviders, ...options });
```

## Gradual Migration

You don't need to migrate everything at once. Both the old prop-based components and new context-based components can coexist during migration:

1. Start with leaf components (ApartmentCard, FilterSidebar)
2. Move up to container components (ApartmentList, ApartmentFilters)
3. Finally update page components

## Common Pitfalls

1. **Don't forget providers** - Make sure all components are wrapped in the necessary providers
2. **Check for undefined** - Some values might be undefined before initialization
3. **Update imports** - Use the new component names with "WithContext" suffix
4. **Test thoroughly** - Ensure all actions still work after migration