# Scraper Agent (SC) - Refactoring Tasks

**Agent Type**: Scraper (SC)
**Focus**: Web scraping consolidation and optimization
**Start Date**: Immediate analysis, implementation after DO
**Critical Path**: No - But needed for integration tests

## 🎯 Your Mission

You are responsible for simplifying the overly complex scraper architecture. Currently there are 4 different base scrapers with 80% code overlap. Your goal is to create a single, flexible scraper system using the Strategy pattern. This will dramatically reduce code duplication and maintenance burden.

## 📋 Your Tasks

### Task SC-001: Analyze Scrapers ✅
**Duration**: 1 day
**Dependencies**: None (Start immediately!)
**Blocks**: SC-002

Deep analysis of current scraper mess:
1. Document overlap between base scrapers
2. Identify real differences vs artificial complexity
3. Understand why "fast" versions exist
4. Map all proxy manager implementations

**Current files to analyze**:
- src/lib/scrapers/base-scraper.ts (~300 lines)
- src/lib/scrapers/fast-base-scraper.ts
- src/lib/scrapers/fast-base-scraper-queue.ts
- src/lib/scrapers/fast-base-scraper-streaming.ts

**Deliverable**: Analysis document with:
- [ ] Code overlap percentage
- [ ] Real differences identified
- [ ] Consolidation strategy
- [ ] Risk assessment

### Task SC-002: Unified Base Scraper ✅
**Duration**: 2 days
**Dependencies**: SC-001, DO-002, DO-003
**Blocks**: SC-003

Create single base scraper to rule them all:
```typescript
// src/infrastructure/scrapers/base/unified-scraper.ts
export class UnifiedScraper implements ScrapingStrategy {
  constructor(
    private config: ScraperConfig,
    private errorHandler: ErrorHandler,
    private validator: Validator<ScrapedData>
  ) {}
  
  // Single implementation, configurable behavior
}
```

**Acceptance Criteria**:
- [ ] Single base class replacing all 4
- [ ] Performance mode as config option
- [ ] Uses DO's error handler
- [ ] Maintains current functionality
- [ ] Reduces total LOC by 60%+

### Task SC-003: Strategy Pattern ✅
**Duration**: 1 day
**Dependencies**: SC-002
**Blocks**: SC-004

Implement proper strategy pattern:
```typescript
// src/infrastructure/scrapers/strategies/
├── realestate-strategy.ts
├── yolo-strategy.ts
├── wagaya-strategy.ts
└── metro-strategy.ts
```

**Acceptance Criteria**:
- [ ] Each site has a strategy class
- [ ] Strategies only contain site-specific logic
- [ ] Common logic in base scraper
- [ ] Easy to add new sites
- [ ] Strategies are testable

### Task SC-004: Proxy Manager Merge ✅
**Duration**: 1 day
**Dependencies**: SC-003
**Blocks**: SC-005

Consolidate 3 proxy managers into 1:
- ProxyManager
- FastProxyManager
- ProxyAgentHelper

**New structure**:
```typescript
// src/infrastructure/scrapers/proxy/unified-proxy-manager.ts
export class UnifiedProxyManager implements ProxyManager {
  // Single implementation with strategy pattern
}
```

**Acceptance Criteria**:
- [ ] Single proxy manager
- [ ] Configurable strategies
- [ ] Better error handling
- [ ] Proper blacklisting
- [ ] Performance maintained

### Task SC-005: Update All Scrapers ⬜
**Duration**: 2 days
**Dependencies**: SC-004
**Blocks**: IN-004

Migrate all scrapers to new architecture:
1. Update RealEstateScraper
2. Update YoloJapanScraper
3. Update WagayaJapanScraper
4. Update MetroResidencesScraper
5. Remove all "fast" variants
6. Update scraper factory

**Acceptance Criteria**:
- [ ] All scrapers use new base
- [ ] All tests pass
- [ ] Performance benchmarks met
- [ ] No duplicate implementations
- [ ] Factory simplified

## 📁 Files You Own

```
src/infrastructure/scrapers/
├── base/
│   ├── unified-scraper.ts
│   └── scraper-config.ts
├── strategies/
│   ├── base-strategy.ts
│   ├── realestate-strategy.ts
│   ├── yolo-strategy.ts
│   ├── wagaya-strategy.ts
│   └── metro-strategy.ts
├── proxy/
│   ├── unified-proxy-manager.ts
│   └── proxy-strategies.ts
├── utils/
│   ├── user-agent.ts
│   ├── rate-limiter.ts
│   └── html-parser.ts
└── factory/
    └── scraper-factory.ts

src/lib/scrapers/ (refactor/remove these)
```

## 🚫 Do NOT Touch

- API routers (BE's domain)
- UI components (FE's domain)
- Business logic services
- Database schemas

## 📝 Progress Tracking

Update progress after each milestone:
1. Update REFACTOR-PROGRESS.md
2. Use commit format: `[SC] Task: Description`
3. Document any gotchas for future reference

## 🔧 Quick Commands

```bash
# Test all scrapers
npm run test:scrapers

# Benchmark performance
npm run benchmark:scrapers

# Check scraper health
npm run scrapers:health

# Analyze code duplication
npm run analyze:duplication src/lib/scrapers
```

## 💡 Consolidation Strategy

### From This (BAD):
```typescript
// 4 different base classes
class BaseScraper { /* 300 lines */ }
class FastBaseScraper extends BaseScraper { /* 200 lines, 80% duplicate */ }
class FastBaseScraperQueue extends BaseScraper { /* 250 lines, 80% duplicate */ }
class FastBaseScraperStreaming extends BaseScraper { /* 200 lines, 80% duplicate */ }

// Plus duplicate implementations
class RealEstateScraper extends BaseScraper { }
class FastRealEstateScraper extends FastBaseScraper { }
// ... more duplicates
```

### To This (GOOD):
```typescript
// Single configurable base
class UnifiedScraper {
  constructor(private strategy: ScrapingStrategy, private config: Config) {}
}

// Site-specific strategies
class RealEstateStrategy implements ScrapingStrategy {
  // Only site-specific logic
}

// Clean factory
ScraperFactory.create('realestate', { mode: 'performance' });
```

## 🚨 Critical Reminders

- Don't break existing functionality
- Maintain current performance levels
- Test against real websites carefully
- Respect rate limits and robots.txt
- Keep proxy configuration working

## 📊 Success Metrics

Your refactoring is successful when:
- Code reduced by 60%+ 
- All tests pass
- Performance maintained or improved
- Adding new scrapers is trivial
- No more "fast" vs "normal" confusion

## ⚡ Performance Notes

The "fast" scrapers aren't actually faster - they just:
- Use more concurrent connections
- Have shorter timeouts
- Skip some error handling

Implement these as configuration options, not separate classes!

## 📞 Communication

- **Found issues?** Document in analysis
- **Breaking change?** Update contracts
- **Performance impact?** Run benchmarks
- **Need clarification?** Ask in progress file

---
*4 scrapers enter, 1 scraper leaves. Make it clean! 🧹*