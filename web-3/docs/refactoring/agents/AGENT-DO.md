# DevOps Agent (DO) - Refactoring Tasks

**Agent Type**: DevOps (DO)
**Focus**: Core infrastructure, utilities, and testing
**Start Date**: Immediate (Day 1)
**Critical Path**: Yes - Blocks BE and SC

## 🎯 Your Mission

You are responsible for creating the foundational infrastructure that all other agents will build upon. Your work is critical as it blocks multiple other teams. Focus on simplicity and correctness over perfection - we can iterate later.

## 📋 Your Tasks

### Task DO-001: Core Directory Structure ⬜
**Duration**: 0.5 days
**Dependencies**: None
**Blocks**: DO-002, DO-003

Create the new directory structure:
```bash
src/
├── core/           # Your domain
│   ├── errors/
│   ├── validation/
│   ├── di/
│   ├── types/
│   └── utils/
├── domain/         # For BE
├── application/    # For BE
├── infrastructure/ # For SC/IN
└── presentation/   # For FE
```

**Acceptance Criteria**:
- [ ] All directories created
- [ ] Each has an index.ts barrel export
- [ ] Basic README.md in each explaining purpose

### Task DO-002: Error Handler ⬜
**Duration**: 1 day
**Dependencies**: DO-001
**Blocks**: BE-001, SC-002

Implement centralized error handling based on contracts:
```typescript
// src/core/errors/error-handler.ts
export class ErrorHandler implements IErrorHandler {
  // Implementation here
}
```

**Acceptance Criteria**:
- [ ] Implements interface from REFACTOR-CONTRACTS.md
- [ ] Handles operational vs programming errors
- [ ] Proper error logging with context
- [ ] Environment-aware (dev shows stack, prod doesn't)
- [ ] Unit tests with 100% coverage

### Task DO-003: Validation Schemas ⬜
**Duration**: 1 day
**Dependencies**: DO-001
**Blocks**: BE-001, SC-002

Extract and centralize validation:
1. Find all Zod schemas in codebase
2. Identify common patterns
3. Create reusable validators
4. Move to `src/core/validation/`

**Files to check**:
- src/server/api/routers/*.ts
- src/lib/validation/*.ts

**Acceptance Criteria**:
- [ ] All common schemas extracted
- [ ] Reusable schema builders created
- [ ] Type-safe validation utilities
- [ ] Migration guide for other agents

### Task DO-004: DI Container ⬜
**Duration**: 2 days
**Dependencies**: DO-002, DO-003
**Blocks**: BE-001 (Critical!)

Implement simple dependency injection:
```typescript
// src/core/di/container.ts
export class Container implements IContainer {
  // Start simple, we can enhance later
}
```

**Acceptance Criteria**:
- [ ] Implements interface from contracts
- [ ] Supports singleton and transient
- [ ] Supports scoped containers
- [ ] Clear usage examples
- [ ] Unit tests

### Task DO-005: Testing Infrastructure ⬜
**Duration**: 1 day
**Dependencies**: None
**Blocks**: IN-004

Set up testing foundation:
1. Configure Jest properly
2. Create test utilities
3. Set up test database
4. Mock factories

**Acceptance Criteria**:
- [ ] Jest configuration optimized
- [ ] Test utilities in src/core/testing/
- [ ] Database test helpers
- [ ] Coverage reporting setup
- [ ] CI integration ready

## 📁 Files You Own

```
src/core/
├── errors/
│   ├── error-handler.ts
│   ├── base-error.ts
│   ├── operational-errors.ts
│   └── index.ts
├── validation/
│   ├── schemas/
│   ├── validators.ts
│   └── index.ts
├── di/
│   ├── container.ts
│   ├── decorators.ts
│   └── index.ts
├── types/
│   ├── common.ts
│   └── index.ts
├── utils/
│   ├── logger.ts
│   ├── config.ts
│   └── index.ts
└── testing/
    ├── setup.ts
    ├── factories.ts
    └── utils.ts
```

## 🚫 Do NOT Touch

- Anything in `src/server/` (BE's domain)
- Anything in `src/components/` (FE's domain)
- Anything in `src/lib/scrapers/` (SC's domain)
- Business logic files

## 📝 Progress Tracking

After completing each task:
1. Update your status in REFACTOR-PROGRESS.md
2. Mark task as complete here with ✅
3. Notify blocked agents via progress file
4. Commit with format: `[DO] Task: Description`

## 🔧 Quick Commands

```bash
# Run your tests
npm test src/core

# Check your types
npm run type-check

# Lint your code
npm run lint src/core

# See what depends on you
grep -r "DO-" docs/refactoring/REFACTOR-DEPENDENCIES.md
```

## 💡 Tips for Success

1. **Start Simple**: Better to deliver working basics than complex broken code
2. **Document Well**: Other agents depend on understanding your code
3. **Test Everything**: Your code is the foundation
4. **Communicate**: Update progress frequently
5. **Ask Questions**: If contracts are unclear, ask in progress file

## 🚨 Critical Reminders

- You're on the critical path! BE and SC are blocked until you complete DO-004
- Keep interfaces stable - changes affect everyone
- Your error handler will be used everywhere - make it robust
- Validation schemas affect API contracts - be careful

## 📞 Communication

- **Blocked?** Update REFACTOR-PROGRESS.md immediately
- **Interface change?** Update REFACTOR-CONTRACTS.md first
- **Question?** Add to progress file with @mention
- **Complete?** Notify dependent agents

---
*You are the foundation. Build it strong! 💪*