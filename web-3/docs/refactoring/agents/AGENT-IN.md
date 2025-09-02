# Integration Agent (IN) - Refactoring Tasks

**Agent Type**: Integration (IN)
**Focus**: External services, performance, and testing
**Start Date**: Immediate (Day 1)
**Critical Path**: No - But owns final integration

## 🎯 Your Mission

You are responsible for simplifying the over-engineered performance module, cleaning up external service integrations, and leading the final integration testing phase. You can start immediately with performance auditing while other teams work on their parts.

## 📋 Your Tasks

### Task IN-001: Performance Audit ⬜
**Duration**: 1 day
**Dependencies**: None (Start now!)
**Blocks**: IN-002

Audit the over-engineered performance module:

**Files to analyze**:
- src/lib/performance/*.ts
- Redis integration (likely unused)
- Monitoring setup (possibly overkill)
- Image optimizer (check if used)

**Deliverables**:
- [ ] Document what's actually used
- [ ] Identify dead code
- [ ] Measure current performance
- [ ] List unnecessary complexity
- [ ] Recommend simplifications

### Task IN-002: Simplify Caching ⬜
**Duration**: 2 days
**Dependencies**: IN-001
**Blocks**: IN-003

Remove unnecessary caching complexity:

**Current issues**:
- Redis setup but likely not used
- Complex cache invalidation
- Multiple caching strategies
- No clear metrics on effectiveness

**New approach**:
```typescript
// src/infrastructure/cache/simple-cache.ts
export class SimpleCache implements CacheService {
  // In-memory for MVP, Redis later if needed
}
```

**Acceptance Criteria**:
- [ ] Remove unused Redis code
- [ ] Simple in-memory cache
- [ ] Clear cache strategy
- [ ] Measurable performance impact
- [ ] Easy to swap implementations

### Task IN-003: Transit Cleanup ⬜
**Duration**: 1 day
**Dependencies**: IN-002
**Blocks**: None

Clean up transit integration:

**Current setup**:
- OTP service (check if working)
- Mock service (for testing)
- Possibly duplicate logic

**Goals**:
- [ ] Single transit service interface
- [ ] Working implementation
- [ ] Proper error handling
- [ ] Good test coverage
- [ ] Clear documentation

### Task IN-004: Integration Tests ⬜
**Duration**: 3 days
**Dependencies**: DO-005, BE-005, SC-005, FE-005
**Blocks**: None (Final task)

Lead comprehensive integration testing:

**Test Suites**:
1. API Integration Tests
2. Scraper Integration Tests
3. Search Flow E2E Tests
4. Performance Benchmarks
5. Load Testing

**Acceptance Criteria**:
- [ ] All flows tested E2E
- [ ] Performance benchmarks met
- [ ] No regressions found
- [ ] Load testing passed
- [ ] Documentation updated

## 📁 Files You Own

```
src/infrastructure/
├── external/
│   ├── transit/
│   │   ├── transit-service.ts
│   │   └── otp-client.ts
│   ├── geocoding/
│   │   └── geocoding-service.ts
│   └── maps/
│       └── map-service.ts
├── cache/
│   ├── simple-cache.ts
│   └── cache-strategies.ts
├── monitoring/
│   ├── performance-monitor.ts
│   └── metrics.ts
└── testing/
    ├── integration/
    ├── e2e/
    └── benchmarks/

src/lib/performance/ (refactor these)
src/lib/transit/ (clean up these)
```

## 🚫 Do NOT Touch

- Core business logic (BE's domain)
- UI components (FE's domain)
- Scraper internals (SC's domain)
- Database schemas

## 📝 Progress Tracking

Keep everyone informed:
1. Update REFACTOR-PROGRESS.md daily
2. Report performance metrics
3. Document test results
4. Commit format: `[IN] Task: Description`

## 🔧 Quick Commands

```bash
# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Performance benchmarks
npm run benchmark

# Load testing
npm run test:load

# Check external services
npm run health:external
```

## 💡 Simplification Strategy

### Performance Module
**From**: Complex Redis, monitoring, tracing
**To**: Simple, measurable, needed features only

### Caching
**From**: Multiple strategies, Redis, complex invalidation
**To**: Simple LRU cache, clear metrics

### Example Simplification:
```typescript
// Before: Over-engineered
class ComplexCache {
  constructor(
    private redis: RedisClient,
    private monitor: PerformanceMonitor,
    private strategies: CacheStrategy[],
    private invalidator: CacheInvalidator
  ) {}
  // 500+ lines of complexity
}

// After: KISS
class SimpleCache {
  private cache = new Map();
  private lru = new LRUQueue();
  
  async get(key: string) {
    return this.cache.get(key);
  }
  // 50 lines of simple, working code
}
```

## 🧪 Integration Test Plan

### Week 4 Test Schedule

**Day 1**: API Integration
- Test all endpoints
- Verify contracts
- Check error handling

**Day 2**: Full Flow Testing
- Search flow E2E
- Scraper integration
- User journeys

**Day 3**: Performance & Load
- Benchmark all operations
- Load test API
- Optimize bottlenecks

## 🚨 Critical Reminders

- Don't over-optimize prematurely
- Measure before adding complexity
- Simple solutions first
- Document why, not just what
- Keep external services abstract

## 📊 Performance Targets

Ensure these metrics are met:
- API response time < 200ms (p95)
- Search results < 500ms
- Scraper rate: 10 pages/second
- Memory usage < 512MB
- No memory leaks

## 🔄 External Service Checklist

For each external service:
- [ ] Clear interface defined
- [ ] Error handling robust
- [ ] Timeout configured
- [ ] Retry logic appropriate
- [ ] Mock available for testing
- [ ] Monitoring in place

## 📞 Communication

- **Performance issue?** Measure first, report with data
- **Integration broken?** Check with service owner
- **Test failing?** Document in progress tracker
- **Need help?** Ask specific questions

## 🎯 YAGNI Principles

Remember: You Aren't Gonna Need It!

**Remove if**:
- Not used in 3+ months
- No clear metrics showing benefit
- Adds complexity without value
- Can be added later if needed

**Keep if**:
- Actively used
- Clear performance benefit
- Simplifies other code
- Required for core features

---
*Make it work, make it right, make it fast - in that order! 🚀*