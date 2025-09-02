# Performance Benchmarks

Simple performance benchmarks for the Tokyo Apartment Finder application.

## Overview

This directory contains performance benchmarks for measuring the baseline performance of various system components:

- **API Response Times** - Measures tRPC endpoint performance
- **Database Queries** - Measures Prisma query performance
- **Search Operations** - Measures apartment search performance
- **Scraper Performance** - Measures HTML parsing and data processing

## Running Benchmarks

### Run All Benchmarks

```bash
# From the project root
npm run benchmark

# Or directly with tsx
tsx src/infrastructure/benchmarks/index.ts
```

### Run Specific Benchmarks

```bash
# API benchmarks only
tsx src/infrastructure/benchmarks/index.ts --api

# Database benchmarks only
tsx src/infrastructure/benchmarks/index.ts --database

# Search benchmarks only
tsx src/infrastructure/benchmarks/index.ts --search

# Scraper benchmarks only
tsx src/infrastructure/benchmarks/index.ts --scraper

# Multiple specific benchmarks
tsx src/infrastructure/benchmarks/index.ts --api --database
```

### Run Individual Benchmark Files

```bash
# Run API benchmarks
tsx src/infrastructure/benchmarks/api-benchmarks.ts

# Run database benchmarks
tsx src/infrastructure/benchmarks/database-benchmarks.ts

# Run search benchmarks
tsx src/infrastructure/benchmarks/search-benchmarks.ts

# Run scraper benchmarks
tsx src/infrastructure/benchmarks/scraper-benchmarks.ts
```

## Performance Baselines

Based on the benchmarks, here are the recommended performance baselines:

### API Response Times
- Health Check: < 10ms
- Simple Queries: < 50ms
- Complex Queries: < 200ms
- Search Operations: < 500ms

### Database Queries
- Simple queries (count, findFirst): < 5ms
- Basic findMany (20 records): < 10ms
- Queries with relations: < 20ms
- Complex filtered queries: < 30ms
- Aggregation queries: < 50ms

### Search Operations
- Basic search (20 results): < 50ms
- Filtered search: < 100ms
- Multi-station search: < 150ms
- Fuzzy search: < 20ms
- Search with count: < 100ms
- Complex multi-filter search: < 200ms

### Scraper Performance
- HTML parsing (20 items): < 5ms
- HTML parsing (100 items): < 20ms
- HTML parsing (500 items): < 100ms
- Data validation/transform: < 2ms per 100 items
- Full pipeline (medium): < 50ms

## Benchmark Results

Benchmark results are automatically saved to:
```
./benchmark-results/[benchmark-type]-[timestamp].json
```

Each result file contains:
- Timestamp of the benchmark run
- Detailed timing statistics for each operation
- Performance percentiles (P50, P90, P95, P99)

## Implementation Details

The benchmarks use only built-in Node.js tools:
- `process.hrtime.bigint()` for high-precision timing
- No external benchmarking libraries required
- Simple and maintainable

Each benchmark:
1. Runs warmup iterations to stabilize performance
2. Executes the operation multiple times
3. Calculates statistics (avg, min, max, percentiles)
4. Formats results in a readable table
5. Saves results to JSON for tracking

## Adding New Benchmarks

To add a new benchmark:

1. Create a new benchmark configuration in the appropriate file
2. Follow the existing pattern:
   ```typescript
   {
     name: 'Your Benchmark Name',
     query: () => yourOperation(),
   }
   ```
3. Add to the benchmarks array
4. Update baseline recommendations if needed

## Notes

- Benchmarks should be run in a consistent environment
- Database should be populated with representative data
- Network latency affects API benchmarks
- Results may vary based on system load
- Use these benchmarks to detect performance regressions