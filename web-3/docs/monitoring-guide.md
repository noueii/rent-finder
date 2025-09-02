# Monitoring Guide

## Overview

This guide covers the monitoring and health check infrastructure for the Tokyo Apartment Finder application. Following the YAGNI principle, we've implemented simple, effective monitoring without external dependencies.

## Health Check Endpoints

### Basic Health Check
```typescript
// GET /api/trpc/health.check
{
  "status": "ok",
  "timestamp": "2025-01-25T12:00:00Z"
}
```

### Detailed Health Check
```typescript
// GET /api/trpc/health.detailed
{
  "status": "healthy", // healthy | degraded | error
  "timestamp": "2025-01-25T12:00:00Z",
  "version": "1.0.0",
  "uptime": 3600,
  "services": [
    {
      "name": "PostgreSQL Database",
      "status": "healthy",
      "responseTime": 45,
      "details": {
        "connected": true,
        "userCount": 150
      }
    },
    {
      "name": "Transit Service",
      "status": "healthy",
      "responseTime": 120,
      "details": {
        "available": true,
        "stationCount": 45
      }
    }
  ],
  "dependencies": [
    {
      "name": "Node.js",
      "version": "v18.17.0",
      "required": ">=18.0.0"
    },
    {
      "name": "PostgreSQL",
      "version": "15.3",
      "required": ">=14.0"
    }
  ],
  "metrics": {
    "responseTime": 165,
    "memoryUsage": 124.5,
    "cpuUsage": {
      "user": 234567,
      "system": 123456
    }
  }
}
```

### Service-Specific Checks
```typescript
// Database health
GET /api/trpc/health.database

// Transit service health
GET /api/trpc/health.transit

// System metrics
GET /api/trpc/health.metrics
```

## Metrics Collection

We use a simple in-memory metrics collector that tracks:

### Available Metrics

1. **API Response Times**
   - Tracked per endpoint
   - Includes percentiles (p50, p95, p99)
   - Separated by success/error status

2. **Request Counts**
   - Total requests per endpoint
   - Error counts by type
   - Success/failure ratios

3. **System Metrics**
   - Memory usage (heap, RSS)
   - CPU usage
   - Process uptime

### Using Metrics in Code

```typescript
import { metrics } from '~/infrastructure/monitoring/metrics';

// Record a metric
metrics.record('api.search.duration', responseTime, 'ms', {
  status: 'success',
  resultCount: results.length.toString()
});

// Increment a counter
metrics.increment('scraper.apartments.found', apartments.length);

// Measure function execution
const result = await metrics.measureTime(
  'database.query.apartments',
  async () => {
    return await prisma.apartment.findMany({ ... });
  },
  { queryType: 'search' }
);

// Record histogram data
metrics.histogram('apartment.prices', apartment.price);
```

## Performance Monitoring

### Performance Thresholds

Based on our requirements:

| Metric | Target | Alert Threshold |
|--------|--------|----------------|
| API Response Time | < 300ms | > 500ms |
| Database Query Time | < 100ms | > 200ms |
| Search Time (with scraping) | < 3s | > 5s |
| Memory Usage | < 512MB | > 768MB |
| Scraper Rate | > 10 pages/s | < 5 pages/s |

### Monitoring Performance

1. **Real-time Monitoring**
   ```bash
   # View current metrics
   curl http://localhost:3000/api/trpc/health.metrics
   ```

2. **Performance Logs**
   - Slow queries are automatically logged
   - API requests > 300ms are logged with details
   - Memory spikes are logged

3. **Health Check Integration**
   ```bash
   # Simple health check for load balancer
   curl http://localhost:3000/api/trpc/health.check
   
   # Detailed check for monitoring systems
   curl http://localhost:3000/api/trpc/health.detailed
   ```

## Error Tracking

### Automatic Error Logging

All errors are automatically logged with:
- Error type and message
- Stack trace (in development)
- Request context
- User context (if authenticated)
- Timestamp

### Error Categories

1. **Operational Errors** (expected)
   - Validation errors
   - Not found errors
   - Authentication errors
   - Rate limit errors

2. **System Errors** (unexpected)
   - Database connection errors
   - External service failures
   - Unhandled exceptions

### Error Monitoring

```typescript
// Errors are automatically tracked
try {
  await riskyOperation();
} catch (error) {
  // Automatically logged and tracked
  errorHandler.handle(error, {
    context: 'scraper',
    userId: user.id,
    operation: 'apartment-import'
  });
}
```

## Scraper Monitoring

### Scraper Health Metrics

- Pages scraped per minute
- Apartments found per run
- Error rate
- Average response time
- Proxy health

### Monitoring Scraper Runs

```typescript
// Check scraper status
GET /api/trpc/admin.getScrapers

// View scraper history
GET /api/trpc/admin.getScraperHistory?scraperName=realestate&limit=10

// Test scraper health
POST /api/trpc/admin.testScraper
{
  "scraperName": "realestate",
  "dryRun": true
}
```

## Setting Up Monitoring

### 1. Development Environment

```bash
# Enable detailed logging
export LOG_LEVEL=debug
export NODE_ENV=development

# Run with monitoring
npm run dev
```

### 2. Production Environment

```bash
# Configure production monitoring
export LOG_LEVEL=info
export NODE_ENV=production
export APP_VERSION=1.0.0

# Health check endpoint for load balancer
export HEALTH_CHECK_PATH=/api/trpc/health.check
```

### 3. External Monitoring Integration

The health check endpoints can be integrated with:

- **Uptime Monitoring**: Use `/api/trpc/health.check`
- **APM Tools**: Use `/api/trpc/health.detailed`
- **Load Balancers**: Use `/api/trpc/health.check`
- **Kubernetes**: Configure liveness and readiness probes

```yaml
# Example Kubernetes configuration
livenessProbe:
  httpGet:
    path: /api/trpc/health.check
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /api/trpc/health.detailed
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
```

## Alerts and Notifications

### When to Alert

1. **Critical Alerts**
   - Database connection lost
   - Application crash/restart
   - Memory usage > 90%
   - Error rate > 10%

2. **Warning Alerts**
   - API response time > 500ms (sustained)
   - Scraper failures > 3 consecutive
   - Memory usage > 75%
   - Database query time > 200ms

### Alert Channels

For MVP, use simple logging. For production:

```typescript
// Example alert integration
if (metrics.getErrorRate() > 0.1) {
  logger.error('High error rate detected', {
    rate: metrics.getErrorRate(),
    errors: metrics.getRecentErrors()
  });
  
  // Send to external service if configured
  if (process.env.ALERT_WEBHOOK) {
    await sendAlert({
      level: 'critical',
      message: 'Error rate exceeded 10%',
      details: { ... }
    });
  }
}
```

## Best Practices

### Do's ✅

1. **Use structured logging**
   ```typescript
   logger.info('Apartment search completed', {
     userId: user.id,
     filters: searchFilters,
     resultCount: results.length,
     duration: responseTime
   });
   ```

2. **Track business metrics**
   - Searches per user
   - Popular search criteria
   - Apartment view rates
   - List creation patterns

3. **Monitor external dependencies**
   - Transit API response times
   - Scraper target availability
   - Database connection pool

4. **Set up gradual degradation**
   - Cache when external services slow
   - Fallback to cached data
   - Disable non-critical features

### Don'ts ❌

1. **Don't over-monitor**
   - Avoid metrics that don't drive decisions
   - Don't track personal data
   - Skip vanity metrics

2. **Don't ignore trends**
   - Rising memory usage
   - Increasing error rates
   - Slowing response times

3. **Don't alert on noise**
   - Single slow requests
   - Expected errors (validation)
   - Normal variations

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   ```bash
   # Check memory metrics
   curl http://localhost:3000/api/trpc/health.metrics
   
   # Look for memory leaks
   - Large result sets not paginated
   - Scraper data accumulation
   - Cache growing unbounded
   ```

2. **Slow API Responses**
   ```typescript
   // Enable query logging
   export DEBUG=prisma:query
   
   // Check for N+1 queries
   // Look for missing indexes
   // Review pagination limits
   ```

3. **Scraper Failures**
   ```bash
   # Test scraper manually
   npm run test:scraper -- --name=realestate
   
   # Check proxy health
   # Verify rate limits
   # Test target site changes
   ```

## Future Enhancements

When the application grows:

1. **Distributed Tracing**
   - Track requests across services
   - Identify bottlenecks
   - Visualize dependencies

2. **Time-series Metrics**
   - Historical performance data
   - Trend analysis
   - Capacity planning

3. **Advanced Alerting**
   - Anomaly detection
   - Predictive alerts
   - Custom thresholds per user

---

*Remember: Start simple, measure everything, alert on what matters.*