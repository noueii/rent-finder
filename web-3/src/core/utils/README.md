# Core Utilities

This module provides common utility functions used across the application.

## Purpose

- Provide reusable utility functions
- Centralize common operations
- Ensure consistent behavior across the app
- Reduce code duplication

## Categories

### Async Utilities (`async.ts`)

Utilities for handling asynchronous operations and control flow.

```typescript
import { sleep, retry, debounce, throttle, concurrent } from '@/core/utils';

// Sleep for a duration
await sleep(1000); // Sleep for 1 second

// Retry with exponential backoff
const result = await retry(
  async () => fetchData(url),
  { 
    attempts: 3, 
    delay: 1000,
    backoff: 'exponential',
    onRetry: (error, attempt) => console.log(`Retry ${attempt}: ${error.message}`)
  }
);

// Debounce user input
const debouncedSearch = debounce((query: string) => {
  searchApartments(query);
}, 300);

// Process items with concurrency limit
const results = await concurrent(
  items,
  async (item) => processItem(item),
  5 // Process max 5 items at once
);
```

### Array Utilities (`array.ts`)

Functions for manipulating and transforming arrays.

```typescript
import { chunk, unique, groupBy, sortBy, partition } from '@/core/utils';

// Chunk array for batch processing
const batches = chunk(items, 50);

// Get unique values
const uniqueIds = unique(ids);
const uniqueUsers = uniqueBy(users, user => user.email);

// Group items
const usersByRole = groupBy(users, user => user.role);

// Sort by multiple criteria
const sorted = sortBy(
  apartments,
  apt => apt.stationDistance,
  apt => apt.rent
);

// Partition array
const [active, inactive] = partition(users, user => user.isActive);
```

### String Utilities (`string.ts`)

Functions for string manipulation and validation.

```typescript
import { slugify, capitalize, truncate, isEmail, template } from '@/core/utils';

// Format strings
const slug = slugify('Tokyo Apartment Finder'); // "tokyo-apartment-finder"
const title = titleCase('hello world'); // "Hello World"
const short = truncate('Long text...', 20); // "Long text..."

// Validate strings
if (isEmail(input)) {
  // Valid email
}

// Template interpolation
const message = template('Hello {{name}}, welcome to {{site}}!', {
  name: 'User',
  site: 'Tokyo Apartments'
});
```

### Object Utilities (`object.ts`)

Functions for working with objects and deep operations.

```typescript
import { deepClone, deepMerge, pick, omit, get, set } from '@/core/utils';

// Deep operations
const cloned = deepClone(complexObject);
const merged = deepMerge(defaults, userConfig);

// Property manipulation
const subset = pick(user, ['id', 'name', 'email']);
const filtered = omit(data, ['password', 'token']);

// Nested property access
const city = get(user, 'address.city', 'Unknown');
set(config, 'api.timeout', 5000);

// Memoization
const expensiveCalc = memoize((x: number) => {
  console.log('Calculating...');
  return x * x;
});
```

### Date Utilities (`date.ts`)

Functions for date manipulation and formatting.

```typescript
import { addDays, relativeTime, formatDuration, startOfDay } from '@/core/utils';

// Date manipulation
const tomorrow = addDays(new Date(), 1);
const startOfToday = startOfDay(new Date());

// Formatting
const relative = relativeTime(date); // "2 hours ago"
const duration = formatDuration(5400000); // "1h 30m"

// Date calculations
const days = daysBetween(startDate, endDate);
const age = getAge(birthDate);
```

## Usage Examples

### Batch Processing

```typescript
import { chunk, concurrent, sleep } from '@/core/utils';

async function batchProcessApartments(apartmentIds: string[]) {
  const batches = chunk(apartmentIds, 100);
  
  for (const batch of batches) {
    await concurrent(
      batch,
      async (id) => {
        await updateApartment(id);
      },
      10 // Process 10 at a time
    );
    
    // Rate limiting
    await sleep(1000);
  }
}
```

### Form Handling

```typescript
import { debounce, isEmail, normalizeWhitespace } from '@/core/utils';

const validateEmail = debounce((email: string) => {
  const normalized = normalizeWhitespace(email);
  
  if (!isEmail(normalized)) {
    setError('Invalid email address');
  } else {
    setError(null);
  }
}, 300);
```

### API Response Processing

```typescript
import { groupBy, mapValues, pick } from '@/core/utils';

function processApartmentResponse(apartments: Apartment[]) {
  // Group by station
  const byStation = groupBy(apartments, apt => apt.stationId);
  
  // Calculate stats per station
  const stationStats = mapValues(byStation, (apts) => ({
    count: apts.length,
    avgRent: sum(apts.map(a => a.rent)) / apts.length,
    minRent: Math.min(...apts.map(a => a.rent)),
    maxRent: Math.max(...apts.map(a => a.rent)),
  }));
  
  // Return simplified data
  return apartments.map(apt => 
    pick(apt, ['id', 'title', 'rent', 'stationId'])
  );
}
```

### Error Handling with Retry

```typescript
import { retry, timeout } from '@/core/utils';

async function fetchWithRetry(url: string) {
  return retry(
    async () => {
      const response = await timeout(
        fetch(url),
        5000, // 5 second timeout
        new Error('Request timeout')
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return response.json();
    },
    {
      attempts: 3,
      delay: 1000,
      backoff: 'exponential',
      onRetry: (error, attempt) => {
        console.log(`Attempt ${attempt} failed: ${error.message}`);
      },
    }
  );
}
```

## Guidelines

- All functions should be pure (no side effects)
- Functions should be well-tested
- Avoid domain-specific logic
- Keep functions small and focused
- Use TypeScript generics for flexibility
- Provide sensible defaults
- Document edge cases

## Performance Considerations

- `memoize` caches results - be careful with memory usage
- `deepClone` and `deepMerge` can be expensive for large objects
- `debounce` and `throttle` create closures - clean up when needed
- Async utilities handle errors gracefully

## Testing

All utilities have comprehensive test coverage. See test files for usage examples and edge cases.

## Owner: DO (DevOps Agent)