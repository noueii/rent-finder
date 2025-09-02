# Performance Optimization Guide

## Overview

This document outlines the performance optimizations implemented in the Tokyo Apartment Finder application to ensure fast response times and scalability.

## 1. Database Indexes

### Applied Indexes

The following indexes have been added to optimize query performance:

#### Apartment Table
- `price` - For price range filtering
- `size` - For size range filtering
- `layout` - For layout type filtering
- `availability` - For availability status filtering
- `createdAt`, `scrapedAt` - For sorting by date
- `sourceSite` - For filtering by source
- `latitude, longitude` - For geographic queries
- Composite indexes:
  - `price, size` - For combined filtering
  - `availability, price` - For available apartments by price
  - `layout, price` - For layout-specific price searches

#### Station & Relationship Tables
- `ApartmentStation`: `apartmentId`, `stationId`, `walkingMinutes`
- `Station`: `name`, `nameEn`, `latitude, longitude`
- `TrainLine`: `name`, `company`

#### User & List Tables
- `List`: `userId`, `type`, `status`, `createdAt`
- `ApartmentList`: `listId`, `apartmentId`, `seen`, `addedAt`
- Composite: `listId, seen` - For finding unseen apartments

### GIN Indexes
- `Apartment.amenities` - For array searches
- `UserPreference.preferredStations` - For array searches

## 2. Query Optimization

### QueryOptimizer Service

The `QueryOptimizer` class provides:

- **Query Caching**: In-memory cache with TTL
- **Batch Operations**: Reduce database round trips
- **Optimized Includes**: Only fetch necessary relations
- **Parallel Execution**: Run count and data queries simultaneously

```typescript
// Example usage
const optimizer = getQueryOptimizer(prisma);
const result = await optimizer.searchApartmentsOptimized(filters, pagination, sort);
```

### Popular Queries Optimization

Common queries are optimized with raw SQL for better performance:

```typescript
// Get popular stations with apartment counts
const popularStations = await optimizer.getPopularStationsOptimized(10);
```

## 3. Caching Strategy

### Redis Cache Implementation

The application uses Redis for distributed caching with automatic fallback to in-memory cache:

```typescript
const cache = getRedisCache();

// Cache apartment data
await cache.set('apartment:123', apartmentData, 600); // 10 minutes TTL

// Batch operations
await cache.mget(['apartment:1', 'apartment:2']);
```

### Cache TTL Settings

- Search results: 30 minutes
- Individual apartments: 10 minutes
- Popular data: 1 hour
- Station data: 24 hours

### Cache Invalidation

- Pattern-based invalidation
- Automatic cleanup of expired entries
- Manual cache clearing via admin panel

## 4. Image Optimization

### ImageOptimizer Service

Provides CDN-based image transformation:

```typescript
const optimizer = getImageOptimizer();

// Listing images (400x300, 80% quality)
const listingImage = optimizer.getListingImages(originalUrl);

// Gallery images (1200px wide, 90% quality)
const galleryImage = optimizer.getGalleryImages(originalUrl);

// Responsive images
const srcSet = optimizer.generateSrcSet(originalUrl);
```

### Image Loading Strategy

1. **Progressive Loading**: Blur placeholders for images
2. **Lazy Loading**: Load images only when visible
3. **Responsive Images**: Different sizes for different screens
4. **WebP Format**: Modern format for better compression

## 5. Pagination Improvements

### Cursor-Based Pagination

For large datasets, cursor pagination provides better performance:

```typescript
const paginator = createApartmentCursorPagination();
const result = await paginateWithCursor(db.apartment, {
  where: filters,
  cursor: lastCursor,
  take: 20,
});
```

### Benefits
- Consistent performance regardless of page number
- No offset calculations
- Stable results when data changes

## 6. Performance Monitoring

### PerformanceMonitor Service

Tracks and analyzes application performance:

```typescript
const monitor = getPerformanceMonitor();

// Track operation timing
const stopTimer = monitor.startTimer('operation.name');
// ... operation code ...
stopTimer();

// Generate performance report
const report = monitor.generateReport(24); // Last 24 hours
```

### Metrics Tracked

- API response times
- Database query performance
- Cache hit rates
- Error rates
- Slow query identification

### Admin Dashboard

Access performance metrics at `/api/admin/performance`:

- Real-time performance statistics
- Database query analysis
- Cache utilization
- Slow query logs
- System health metrics

## 7. API Optimizations

### Optimized Endpoints

1. **Batch Operations**: Get multiple apartments in one request
2. **Prefetching**: Warm cache with popular data
3. **Selective Fields**: Only return necessary data
4. **Parallel Processing**: Execute independent queries simultaneously

### Example: Optimized Search

```typescript
// Search with all optimizations
const results = await api.apartment.search.query({
  filters: { priceMax: 100000 },
  pagination: { page: 1, limit: 20, useCursor: true },
  sort: { field: 'price', order: 'asc' }
});
```

## 8. Frontend Optimizations

### Component-Level Optimizations

1. **Virtual Scrolling**: For long lists using `@tanstack/react-virtual`
2. **Debounced Search**: Reduce API calls during typing
3. **Optimistic Updates**: Immediate UI feedback
4. **Component Memoization**: Prevent unnecessary re-renders

### Data Fetching

1. **Prefetch on Hover**: Load apartment details before clicking
2. **Infinite Scroll**: Load more results as user scrolls
3. **Stale-While-Revalidate**: Show cached data while fetching updates

## 9. Configuration

### Environment Variables

```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379

# Image CDN
NEXT_PUBLIC_IMAGE_CDN_URL=https://cdn.example.com

# Cache TTL (seconds)
CACHE_TTL_SEARCH=1800
CACHE_TTL_APARTMENT=600
CACHE_TTL_POPULAR=3600

# Performance Monitoring
ENABLE_PERFORMANCE_MONITORING=true
PERFORMANCE_REPORT_INTERVAL=3600000
```

## 10. Best Practices

### Database Queries

1. **Use Indexes**: Ensure queries use appropriate indexes
2. **Limit Relations**: Only include necessary relations
3. **Batch Operations**: Combine multiple queries when possible
4. **Connection Pooling**: Configure appropriate pool size

### Caching

1. **Cache Warming**: Pre-populate cache with popular data
2. **Cache Keys**: Use consistent, hierarchical key patterns
3. **TTL Strategy**: Balance freshness with performance
4. **Monitoring**: Track cache hit rates and adjust TTLs

### Images

1. **Lazy Load**: Only load visible images
2. **Responsive**: Serve appropriate sizes
3. **Format**: Use WebP with fallbacks
4. **CDN**: Serve from edge locations

## 11. Monitoring & Maintenance

### Regular Tasks

1. **Analyze Tables**: Run `ANALYZE` weekly
2. **Vacuum Database**: Run `VACUUM` monthly
3. **Monitor Indexes**: Check index usage statistics
4. **Review Slow Queries**: Identify and optimize slow queries
5. **Cache Analysis**: Review hit rates and adjust TTLs

### Performance Testing

1. **Load Testing**: Use tools like k6 or Artillery
2. **Database Profiling**: Monitor query execution plans
3. **Frontend Profiling**: Use React DevTools Profiler
4. **Real User Monitoring**: Track actual user experience

## 12. Troubleshooting

### Common Issues

1. **Slow Queries**
   - Check query execution plan
   - Verify indexes are being used
   - Consider query restructuring

2. **High Memory Usage**
   - Review cache size limits
   - Check for memory leaks
   - Optimize data structures

3. **Poor Cache Performance**
   - Verify Redis connection
   - Check key distribution
   - Review TTL settings

### Debug Tools

```typescript
// Check query execution plan
const plan = await optimizer.explainQuery(
  'SELECT * FROM "Apartment" WHERE price < $1',
  [100000]
);

// Get cache statistics
const cacheStats = cache.getStats();

// View performance metrics
const metrics = monitor.exportMetrics();
```