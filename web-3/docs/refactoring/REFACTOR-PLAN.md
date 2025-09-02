# Tokyo Apartment Finder - Master Refactoring Plan

## 🎯 Refactoring Objectives

### Primary Goals
1. **Eliminate Code Duplication**: Reduce codebase by 30% through DRY principles
2. **Apply SOLID Principles**: Restructure architecture for maintainability
3. **Simplify Complexity**: Remove over-engineering per KISS/YAGNI
4. **Implement Design Patterns**: Use appropriate patterns for common problems
5. **Enable Testing**: Create testable architecture with 80% coverage target

### Success Metrics
- Cyclomatic Complexity: < 10 per function
- Code Duplication: < 5% (measured by tools)
- Type Coverage: 100% (no `any` types)
- Bundle Size: 25% reduction
- Test Coverage: 80% for business logic

## 🏗️ Architecture Overview

### Current Issues
1. **SOLID Violations**
   - SRP: Components handling multiple responsibilities
   - OCP: Hard-coded logic requiring modification for extensions
   - DIP: Direct dependencies on concrete implementations

2. **DRY Violations**
   - 4 different base scraper classes (80% overlap)
   - Duplicate router implementations
   - Repeated error handling patterns

3. **Complexity Issues**
   - Over-engineered performance module
   - Multiple proxy manager implementations
   - Premature optimization with "fast" scrapers

### Target Architecture
```
src/
├── domain/           # Business entities & rules (BE)
│   ├── entities/
│   ├── repositories/
│   └── services/
├── application/      # Use cases & workflows (BE/IN)
│   ├── use-cases/
│   └── dto/
├── infrastructure/   # External dependencies (DO/SC)
│   ├── database/
│   ├── scrapers/
│   └── external/
├── presentation/     # UI layer (FE)
│   ├── components/
│   ├── pages/
│   └── hooks/
└── core/            # Shared utilities (DO)
    ├── errors/
    ├── validation/
    └── di/
```

## 📅 Implementation Phases

### Phase 1: Foundation (Week 1)
**Lead**: DO (DevOps Agent)
**Goal**: Establish core patterns and utilities

Key Deliverables:
- Core utility modules
- Error handling framework
- Validation schemas
- DI container setup
- Testing infrastructure

### Phase 2: Data Layer (Week 2)
**Lead**: BE (Backend Agent)
**Goal**: Implement clean data access

Key Deliverables:
- Repository interfaces
- Service layer extraction
- Router consolidation
- Business logic separation

### Phase 3: Scraper System (Week 2-3)
**Lead**: SC (Scraper Agent)
**Goal**: Simplify scraper architecture

Key Deliverables:
- Unified base scraper
- Strategy pattern implementation
- Proxy manager consolidation
- Performance mode unification

### Phase 4: UI Refactoring (Week 3)
**Lead**: FE (Frontend Agent)
**Goal**: Component responsibility separation

Key Deliverables:
- Split complex components
- Extract business logic
- Implement presentation pattern
- Create reusable UI primitives

### Phase 5: Integration & Testing (Week 4)
**Lead**: IN (Integration Agent) + All
**Goal**: System integration and quality assurance

Key Deliverables:
- Integration tests
- Performance optimization
- Documentation updates
- Migration completion

## 🤝 Agent Coordination

### Communication Channels
1. **Progress Updates**: `REFACTOR-PROGRESS.md`
2. **Interface Changes**: `REFACTOR-CONTRACTS.md`
3. **Blockers**: Update progress file with ⚠️ BLOCKER
4. **Code Reviews**: PR comments with agent tags

### Ownership Matrix
| Module | Primary | Secondary | Notes |
|--------|---------|-----------|-------|
| src/core/* | DO | - | Shared utilities |
| src/domain/* | BE | - | Business logic |
| src/application/* | BE | IN | Use cases |
| src/infrastructure/database/* | BE | DO | Data access |
| src/infrastructure/scrapers/* | SC | - | Web scraping |
| src/infrastructure/external/* | IN | - | External APIs |
| src/presentation/* | FE | - | UI components |

### Conflict Resolution
1. **File Conflicts**: Primary owner has final say
2. **Interface Changes**: Requires approval from consumers
3. **Breaking Changes**: Must be coordinated in advance
4. **Emergency Fixes**: Can override ownership with documentation

## 🔧 Technical Guidelines

### Code Standards
```typescript
// File naming
- PascalCase for components and classes
- camelCase for functions and files
- kebab-case for directories

// Imports
- Absolute imports for src/*
- Relative imports within module
- Barrel exports for public API

// Types
- No any types
- Explicit return types
- Interface over type when possible
```

### Git Workflow
```bash
# Branch naming
refactor/[agent]-[task-name]

# Commit format
[AGENT-TYPE] Task: Description

# Examples
[DO] Core: Add error handling utilities
[BE] Data: Implement repository pattern
[SC] Scrapers: Merge base classes
[FE] UI: Split ApartmentCard component
[IN] Perf: Simplify caching strategy
```

### Testing Requirements
- Unit tests for all business logic
- Integration tests for API endpoints
- Component tests for complex UI
- E2E tests for critical paths
- Minimum 80% coverage for new code

## 📊 Risk Management

### High Risk Areas
1. **Database Schema Changes**: Coordinate migrations carefully
2. **API Contract Changes**: Version appropriately
3. **Scraper Modifications**: Test thoroughly against live sites
4. **Authentication Changes**: Ensure backward compatibility

### Mitigation Strategies
1. **Feature Flags**: Toggle new implementations
2. **Parallel Running**: Keep old code during transition
3. **Incremental Migration**: Move piece by piece
4. **Rollback Plan**: Document reversion steps

## ✅ Definition of Done

A refactoring task is complete when:
1. ✅ Code implements the planned changes
2. ✅ All tests pass (new and existing)
3. ✅ No type errors or linting issues
4. ✅ Documentation is updated
5. ✅ Progress tracker is updated
6. ✅ Code review is approved
7. ✅ Performance metrics are maintained or improved

## 🚀 Getting Started

### For New Agents
1. Read this plan completely
2. Check your agent-specific file: `docs/refactoring/agents/AGENT-[TYPE].md`
3. Review current progress: `REFACTOR-PROGRESS.md`
4. Understand interfaces: `REFACTOR-CONTRACTS.md`
5. Check dependencies: `REFACTOR-DEPENDENCIES.md`
6. Start with your highest priority task

### Daily Workflow
1. **Morning**: Check progress and blockers
2. **Before Work**: Pull latest changes
3. **During Work**: Update progress incrementally
4. **After Task**: Run tests and update docs
5. **End of Day**: Push changes and update status

---
*Last Updated: 2025-01-24*
*Refactoring Lead: System Architect*
*Status: ACTIVE*