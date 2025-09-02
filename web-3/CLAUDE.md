# CLAUDE.md - Agent Guidelines for Tokyo Apartment Finder

## 🔧 ACTIVE REFACTORING MODE

> **IMPORTANT**: A major refactoring effort is currently active. Before doing ANY work, check:
> ```bash
> cat docs/refactoring/REFACTOR-PROGRESS.md
> ```
> If refactoring is active, follow the refactoring workflow below instead of normal development.

### Refactoring Workflow
1. **Identify Your Agent Type**: FE, BE, SC, IN, or DO
2. **Check Your Tasks**: `cat docs/refactoring/agents/AGENT-[YOUR-TYPE].md`
3. **Review Contracts**: `cat docs/refactoring/REFACTOR-CONTRACTS.md`
4. **Check Dependencies**: `cat docs/refactoring/REFACTOR-DEPENDENCIES.md`
5. **Update Progress**: Always update `docs/refactoring/REFACTOR-PROGRESS.md`

### File Ownership During Refactoring
| Module | Owner | Files |
|--------|-------|-------|
| Core Infrastructure | DO | src/lib/core/*, src/lib/di/* |
| Data Layer | BE | src/server/*, src/lib/db/* |
| Scrapers | SC | src/lib/scrapers/* |
| UI Components | FE | src/components/*, src/app/* |
| Integration | IN | src/lib/transit/*, src/lib/performance/* |

**NEVER** modify files owned by other agents without coordination!

---

## Project Overview

You are working on **Tokyo Apartment Finder**, a web application that revolutionizes apartment searching in Tokyo by allowing users to find rentals based on commute time rather than just location. This is a local MVP project that should remain simple while maintaining production-ready code quality.

## Documentation Structure

All project documentation is located in the `docs/` directory:

```
docs/
├── PRD.md         - Product Requirements Document
├── PLANNING.md    - Technical Planning & Architecture  
├── TASKS.md       - Task Breakdown & Assignments
├── SESSION.md     - Development Sessions & Decisions
└── refactoring/   - ACTIVE REFACTORING PROJECT
    ├── REFACTOR-PLAN.md       - Master refactoring plan
    ├── REFACTOR-PROGRESS.md   - Real-time progress tracking
    ├── REFACTOR-CONTRACTS.md  - Interface contracts
    ├── REFACTOR-DEPENDENCIES.md - Task dependencies
    └── agents/                - Individual agent tasks
        ├── AGENT-BE.md
        ├── AGENT-FE.md
        ├── AGENT-SC.md
        ├── AGENT-IN.md
        └── AGENT-DO.md
```

## Quick Start for Agents

### 1. Identify Your Role
Check `docs/TASKS.md` to understand the 5 agent types:
- **FE** - Frontend Agent (React, UI/UX)
- **BE** - Backend Agent (tRPC, Prisma)
- **SC** - Scraper Agent (Web scraping)
- **IN** - Integration Agent (External APIs)
- **DO** - DevOps Agent (Infrastructure)

### 2. Before Starting Work

1. **Read Core Documentation**:
   ```bash
   cat docs/PRD.md      # Understand what we're building
   cat docs/PLANNING.md # Understand how we're building it
   cat docs/TASKS.md    # Find your assigned tasks
   cat docs/SESSION.md  # Check latest decisions & status
   ```

2. **Check Current Status**:
   - Review `docs/SESSION.md` for latest progress
   - Check "Structural Decisions" section for patterns to follow
   - Look for any blockers affecting your work

3. **Claim Your Task**:
   - Find available tasks for your agent type in `docs/TASKS.md`
   - Update task status to 🟦 (In Progress)
   - Start a new session in `docs/SESSION.md`

### 3. During Development

Follow these guidelines based on `docs/PLANNING.md`:

#### File Organization (Your Workspace)
```
web-3/
├── src/
│   ├── app/          # Next.js app directory
│   ├── components/   # Reusable components
│   ├── server/       # Backend logic
│   ├── lib/          # Utilities
│   └── types/        # TypeScript types
├── prisma/           # Database schema
├── public/           # Static assets
└── docs/             # All documentation
```

#### Code Standards (From SESSION.md)
- Components: `PascalCase`
- Functions: `camelCase`  
- Constants: `UPPER_SNAKE_CASE`
- Every folder needs an `index.ts` for exports
- No `any` types - be explicit

### 4. After Completing Work

1. **Update Documentation**:
   - Mark task as ✅ in `docs/TASKS.md`
   - Complete your session log in `docs/SESSION.md`
   - Document any structural decisions made

2. **Commit Pattern**:
   ```bash
   git add .
   git commit -m "[AGENT_TYPE] Task description"
   # Example: git commit -m "[FE] Implement ApartmentCard component"
   ```

## Key Technical Details

### Stack (from PLANNING.md)
- **Frontend**: Next.js 14, TypeScript, shadcn/ui, motion.dev
- **Backend**: tRPC, Prisma, PostgreSQL
- **Auth**: NextAuth.js
- **Scraping**: axios/fetch + cheerio

### Database Connection
```bash
# PostgreSQL runs in Docker
# Connection string in .env
DATABASE_URL="postgresql://user:password@localhost:5432/rentfinder"
```

### Critical Shared Resources
These require coordination (see `docs/PLANNING.md` Section 10):
- `prisma/schema.prisma` - BE owns
- `server/api/root.ts` - BE owns  
- `types/*` - BE defines, others consume
- `package.json` - Announce new dependencies

## Common Commands

```bash
# Start development
npm run dev

# Run database migrations
npx prisma migrate dev

# Open Prisma Studio
npx prisma studio

# Type checking
npm run type-check

# Linting
npm run lint
```

## Where to Find Information

### Product/Business Logic
- **What features?** → `docs/PRD.md`
- **User flows?** → `docs/PRD.md` Section 5
- **Scraping targets?** → `docs/PRD.md` Section 15.D

### Technical Implementation  
- **Architecture?** → `docs/PLANNING.md` Section 1
- **Database schema?** → `docs/PLANNING.md` Section 4
- **API design?** → `docs/PLANNING.md` Section 5
- **Component structure?** → `docs/PLANNING.md` Section 4

### Task Management
- **What to work on?** → `docs/TASKS.md`
- **Dependencies?** → `docs/TASKS.md` (check blockers)
- **Who owns what?** → `docs/PLANNING.md` Section 10

### Current State
- **Latest progress?** → `docs/SESSION.md`
- **Decisions made?** → `docs/SESSION.md` Structural Decisions
- **Known issues?** → `docs/SESSION.md` Blockers & Issues

## Important Notes

1. **This is an MVP** - Keep it simple but maintainable
2. **Agents work concurrently** - Check docs before modifying shared resources
3. **Document decisions** - Future agents need context
4. **Test your work** - Don't mark tasks complete until tested

## Need Help?

1. Check existing documentation first
2. Look for similar patterns in the codebase
3. Document questions in `docs/SESSION.md` for other agents

Remember: You're building something to help people find homes based on what matters most - their daily commute. Keep the user's needs in focus!

## Safety Guidelines

- **Build and Development Safety**:
  - NEVER RUN BUILD OR DEV. ALWAYS WAIT FOR MY CONFIRMATION

---
*Last Updated: 2025-01-24*
*Refactoring Mode: ACTIVE*