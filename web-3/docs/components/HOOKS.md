# Shared Hooks Documentation

## Overview

The presentation layer includes a collection of reusable hooks that provide common functionality for React components. These hooks follow React best practices and handle edge cases like SSR compatibility.

## Available Hooks

### useDebounce

Delays updating a value until after a specified delay has passed since the last change.

```tsx
import { useDebounce } from '~/presentation/hooks';

function SearchComponent() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  
  useEffect(() => {
    if (debouncedSearchTerm) {
      // Perform search with debouncedSearchTerm
      performSearch(debouncedSearchTerm);
    }
  }, [debouncedSearchTerm]);
  
  return (
    <input
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      placeholder="Type to search..."
    />
  );
}
```

**Use Cases:**
- Search inputs to avoid excessive API calls
- Auto-save functionality
- Resize event handlers
- Scroll position tracking

### useLocalStorage

Synchronizes state with localStorage, providing persistence across sessions and tabs.

```tsx
import { useLocalStorage } from '~/presentation/hooks';

function SettingsComponent() {
  const [theme, setTheme, removeTheme] = useLocalStorage('app-theme', 'light');
  const [filters, setFilters] = useLocalStorage('search-filters', {
    priceMax: 200000,
    sizeMin: 20
  });
  
  const toggleTheme = () => {
    setTheme(current => current === 'light' ? 'dark' : 'light');
  };
  
  const resetSettings = () => {
    removeTheme(); // Removes from localStorage and resets to initial value
  };
  
  return (
    <div>
      <button onClick={toggleTheme}>
        Current theme: {theme}
      </button>
      <button onClick={resetSettings}>
        Reset to defaults
      </button>
    </div>
  );
}
```

**Features:**
- Automatic JSON serialization/deserialization
- Cross-tab synchronization
- SSR-safe (returns initial value during server rendering)
- Error handling for quota exceeded
- TypeScript generics for type safety

**Use Cases:**
- User preferences (theme, language, display options)
- Draft form data
- Recently viewed items
- Temporary shopping cart data

### useMediaQuery

Tracks whether a CSS media query matches, with support for responsive design.

```tsx
import { 
  useMediaQuery, 
  useIsMobile, 
  useIsTablet, 
  useIsDesktop,
  useIsDarkMode 
} from '~/presentation/hooks';

function ResponsiveComponent() {
  // Custom media query
  const isLargeScreen = useMediaQuery('(min-width: 1280px)');
  
  // Pre-configured hooks
  const isMobile = useIsMobile(); // max-width: 639px
  const isTablet = useIsTablet(); // 640px - 1023px
  const isDesktop = useIsDesktop(); // min-width: 1024px
  const prefersDark = useIsDarkMode(); // prefers-color-scheme: dark
  
  return (
    <div>
      {isMobile && <MobileLayout />}
      {isTablet && <TabletLayout />}
      {isDesktop && <DesktopLayout />}
      
      <div className={prefersDark ? 'dark-theme' : 'light-theme'}>
        Content adapts to user preference
      </div>
    </div>
  );
}
```

**Pre-configured Hooks:**
- `useIsMobile()`: Checks if viewport is mobile-sized (≤639px)
- `useIsTablet()`: Checks if viewport is tablet-sized (640px-1023px)
- `useIsDesktop()`: Checks if viewport is desktop-sized (≥1024px)
- `useIsDarkMode()`: Checks user's color scheme preference
- `useIsReducedMotion()`: Checks if user prefers reduced motion

**Use Cases:**
- Responsive layouts without CSS
- Conditional rendering based on screen size
- Adapting to user preferences
- Performance optimizations (load different assets for mobile)

### useIntersectionObserver

Tracks element visibility using the Intersection Observer API, perfect for lazy loading and animations.

```tsx
import { useIntersectionObserver, useLazyLoad } from '~/presentation/hooks';

function LazyImageGallery() {
  // Basic intersection observer
  const { ref, isIntersecting } = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: '100px'
  });
  
  return (
    <div ref={ref}>
      {isIntersecting && <ExpensiveImageGallery />}
    </div>
  );
}

function InfiniteScrollList() {
  const loadMoreRef = useLazyLoad(() => {
    // This function is called when element becomes visible
    loadMoreItems();
  }, {
    threshold: 0.8,
    rootMargin: '50px'
  });
  
  return (
    <div>
      {items.map(item => <ListItem key={item.id} {...item} />)}
      <div ref={loadMoreRef}>Loading more...</div>
    </div>
  );
}

function AnimateOnScroll() {
  const { ref, isIntersecting, entry } = useIntersectionObserver({
    threshold: 0.5,
    freezeOnceVisible: true // Only trigger once
  });
  
  return (
    <div 
      ref={ref}
      className={isIntersecting ? 'animate-fade-in' : 'opacity-0'}
    >
      {entry && `Visible: ${entry.intersectionRatio * 100}%`}
    </div>
  );
}
```

**Options:**
- `threshold`: Percentage of element that must be visible (0-1)
- `root`: Container element for checking visibility
- `rootMargin`: Margin around root (e.g., '100px' to trigger early)
- `freezeOnceVisible`: Stop observing after first visibility
- `initialIsIntersecting`: Initial state before observation

**Use Cases:**
- Lazy loading images or components
- Infinite scroll implementation
- Scroll-triggered animations
- Analytics (tracking what users see)
- Performance optimization

## Integration Examples

### Apartment List with All Hooks

```tsx
import { 
  useDebounce, 
  useLocalStorage, 
  useIsMobile, 
  useIntersectionObserver 
} from '~/presentation/hooks';

function ApartmentList() {
  // Search with debouncing
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  
  // Persist view preferences
  const [viewMode, setViewMode] = useLocalStorage('apartment-view-mode', 'grid');
  const [savedFilters, setSavedFilters] = useLocalStorage('apartment-filters', {});
  
  // Responsive behavior
  const isMobile = useIsMobile();
  const displayMode = isMobile ? 'list' : viewMode;
  
  // Lazy load more apartments
  const { ref: loadMoreRef } = useIntersectionObserver({
    threshold: 0.8,
    rootMargin: '100px',
    freezeOnceVisible: false
  });
  
  const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ['apartments', debouncedSearch, savedFilters],
    // ... query config
  });
  
  useEffect(() => {
    if (loadMoreRef.current && hasNextPage) {
      fetchNextPage();
    }
  }, [loadMoreRef.current]);
  
  return (
    <div>
      <SearchBar value={search} onChange={setSearch} />
      <ViewModeToggle 
        mode={displayMode} 
        onChange={setViewMode}
        disabled={isMobile}
      />
      
      <ApartmentGrid mode={displayMode}>
        {apartments.map(apt => (
          <LazyApartmentCard key={apt.id} apartment={apt} />
        ))}
      </ApartmentGrid>
      
      {hasNextPage && (
        <div ref={loadMoreRef} className="loading-indicator">
          Loading more apartments...
        </div>
      )}
    </div>
  );
}

function LazyApartmentCard({ apartment }) {
  const { ref, isIntersecting } = useIntersectionObserver({
    threshold: 0.1,
    freezeOnceVisible: true,
    rootMargin: '50px'
  });
  
  return (
    <div ref={ref}>
      {isIntersecting ? (
        <ApartmentCard apartment={apartment} />
      ) : (
        <ApartmentCardSkeleton />
      )}
    </div>
  );
}
```

### Search Form with Persistence

```tsx
function SearchForm() {
  const [formData, setFormData] = useLocalStorage('search-form-draft', {
    location: '',
    priceMax: '',
    sizeMin: '',
    features: []
  });
  
  const [location, setLocation] = useState(formData.location);
  const debouncedLocation = useDebounce(location, 500);
  
  // Auto-save form data
  useEffect(() => {
    setFormData(current => ({
      ...current,
      location: debouncedLocation
    }));
  }, [debouncedLocation]);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    // Clear draft after submission
    setFormData({
      location: '',
      priceMax: '',
      sizeMin: '',
      features: []
    });
    // Perform search...
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  );
}
```

## Best Practices

### 1. Debouncing
- Use 300-500ms for search inputs
- Use 1000ms+ for auto-save features
- Consider immediate updates for critical UX

### 2. Local Storage
- Always provide meaningful initial values
- Handle JSON parsing errors gracefully
- Be mindful of storage quotas (usually 5-10MB)
- Clear old data when no longer needed

### 3. Media Queries
- Use pre-configured hooks when possible
- Test on actual devices, not just browser DevTools
- Consider SSR implications (no window object)

### 4. Intersection Observer
- Use appropriate margins for early loading
- Set reasonable thresholds based on use case
- Clean up observers for dynamic content
- Consider fallbacks for older browsers

## Testing

All hooks include comprehensive test suites. When using hooks in components:

```tsx
// Mock useDebounce
jest.mock('~/presentation/hooks', () => ({
  useDebounce: (value) => value, // No delay in tests
}));

// Mock useLocalStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
global.localStorage = mockLocalStorage;

// Mock useMediaQuery
global.matchMedia = jest.fn(() => ({
  matches: false,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));
```

## Performance Considerations

- **useDebounce**: Creates new timeout on each render, minimal overhead
- **useLocalStorage**: Synchronous reads can block, consider async alternatives for large data
- **useMediaQuery**: Listeners are cleaned up automatically
- **useIntersectionObserver**: Native browser API, very efficient

## Migration Guide

### From setTimeout to useDebounce

```tsx
// Before
useEffect(() => {
  const timer = setTimeout(() => {
    performSearch(searchTerm);
  }, 500);
  return () => clearTimeout(timer);
}, [searchTerm]);

// After
const debouncedSearch = useDebounce(searchTerm, 500);
useEffect(() => {
  performSearch(debouncedSearch);
}, [debouncedSearch]);
```

### From manual localStorage to useLocalStorage

```tsx
// Before
const [theme, setTheme] = useState(() => {
  try {
    return localStorage.getItem('theme') || 'light';
  } catch {
    return 'light';
  }
});

useEffect(() => {
  try {
    localStorage.setItem('theme', theme);
  } catch (error) {
    console.error('Failed to save theme', error);
  }
}, [theme]);

// After
const [theme, setTheme] = useLocalStorage('theme', 'light');
```

### From window.matchMedia to useMediaQuery

```tsx
// Before
const [isMobile, setIsMobile] = useState(false);
useEffect(() => {
  const media = window.matchMedia('(max-width: 768px)');
  setIsMobile(media.matches);
  
  const handler = (e) => setIsMobile(e.matches);
  media.addEventListener('change', handler);
  
  return () => media.removeEventListener('change', handler);
}, []);

// After
const isMobile = useMediaQuery('(max-width: 768px)');
```

## Troubleshooting

### useDebounce not working
- Ensure you're using the debounced value, not the original
- Check that the delay is appropriate for your use case

### useLocalStorage SSR issues
- The hook handles SSR automatically
- Initial render always uses the provided default value

### useMediaQuery always returns false
- Check that the media query syntax is valid
- Ensure the component is mounted in the browser

### useIntersectionObserver not triggering
- Verify the element has a height and is in the DOM
- Check rootMargin and threshold settings
- Ensure the ref is properly attached to an element