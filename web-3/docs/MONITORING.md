# Monitoring & Logging Setup

This document describes the comprehensive monitoring and logging infrastructure for the Tokyo Apartment Finder application.

## Overview

The monitoring stack includes:
- **Sentry** - Error tracking and performance monitoring
- **Pino** - Structured logging
- **OpenTelemetry** - Distributed tracing and metrics
- **Prometheus** - Metrics collection
- **Grafana** - Visualization and dashboards
- **Loki** - Log aggregation

## Quick Start

### 1. Development Setup

```bash
# Copy environment variables
cp .env.example .env

# Add Sentry DSN (optional in development)
# SENTRY_DSN="your-sentry-dsn"
# NEXT_PUBLIC_SENTRY_DSN="your-sentry-dsn"

# Enable telemetry (optional in development)
# ENABLE_TELEMETRY="true"

# Start monitoring stack
docker-compose -f docker-compose.monitoring.yml up -d
```

### 2. Access Monitoring Tools

- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Application Metrics**: http://localhost:9464/metrics

## Components

### 1. Error Tracking (Sentry)

Sentry automatically captures:
- Unhandled exceptions
- Promise rejections
- API errors
- Performance issues
- User sessions

Configuration files:
- `sentry.client.config.ts` - Client-side configuration
- `sentry.server.config.ts` - Server-side configuration
- `sentry.edge.config.ts` - Edge runtime configuration

### 2. Structured Logging (Pino)

Logging levels by environment:
- **Production**: `info`
- **Development**: `debug`
- **Test**: `error`

Available loggers:
```typescript
import { logger, apiLogger, scraperLogger, dbLogger } from "@/lib/logging";

// Basic logging
logger.info("Application started");

// Module-specific logging
apiLogger.info({ requestId, method, path }, "API request");
scraperLogger.warn({ scraper, error }, "Scraper failed");
dbLogger.debug({ query, duration }, "Query executed");
```

### 3. Distributed Tracing (OpenTelemetry)

Automatic instrumentation for:
- HTTP requests
- Database queries
- External API calls
- Custom spans

Usage:
```typescript
import { withSpan } from "@/lib/telemetry";

const result = await withSpan("operation-name", async () => {
  // Your code here
}, {
  attributes: { userId, key: value }
});
```

### 4. Metrics

Application metrics include:

**HTTP Metrics**:
- `http_requests_total` - Total requests by method, path, status
- `http_request_duration_ms` - Request duration histogram

**Scraper Metrics**:
- `scraper_runs_total` - Total scraper runs by status
- `scraper_duration_ms` - Scraper execution time
- `scraper_items_scraped_total` - Items scraped

**Database Metrics**:
- `db_query_duration_ms` - Query execution time
- `db_connections_active` - Active connections

**Cache Metrics**:
- `cache_hits_total` - Cache hit count
- `cache_misses_total` - Cache miss count

**Business Metrics**:
- `searches_performed_total` - Search operations
- `apartments_viewed_total` - Apartment detail views
- `lists_created_total` - Lists created

### 5. Alerts

Pre-configured alerts include:

**Application Alerts**:
- High error rate (>5% warning, >10% critical)
- High response time (>1s P95)
- Job queue backed up (>1000 jobs)
- Scraper failure rate (>20%)

**Infrastructure Alerts**:
- High CPU usage (>80%)
- High memory usage (>85%)
- Low disk space (<15%)
- Service down

## Usage Examples

### Monitoring API Routes

```typescript
// app/api/example/route.ts
import { withApiMonitoring } from "@/lib/monitoring/middleware";

export const GET = withApiMonitoring(async (request, context) => {
  // Your API logic here
  return NextResponse.json({ data });
});
```

### Monitoring tRPC Procedures

```typescript
// Already integrated in tRPC middleware
// Automatic monitoring for all procedures
```

### Custom Metrics

```typescript
import { appMetrics, trackSearch, trackApartmentView } from "@/lib/monitoring";

// Track business events
trackSearch("commute", { maxTime: 30 });
trackApartmentView(apartmentId, "search_results");

// Custom metrics
appMetrics.jobs.processed.add(1, { type: "scrape" });
```

### Performance Monitoring

```typescript
import { monitorDatabaseQuery, monitorScraperRun } from "@/lib/monitoring";

// Monitor database queries
const result = await monitorDatabaseQuery("getUserLists", async () => {
  return await db.list.findMany({ where: { userId } });
});

// Monitor scraper runs
const data = await monitorScraperRun("suumo", async () => {
  return await scraper.scrape();
});
```

## Production Deployment

### 1. Environment Variables

Required for production:
```env
# Sentry
SENTRY_DSN="your-production-dsn"
SENTRY_ORG="your-org"
SENTRY_PROJECT="your-project"
SENTRY_AUTH_TOKEN="your-auth-token"
SENTRY_ENVIRONMENT="production"

# Logging
LOG_LEVEL="info"

# OpenTelemetry
ENABLE_TELEMETRY="true"
OTEL_EXPORTER_OTLP_ENDPOINT="http://your-otel-collector:4318"
METRICS_PORT="9464"
```

### 2. Deploy Monitoring Stack

```bash
# Production deployment
docker-compose -f docker-compose.prod.yml -f docker-compose.monitoring.yml up -d

# Verify services
docker-compose ps
curl http://localhost:9464/metrics
```

### 3. Configure Grafana

1. Access Grafana at http://your-domain:3001
2. Import dashboards from `monitoring/grafana/dashboards/`
3. Configure alert channels (email, Slack, etc.)
4. Set up user access controls

### 4. Configure Alerts

1. Edit `monitoring/prometheus/alerts/app-alerts.yml`
2. Add notification channels
3. Customize thresholds based on your SLOs
4. Test alerts with synthetic errors

## Troubleshooting

### High Memory Usage

Check for memory leaks:
```bash
# View Node.js memory metrics
curl http://localhost:9464/metrics | grep nodejs_heap
```

### Missing Logs

1. Check log level: `LOG_LEVEL` environment variable
2. Verify Promtail configuration
3. Check Docker log driver settings

### Missing Metrics

1. Verify metrics endpoint: `curl http://localhost:9464/metrics`
2. Check Prometheus targets: http://localhost:9090/targets
3. Verify scrape configuration

### Sentry Not Receiving Events

1. Verify DSN is set correctly
2. Check network connectivity
3. Look for Sentry debug logs
4. Verify environment matches Sentry project

## Best Practices

1. **Structured Logging**: Always use structured logging with context
   ```typescript
   logger.info({ userId, action, result }, "User action completed");
   ```

2. **Error Context**: Add relevant context to errors
   ```typescript
   Sentry.setContext("apartment", { id, source, price });
   ```

3. **Performance Budgets**: Monitor and alert on performance regressions
   - API response time < 200ms (P50)
   - Database queries < 50ms
   - Page load time < 3s

4. **Log Retention**: Configure appropriate retention
   - Errors: 30 days
   - Warnings: 14 days
   - Info: 7 days
   - Debug: 24 hours

5. **Sampling**: Adjust sampling rates for cost optimization
   - Production traces: 10%
   - Production profiles: 10%
   - Development: 100%

## Maintenance

### Weekly Tasks
- Review error trends in Sentry
- Check alert fatigue (too many/few alerts)
- Review slow queries and API endpoints
- Update dashboards based on new metrics

### Monthly Tasks
- Review and optimize log retention
- Analyze performance trends
- Update alert thresholds
- Clean up unused metrics

### Quarterly Tasks
- Review monitoring costs
- Upgrade monitoring tools
- Performance baseline updates
- Disaster recovery testing

---

For more information, see:
- [Sentry Documentation](https://docs.sentry.io/)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Prometheus Documentation](https://prometheus.io/docs/)