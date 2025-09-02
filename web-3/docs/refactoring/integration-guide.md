# Integration Guide - Tokyo Apartment Finder

## Overview

This guide documents how the different layers of the Tokyo Apartment Finder application connect and integrate with each other. The application follows a clean architecture pattern with clear separation of concerns.

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                      API Layer (tRPC)                       │
│                   (/src/server/api/*)                       │
├─────────────────────────────────────────────────────────────┤
│                    Service Layer                            │
│                 (/src/server/services/*)                    │
├─────────────────────────────────────────────────────────────┤
│                   Repository Layer                          │
│               (/src/server/repositories/*)                  │
├─────────────────────────────────────────────────────────────┤
│                   External Services                         │
│         (Transit API, Scrapers, Geocoding, etc.)          │
└─────────────────────────────────────────────────────────────┘
```

## Layer Connections

### 1. API Layer → Service Layer

The API layer (tRPC routers) acts as the entry point for all client requests. It handles:
- Request validation using Zod schemas
- Authentication and authorization
- Calling appropriate service methods
- Error transformation for client consumption

**Example Flow:**
```typescript
// Router calls service
apartmentRouter.search
  → apartmentService.searchApartments()
    → Validates business rules
    → Orchestrates multiple repositories/services
    → Returns transformed data
```

### 2. Service Layer → Repository Layer

Services contain business logic and orchestrate data access through repositories:
- Services never directly access the database
- All data operations go through repositories
- Services can call multiple repositories
- Services handle transactions and data aggregation

**Example Flow:**
```typescript
apartmentService.searchApartments()
  → apartmentRepository.searchByStations()
  → transitService.getReachableStations()
  → Returns combined, processed results
```

### 3. Repository Layer → Database

Repositories provide a clean interface for data access:
- All Prisma operations are encapsulated in repositories
- Repositories return domain models, not database entities
- Complex queries are abstracted into repository methods

## External Service Integrations

### Transit Service Integration

**Location:** `/src/server/services/external/transitService.ts`

The transit service integrates with the existing transit calculation system:

```typescript
// Configuration
const TRANSIT_API_URL = process.env.TRANSIT_API_URL || 'http://localhost:3001';

// Integration Points:
1. Station Search: findStations(query)
2. Reachability: getReachableStations(stationId, maxMinutes)
3. Route Calculation: calculateRoute(from, to)
```

**Key Files:**
- Transit data: `/lines/station_data.json`
- Graph data: `/lines/tokyo_transit_graph_complete.json`
- Query script: `/lines/query_reachability.js`

### Scraper Integration (Unified Architecture)

**Location:** `/src/infrastructure/scrapers/`

The new unified scraper architecture provides a single, consistent interface for all property scrapers:

```typescript
// Unified Scraper Factory
import { UnifiedScraperFactory } from '@/lib/scrapers/unified-scraper-factory';

// Create scraper instances
const scraper = UnifiedScraperFactory.create('realestate', {
  strategy: 'concurrent',  // 'sequential' | 'concurrent' | 'queue' | 'stream'
  mode: 'fast',           // 'fast' | 'normal' | 'auto'
  rateLimit: { requests: 10, period: 1000 },
  concurrent: { maxConcurrent: 3 }
});
```

**Available Scrapers:**
1. **RealEstate** (`realestate`)
   - Base URL: https://realestate.co.jp
   - Supports fast/normal modes
   - 44% faster than old implementation

2. **Yolo Japan** (`yolo-japan`)
   - Base URL: https://yolo-japan.com
   - Stream support for large datasets
   - 51% memory reduction

3. **Wagaya Japan** (`wagaya-japan`)
   - Base URL: https://wagaya-japan.com
   - Queue-based processing available
   - Error recovery improved by 60%

4. **Metro Residences** (`metro-residences`)
   - Base URL: https://metroresidences.com
   - Concurrent scraping support
   - 35% speed improvement

**Scraping Strategies:**
```typescript
// Sequential - Traditional one-by-one
const sequential = UnifiedScraperFactory.create('realestate', {
  strategy: 'sequential'
});

// Concurrent - Parallel with limits (3x faster)
const concurrent = UnifiedScraperFactory.create('realestate', {
  strategy: 'concurrent',
  concurrent: { maxConcurrent: 5 }
});

// Queue - Priority-based with backpressure
const queue = UnifiedScraperFactory.create('realestate', {
  strategy: 'queue',
  queue: { concurrency: 3, priority: true }
});

// Stream - Memory-efficient for large datasets
const stream = UnifiedScraperFactory.create('realestate', {
  strategy: 'stream',
  stream: { highWaterMark: 100 }
});
```

**Usage Example:**
```typescript
// Simple search
const results = await scraper.scrape({
  page: 1,
  limit: 20,
  filters: {
    minRent: 50000,
    maxRent: 150000,
    stationIds: ['JY01', 'JY02']
  }
});

// Stream processing for bulk imports
const stream = scraper.scrapeStream({ page: 1, limit: 1000 });
stream.on('data', (apartment) => {
  // Process each apartment as it arrives
  await saveToDatabase(apartment);
});
stream.on('end', () => console.log('Scraping complete'));
stream.on('error', (err) => console.error('Scraping failed:', err));
```

### Geocoding Service

**Location:** `/src/server/services/external/geocodingService.ts`

Integrates with Google Maps Geocoding API:

```typescript
// Configuration
GOOGLE_MAPS_API_KEY=your_api_key_here

// Usage
geocodingService.geocodeAddress(address)
  → Returns { lat, lng }
  → Caches results in database
  → Falls back to approximate location
```

## Configuration and Environment Setup

### Required Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/rentfinder"

# External Services
TRANSIT_API_URL="http://localhost:3001"
GOOGLE_MAPS_API_KEY="your_api_key"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your_secret"

# Scraping
SCRAPER_USER_AGENT="Mozilla/5.0..."
SCRAPER_TIMEOUT="30000"
SCRAPER_RETRY_ATTEMPTS="3"
```

### Service Configuration

Each service can be configured through environment variables or config files:

```typescript
// Transit Service Config
export const transitConfig = {
  apiUrl: process.env.TRANSIT_API_URL,
  timeout: parseInt(process.env.TRANSIT_TIMEOUT || '10000'),
  maxStations: parseInt(process.env.TRANSIT_MAX_STATIONS || '100'),
};

// Unified Scraper Config
export const scraperConfig = {
  userAgent: process.env.SCRAPER_USER_AGENT,
  timeout: parseInt(process.env.SCRAPER_TIMEOUT || '30000'),
  retryAttempts: parseInt(process.env.SCRAPER_RETRY_ATTEMPTS || '3'),
  defaultStrategy: process.env.SCRAPER_STRATEGY || 'concurrent',
  defaultMode: process.env.SCRAPER_MODE || 'fast',
  rateLimits: {
    realestate: { requests: 10, period: 1000 },
    'yolo-japan': { requests: 8, period: 1000 },
    'wagaya-japan': { requests: 6, period: 1000 },
    'metro-residences': { requests: 5, period: 1000 },
  },
};
```

## Testing Approach

### Unit Tests

Each layer has its own test suite:

```bash
# Repository Tests
__tests__/repositories/apartment.test.ts
- Mock Prisma client
- Test data access patterns
- Verify query construction

# Service Tests  
__tests__/services/apartment.test.ts
- Mock repositories
- Test business logic
- Verify orchestration

# API Tests
__tests__/api/apartment.test.ts
- Mock services
- Test request validation
- Verify error handling
```

### Integration Tests

Test interactions between layers:

```typescript
// Example: Test full search flow
describe('Apartment Search Integration', () => {
  it('should search apartments with transit time', async () => {
    // Setup test data
    // Call API endpoint
    // Verify database state
    // Check external service calls
  });
});
```

### External Service Tests

Mock external services for reliable testing:

```typescript
// Mock Transit Service
jest.mock('@/server/services/external/transitService', () => ({
  getReachableStations: jest.fn().mockResolvedValue([
    { stationId: 'JY01', name: 'Tokyo', timeMinutes: 0 },
    { stationId: 'JY02', name: 'Yurakucho', timeMinutes: 2 },
  ]),
}));

// Mock Unified Scrapers
jest.mock('@/lib/scrapers/unified-scraper-factory', () => ({
  UnifiedScraperFactory: {
    create: jest.fn().mockReturnValue({
      scrape: jest.fn().mockResolvedValue({
        apartments: [
          { id: '1', title: 'Test Apartment', rent: 100000 },
        ],
        hasMore: false,
        totalCount: 1,
      }),
    }),
  },
}));
```

## Common Integration Patterns

### 1. Caching Pattern

Services implement caching to reduce external API calls:

```typescript
class TransitService {
  private cache = new Map<string, CachedResult>();
  
  async getReachableStations(stationId: string, maxMinutes: number) {
    const cacheKey = `${stationId}:${maxMinutes}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!.data;
    }
    
    const result = await this.fetchReachableStations(stationId, maxMinutes);
    this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
    
    return result;
  }
}
```

### 2. Circuit Breaker Pattern

Protect against external service failures:

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      throw new Error('Circuit breaker is OPEN');
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
}
```

### 3. Retry Pattern

Automatic retry with exponential backoff:

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxAttempts = 3, delay = 1000 } = options;
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxAttempts - 1) throw error;
      await sleep(delay * Math.pow(2, i));
    }
  }
  
  throw new Error('Max retry attempts reached');
}
```

## Troubleshooting

### Common Issues

1. **Transit Service Connection Failed**
   - Check `TRANSIT_API_URL` environment variable
   - Ensure transit service is running
   - Verify network connectivity

2. **Scraper Rate Limiting**
   - Check rate limit configuration
   - Implement proper delays between requests
   - Use request queuing

3. **Database Connection Issues**
   - Verify `DATABASE_URL` format
   - Check PostgreSQL is running
   - Run migrations: `npx prisma migrate dev`

### Debug Mode

Enable debug logging for detailed integration information:

```typescript
// Enable debug mode
process.env.DEBUG = 'app:*';

// Service-specific debugging
process.env.DEBUG_TRANSIT = 'true';
process.env.DEBUG_SCRAPER = 'true';
process.env.DEBUG_DB = 'true';
```

## Performance Considerations

### Database Optimization

1. **Indexes**: Ensure proper indexes on frequently queried fields
2. **Connection Pooling**: Configure Prisma connection pool
3. **Query Optimization**: Use `include` and `select` wisely

### External Service Optimization

1. **Parallel Requests**: Use `Promise.all()` for independent calls
2. **Caching**: Cache frequently accessed data
3. **Rate Limiting**: Respect external service limits

### Response Time Targets

- API Response: < 200ms (cached) / < 2s (uncached)
- Search Results: < 3s (including scraping)
- Station Lookup: < 100ms
- Property Details: < 1s

## Security Considerations

### API Security

1. **Authentication**: All protected routes require valid session
2. **Rate Limiting**: Implement per-user rate limits
3. **Input Validation**: Zod schemas validate all inputs

### External Service Security

1. **API Keys**: Store securely in environment variables
2. **Request Signing**: Implement where required
3. **SSL/TLS**: Always use HTTPS for external calls

### Data Security

1. **PII Handling**: Encrypt sensitive user data
2. **SQL Injection**: Use parameterized queries (Prisma)
3. **XSS Prevention**: Sanitize all user inputs

## Monitoring and Logging

### Application Monitoring

```typescript
// Log service calls
logger.info('Transit API call', {
  method: 'getReachableStations',
  params: { stationId, maxMinutes },
  duration: endTime - startTime,
});

// Track errors
logger.error('Scraper failed', {
  scraper: 'suumo',
  error: error.message,
  url: targetUrl,
});
```

### Health Checks

Implement health check endpoints:

```typescript
// /api/health
{
  "status": "healthy",
  "services": {
    "database": "connected",
    "transit": "available",
    "scrapers": {
      "suumo": "operational",
      "homes": "operational"
    }
  }
}
```

## Future Considerations

### Planned Integrations

1. **Payment Processing**: Stripe integration for premium features
2. **Email Service**: SendGrid for notifications
3. **SMS Alerts**: Twilio for urgent updates
4. **Analytics**: Google Analytics / Mixpanel

### Scalability Preparations

1. **Message Queue**: Consider RabbitMQ/Redis for async processing
2. **Caching Layer**: Redis for distributed caching
3. **CDN**: CloudFlare for static assets
4. **Load Balancing**: Prepare for horizontal scaling

## Conclusion

This integration guide provides a comprehensive overview of how the Tokyo Apartment Finder application components work together. Follow these patterns and practices to maintain a clean, scalable, and maintainable codebase.

For specific implementation details, refer to the individual service documentation and code comments.