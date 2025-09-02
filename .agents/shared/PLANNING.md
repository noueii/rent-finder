# Technical Planning Document
## Tokyo Rent Finder

### Version 1.0
**Last Updated**: 2025-07-15
**Status**: Planning Phase

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Web Application                       │
├─────────────────────────────────────────────────────────┤
│  Frontend (Next.js/React)                               │
│  - Search Interface                                     │
│  - Results Display                                      │
│  - Filter Controls                                      │
├─────────────────────────────────────────────────────────┤
│  Backend API (Next.js API Routes + tRPC)               │
│  - Search Endpoints                                     │
│  - Transit Integration                                  │
│  - Scraping Orchestration                               │
├─────────────────────────────────────────────────────────┤
│  Services Layer                                         │
│  ┌─────────────────┐  ┌─────────────────┐             │
│  │ Transit Service │  │ Scraper Service │             │
│  │ (Existing CLI)  │  │ (To be built)   │             │
│  └─────────────────┘  └─────────────────┘             │
├─────────────────────────────────────────────────────────┤
│  Data Layer                                             │
│  ┌─────────────────┐  ┌─────────────────┐             │
│  │ Database        │  │ Transit Data    │             │
│  │ (PostgreSQL)    │  │ (JSON files)    │             │
│  └─────────────────┘  └─────────────────┘             │
└─────────────────────────────────────────────────────────┘
```

## Current State Analysis

### ✅ What We Have
1. **Transit System** (100% Complete)
   - All Tokyo station data (1,168 stations)
   - Complete transit graph with connections
   - Working CLI tool for reachability queries
   - Comprehensive documentation

2. **Example Scrapers**
   - JavaScript scraper for apts.jp
   - Python scraper for real estate HTML
   - Sample output data

3. **Basic Web Structure**
   - Next.js directory with tRPC route
   - Project package.json with jsdom
   - Makefile with PostgreSQL setup

### ❌ What We Need
1. **Web Application**
   - Proper Next.js initialization
   - Package dependencies
   - TypeScript configuration
   - UI components

2. **Database**
   - Schema design
   - ORM setup (Prisma)
   - Migration system

3. **Integration**
   - Connect transit tool to web API
   - Scraping service
   - Search functionality

## Technology Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State**: React Query + Zustand
- **Components**: Radix UI or shadcn/ui

### Backend
- **Runtime**: Node.js
- **API**: tRPC (existing) + Next.js API Routes
- **Database**: PostgreSQL (per Makefile)
- **ORM**: Prisma
- **Validation**: Zod

### Services
- **Transit**: Existing CLI tool (query_reachability.js)
- **Scraping**: Node.js with jsdom (existing dependency)
- **Queue**: Simple in-memory for MVP

## Data Models

### Core Entities

```typescript
// Station (matches existing JSON structure)
model Station {
  id          String      @id
  name        String
  nameEn      String?
  lines       String[]
  lat         Float?
  lng         Float?
  apartments  Apartment[]
}

// Apartment listing
model Apartment {
  id             String    @id @default(cuid())
  sourceUrl      String    @unique
  sourceSite     String
  
  // Basic info
  title          String
  price          Int       // in yen
  size           Float?    // in m²
  layout         String    // "1K", "2LDK", etc.
  
  // Location
  address        String
  stationId      String
  station        Station   @relation(fields: [stationId], references: [id])
  walkingMinutes Int
  
  // Details
  buildingAge    Int?
  floor          String?
  features       String[]
  imageUrls      String[]
  
  // Metadata
  scrapedAt      DateTime  @default(now())
  lastChecked    DateTime  @default(now())
  isAvailable    Boolean   @default(true)
  
  @@index([stationId, price])
  @@index([price, size])
}

// Search history (future feature)
model Search {
  id            String   @id @default(cuid())
  targetStation String
  maxMinutes    Int
  filters       Json?
  resultsCount  Int
  createdAt     DateTime @default(now())
}
```

## API Design

### tRPC Procedures

```typescript
// Search for apartments by commute time
apartmentRouter.search = publicProcedure
  .input(z.object({
    targetStation: z.string(),
    maxCommuteMinutes: z.number().min(5).max(120),
    filters: z.object({
      maxPrice: z.number().optional(),
      minSize: z.number().optional(),
      layouts: z.array(z.string()).optional(),
    }).optional()
  }))
  .query(async ({ input }) => {
    // 1. Call transit tool to get reachable stations
    // 2. Query apartments near those stations
    // 3. Calculate exact commute for each
    // 4. Return sorted results
  });

// Get apartment details
apartmentRouter.getById = publicProcedure
  .input(z.string())
  .query(async ({ input }) => {
    // Return full apartment details
  });

// Trigger scraping (admin only)
apartmentRouter.scrape = publicProcedure
  .input(z.object({
    site: z.enum(['apts.jp', 'suumo', 'homes']),
    stationId: z.string()
  }))
  .mutation(async ({ input }) => {
    // Queue scraping job
  });
```

## Implementation Plan

### Week 1: Foundation
1. **Day 1-2**: Next.js Setup
   - Initialize project properly
   - Configure TypeScript, ESLint
   - Set up Tailwind CSS
   - Create basic layout

2. **Day 3-4**: Database
   - Set up PostgreSQL
   - Configure Prisma
   - Create schema
   - Run migrations

3. **Day 5**: Transit Integration
   - Wrap CLI tool in Node.js service
   - Create TypeScript types
   - Test integration

### Week 2: Core Features
1. **Day 1-2**: Scraping Service
   - Port apts.jp scraper to TypeScript
   - Create scraping queue
   - Implement rate limiting

2. **Day 3-4**: Search API
   - Implement search endpoint
   - Add filtering logic
   - Optimize queries

3. **Day 5**: Basic UI
   - Search form component
   - Results list
   - Loading states

### Week 3: MVP Completion
1. **Day 1-2**: UI Polish
   - Responsive design
   - Error handling
   - Filter controls

2. **Day 3-4**: Testing
   - API endpoint tests
   - UI component tests
   - End-to-end flow

3. **Day 5**: Documentation
   - API documentation
   - Setup instructions
   - User guide

## Technical Decisions

### Why PostgreSQL over SQLite?
- Makefile already has PostgreSQL setup
- Better for concurrent operations
- Full-text search capabilities
- Easy to scale later

### Why Keep Transit Tool Separate?
- Already works perfectly
- Complex logic we don't want to break
- Can be called as subprocess
- Future microservice potential

### Scraping Strategy
1. **On-demand initially**: Scrape when user searches
2. **Cache results**: Store for 24 hours
3. **Background updates**: Add scheduled scraping later
4. **Multiple sources**: Start with apts.jp, add more

## Performance Considerations

### Database Optimization
- Index on (stationId, price) for common queries
- Index on (price, size) for filtering
- Limit initial results to 50
- Use cursor pagination

### Caching Strategy
- Cache transit calculations (1 hour)
- Cache apartment searches (10 minutes)
- Use React Query for client caching
- Consider Redis for production

### Scraping Limits
- Max 1 request per second per site
- Rotate user agents
- Implement exponential backoff
- Monitor for blocks

## Security Considerations

1. **Input Validation**
   - Zod schemas for all inputs
   - Sanitize station names
   - Validate numeric ranges

2. **Rate Limiting**
   - API endpoint limits
   - Scraping throttling
   - Per-IP restrictions

3. **Data Privacy**
   - No user accounts initially
   - No personal data storage
   - Clear data retention policy

## Deployment Strategy

### Initial (Local Development)
- Next.js dev server
- Local PostgreSQL
- Manual testing

### Future (Production)
- Vercel for Next.js
- Supabase/Neon for PostgreSQL
- Cloudflare for caching
- GitHub Actions for CI/CD

## Risk Mitigation

| Risk | Mitigation Strategy |
|------|-------------------|
| Scraping blocks | Multiple sites, respect robots.txt, rate limits |
| Transit tool breaks | Keep as separate process, add error handling |
| Performance issues | Start with caching, add pagination |
| Data accuracy | Validate scraped data, user reporting |
| Scope creep | Strict MVP focus, defer features |

## Success Metrics

### Technical
- Page load < 3 seconds
- Search results < 5 seconds
- 99% uptime
- Zero critical bugs

### User
- 100+ searches in first week
- 50+ unique users
- Positive feedback
- At least 5 success stories

## Next Steps

1. **Immediate** (Today)
   - Set up Next.js project
   - Configure development environment
   - Create initial components

2. **This Week**
   - Complete database setup
   - Integrate transit tool
   - Build first API endpoint

3. **Next Week**
   - Implement scraping
   - Create search UI
   - Begin testing

---

*This is a living document. Update as implementation progresses and decisions are made.*