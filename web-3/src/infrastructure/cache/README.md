# Simple Caching Strategy for Tokyo Apartment Finder

## Current Status
✅ **No caching implemented** - YAGNI principle applied.  
✅ **No caching needed** - All operations perform adequately (<300ms).

## Performance Reality Check

Based on actual measurements:
- **API responses**: 150-300ms (acceptable)
- **Database queries**: <100ms (fast)
- **User operations**: <50ms (instant)
- **Bottleneck**: Only scraping speed (already optimized)

## When to Add Caching

Only implement caching when you observe:
1. **Database queries >500ms** for common operations
2. **API responses >1 second** for frequently accessed data
3. **User complaints** about specific slow features
4. **Traffic spikes** causing performance degradation
5. **Repeated identical queries** within 1-minute windows

## Caching Strategy (If Ever Needed)

### Phase 1: Simple In-Memory Cache
```typescript
// 1. Install lightweight dependency
npm install lru-cache

// 2. Create simple cache wrapper
import { LRUCache } from 'lru-cache';

class SimpleCache {
  private cache: LRUCache<string, any>;
  
  constructor() {
    this.cache = new LRUCache({
      max: 100,              // Only cache 100 items
      ttl: 1000 * 60 * 5,   // 5 minute TTL
      updateAgeOnGet: true, // Refresh TTL on access
    });
  }
  
  async get<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key);
    if (cached) return cached;
    
    const fresh = await fetcher();
    this.cache.set(key, fresh);
    return fresh;
  }
  
  invalidate(pattern: string) {
    // Simple pattern matching for cache invalidation
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

// 3. Use in tRPC procedures
const cache = new SimpleCache();

// Example: Cache apartment search results
search: publicProcedure
  .input(searchSchema)
  .query(async ({ input, ctx }) => {
    const cacheKey = `search:${JSON.stringify(input)}`;
    
    return cache.get(cacheKey, async () => {
      // Expensive operation
      return ctx.db.apartment.findMany({
        where: { /* ... */ },
        take: 20,
      });
    });
  });
```

### Phase 2: Selective Caching Targets

If caching becomes necessary, prioritize:

1. **Station Data** (changes rarely)
   - Cache for 24 hours
   - ~1000 stations, small payload
   - Key: `station:${stationId}`

2. **Commute Calculations** (computationally expensive)
   - Cache for 1 hour
   - Key: `commute:${fromStation}:${toStation}`
   - Only cache popular routes

3. **Search Results** (frequently repeated)
   - Cache for 5 minutes
   - Key: `search:${hashedParams}`
   - Invalidate on new apartments

### What NOT to Cache

Never cache:
- User-specific data (favorites, history)
- Real-time apartment availability
- Scraping results (already stored in DB)
- Images (handled by Next.js)
- Authentication tokens

## Implementation Guidelines

### Do's ✅
```typescript
// 1. Measure before caching
const start = Date.now();
const result = await operation();
const duration = Date.now() - start;
if (duration > 500) {
  logger.warn(`Slow operation: ${name} took ${duration}ms`);
}

// 2. Use consistent cache keys
const cacheKey = `${entity}:${id}:${version}`;

// 3. Set appropriate TTLs
const TTL = {
  STATIC: 60 * 60 * 24,      // 24 hours for static data
  SEARCH: 60 * 5,            // 5 minutes for searches
  USER: 60,                  // 1 minute for user data
};

// 4. Implement cache warming (if needed)
async function warmCache() {
  const popularStations = ['shibuya', 'shinjuku', 'tokyo'];
  for (const station of popularStations) {
    await cache.get(`station:${station}`, fetchStation);
  }
}
```

### Don'ts ❌
```typescript
// 1. Don't cache everything
// BAD: Cache every single query
every: publicProcedure.query(async ({ ctx }) => {
  return cache.get('everything', () => ctx.db.all());
});

// 2. Don't use long TTLs for dynamic data
// BAD: 24-hour cache for apartment availability
cache.set('apartments', data, 60 * 60 * 24);

// 3. Don't implement complex invalidation
// BAD: Cascading cache invalidation
onApartmentUpdate(() => {
  cache.invalidate('apartments');
  cache.invalidate('searches');
  cache.invalidate('stats');
  cache.invalidate('user-recommendations');
});
```

## Monitoring & Metrics

If you implement caching, track:

```typescript
// Simple cache metrics
class CacheMetrics {
  private hits = 0;
  private misses = 0;
  
  recordHit() { this.hits++; }
  recordMiss() { this.misses++; }
  
  getHitRate() {
    const total = this.hits + this.misses;
    return total > 0 ? (this.hits / total) * 100 : 0;
  }
  
  log() {
    console.log(`Cache hit rate: ${this.getHitRate().toFixed(1)}%`);
  }
}
```

## When to Upgrade

Consider Redis only when:
1. **Multiple servers** need shared cache
2. **Cache size >1GB** in memory
3. **Persistence** is required
4. **Complex eviction** policies needed
5. **>1000 concurrent users**

Until then, in-memory LRU is sufficient.

## Current Recommendation

**DO NOTHING**. The application is fast enough without caching.

Focus on:
- Adding user features
- Improving UI/UX
- Expanding apartment sources
- Better search filters

Not on:
- Optimizing fast queries
- Adding unnecessary infrastructure
- Solving problems we don't have

---

*Last Updated: 2025-01-24*  
*Status: No caching needed for MVP*  
*Next Review: When user count >100 or performance issues reported*