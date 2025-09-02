# Technical Planning Document
## Tokyo Apartment Finder

### 1. Architecture Overview

#### System Architecture
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Next.js App   │────▶│   tRPC Router    │────▶│  PostgreSQL DB  │
│  (Frontend/API) │     │   (API Layer)    │     │   (via Docker)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │                         │
         │                       │                         │
         ▼                       ▼                         ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  shadcn/ui +    │     │   OTP Service    │     │   Scrapers      │
│  motion.dev     │     │ (Route Calc)     │     │  (Admin Only)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

#### Request Flow
1. **Standard Search**: Client → tRPC → DB → Response
2. **Commute Search**: Client → tRPC → Create List → Background Job → OTP → Update List
3. **Browse**: Client → tRPC → Get List Item → Response
4. **Scraping**: Admin Panel → tRPC → Scraper → Parse → DB

### 2. Technology Stack Details

#### Core Stack (T3)
- **Next.js 14**: App Router, Server Components
- **TypeScript**: Type safety throughout
- **tRPC**: Type-safe API layer
- **Prisma**: ORM for PostgreSQL
- **NextAuth.js**: Authentication
- **Tailwind CSS**: Styling

#### Additional Libraries
- **shadcn/ui**: Component library
- **motion.dev**: Animations
- **axios/fetch**: HTTP requests for scraping
- **cheerio**: HTML parsing for scrapers
- **React Query**: Data fetching (via tRPC)
- **Zod**: Schema validation

#### Infrastructure
- **PostgreSQL**: Main database (Docker)
- **Docker**: Database containerization
- **Git**: Version control

### 3. Project Documentation Structure

```
docs/
├── README.md                    # Quick start guide
├── architecture/
│   ├── system-overview.md      # High-level architecture
│   ├── data-flow.md           # How data moves through system
│   └── diagrams/              # Architecture diagrams
├── api/
│   ├── endpoints.md           # API endpoint documentation
│   ├── schemas.md             # Request/response schemas
│   └── examples.md            # API usage examples
├── mockups/
│   ├── landing-page.png       # UI mockups
│   ├── search-flow.png
│   ├── browse-interface.png
│   └── admin-panel.png
├── examples/
│   ├── scraper-template.js    # Example scraper code
│   ├── component-example.tsx  # Component patterns
│   └── trpc-procedure.ts      # tRPC examples
└── references/
    ├── transit-data.md        # Info about station/line data
    ├── scraping-sites.md      # Details about each site
    └── tech-decisions.md      # Why we chose certain tools
```

### 4. Database Schema

```prisma
// Core Models
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  preferences   UserPreference?
  lists         List[]
  searchSessions SearchSession[]
}

model UserPreference {
  id              String   @id @default(cuid())
  userId          String   @unique
  user            User     @relation(fields: [userId], references: [id])
  
  maxCommute      Int?     // in minutes
  preferredStations String[] // station IDs
  priceRange      Json?    // {min, max}
  sizeRange       Json?    // {min, max}
  savedFilters    Json?    // saved search configurations
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model Apartment {
  id              String   @id @default(cuid())
  externalId      String   // ID from source website
  sourceUrl       String
  sourceSite      String   // which scraping source
  
  title           String
  price           Int      // monthly rent in yen
  size            Float    // in m²
  layout          String?  // 1K, 1LDK, etc. (optional)
  floor           Int?
  totalFloors     Int?
  buildingAge     Int?     // years
  
  address         String
  latitude        Float?
  longitude       Float?
  
  description     String?  @db.Text
  amenities       String[] // array of amenity tags
  availability    String   // available, occupied, unknown
  
  images          ApartmentImage[]
  lists           ApartmentList[]
  routes          Route[]
  nearestStations ApartmentStation[]
  
  scrapedAt       DateTime
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@unique([externalId, sourceSite])
}

model ApartmentStation {
  id              String    @id @default(cuid())
  apartmentId     String
  apartment       Apartment @relation(fields: [apartmentId], references: [id])
  stationId       String
  station         Station   @relation(fields: [stationId], references: [id])
  
  walkingMinutes  Int       // walking time to this station
  distance        Float?    // distance in meters
  
  @@unique([apartmentId, stationId])
}

model ApartmentImage {
  id          String    @id @default(cuid())
  apartmentId String
  apartment   Apartment @relation(fields: [apartmentId], references: [id])
  
  url         String
  caption     String?
  order       Int       @default(0)
  
  createdAt   DateTime  @default(now())
}

model Station {
  id          String    @id @default(cuid())
  name        String
  nameEn      String?
  latitude    Float
  longitude   Float
  
  lines       StationLine[]
  apartments  ApartmentStation[]
  
  @@unique([name, latitude, longitude])
}

model TrainLine {
  id          String    @id @default(cuid())
  name        String
  nameEn      String?
  company     String
  color       String?   // hex color for UI
  
  stations    StationLine[]
  
  @@unique([name, company])
}

model StationLine {
  stationId   String
  station     Station   @relation(fields: [stationId], references: [id])
  lineId      String
  line        TrainLine @relation(fields: [lineId], references: [id])
  
  order       Int       // order on this line
  
  @@id([stationId, lineId])
}

model List {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  
  name        String
  type        ListType  // SEARCH_RESULT, BOOKMARKED, LIKED, FAVORITED, HIDDEN
  isPublic    Boolean   @default(false)
  
  // For search result lists
  searchParams Json?    // original search parameters
  status      String?   // pending, processing, completed
  progress    Int?      // 0-100
  
  apartments  ApartmentList[]
  
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model ApartmentList {
  apartmentId String
  apartment   Apartment @relation(fields: [apartmentId], references: [id])
  listId      String
  list        List      @relation(fields: [listId], references: [id])
  
  addedAt     DateTime  @default(now())
  seen        Boolean   @default(false)
  seenAt      DateTime?
  
  @@id([apartmentId, listId])
}

model Route {
  id          String    @id @default(cuid())
  apartmentId String
  apartment   Apartment @relation(fields: [apartmentId], references: [id])
  
  toStation   String    // destination station ID
  
  duration    Int       // total minutes (including walk from apartment)
  transfers   Int       // number of transfers
  walkTime    Int       // walking minutes included
  trainTime   Int       // actual train time
  
  routeData   Json      // detailed route from OTP
  
  calculatedAt DateTime @default(now())
  
  @@unique([apartmentId, toStation])
}

model SearchSession {
  id          String    @id @default(cuid())
  userId      String?
  user        User?     @relation(fields: [userId], references: [id])
  
  filters     Json      // all search parameters
  resultCount Int?
  listId      String?   // if commute search, the generated list
  
  createdAt   DateTime  @default(now())
}

model ScrapingSource {
  id          String    @id @default(cuid())
  name        String    @unique
  baseUrl     String
  
  searchUrlTemplate String?
  detailUrlPattern  String?
  
  selectors   Json      // CSS/XPath selectors for data extraction
  headers     Json?     // custom headers if needed
  rateLimit   Int       @default(1000) // ms between requests
  
  isActive    Boolean   @default(true)
  lastScraped DateTime?
  
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

enum ListType {
  SEARCH_RESULT
  BOOKMARKED
  LIKED
  FAVORITED
  HIDDEN
}
```

### 4. Component Architecture

#### Layout Structure
```
app/
├── layout.tsx                 // Root layout with providers
├── page.tsx                   // Landing page (commute search focus)
├── search/
│   └── page.tsx              // Standard search results
├── browse/
│   └── page.tsx              // Tinder-style browsing
├── lists/
│   ├── page.tsx              // User's lists
│   └── [id]/
│       └── page.tsx          // Specific list (including progress)
├── apartments/
│   └── [id]/
│       └── page.tsx          // Apartment detail
├── admin/
│   ├── layout.tsx            // Admin layout
│   ├── page.tsx              // Dashboard
│   ├── scraping/
│   │   └── page.tsx          // Scraping management
│   └── testing/
│       └── page.tsx          // Endpoint testing
├── components/
│   └── page.tsx              // Component library showcase
└── api/
    └── trpc/
        └── [trpc]/
            └── route.ts      // tRPC handler
```

#### Component Organization
```
components/
├── ui/                       // shadcn/ui components
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   └── ...
├── apartment/
│   ├── apartment-card.tsx    // Reusable card
│   ├── apartment-gallery.tsx // Image viewer
│   ├── apartment-details.tsx // Full details
│   └── apartment-actions.tsx // Like/bookmark buttons
├── search/
│   ├── search-form.tsx       // Main search form
│   ├── filter-panel.tsx      // Advanced filters
│   ├── commute-config.tsx    // Commute setup
│   └── search-results.tsx    // Results grid
├── browse/
│   ├── browse-stack.tsx      // Card stack container
│   ├── browse-card.tsx       // Single apartment card
│   ├── browse-controls.tsx   // Swipe/button controls
│   └── browse-progress.tsx   // Progress indicator
├── lists/
│   ├── list-grid.tsx         // Lists overview
│   ├── list-item.tsx         // Single list preview
│   └── list-progress.tsx     // Search progress
└── admin/
    ├── scraper-config.tsx    // Scraper settings
    ├── scraper-status.tsx    // Running status
    └── test-panel.tsx        // API testing UI
```

### 5. API Design (tRPC)

#### Router Structure
```typescript
// src/server/api/root.ts
export const appRouter = createTRPCRouter({
  auth: authRouter,
  search: searchRouter,
  apartments: apartmentRouter,
  lists: listRouter,
  browse: browseRouter,
  admin: adminRouter,
});

// Individual routers
searchRouter = {
  // Standard search
  search: publicProcedure
    .input(searchSchema)
    .query(({ input }) => {
      // Return apartments matching filters
    }),
    
  // Initiate commute search
  searchWithCommute: protectedProcedure
    .input(commuteSearchSchema)
    .mutation(({ input }) => {
      // Create list, start background job
      // Return list ID for progress tracking
    }),
}

apartmentRouter = {
  // Get single apartment
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      // Return apartment with images
    }),
    
  // Get commute info
  getRoutes: protectedProcedure
    .input(z.object({ 
      apartmentId: z.string(),
      destinations: z.array(z.string())
    }))
    .query(({ input }) => {
      // Return calculated routes
    }),
}

listRouter = {
  // Get user's lists
  getUserLists: protectedProcedure
    .query(({ ctx }) => {
      // Return user's lists
    }),
    
  // Get list with progress
  getList: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      // Return list with apartments and progress
    }),
    
  // Add/remove from list
  addToList: protectedProcedure
    .input(z.object({
      listId: z.string(),
      apartmentId: z.string()
    }))
    .mutation(({ input }) => {
      // Add apartment to list
    }),
}

browseRouter = {
  // Get next apartment in list
  getNext: protectedProcedure
    .input(z.object({ 
      listId: z.string(),
      currentId: z.string().optional()
    }))
    .query(({ input }) => {
      // Return next unseen apartment
    }),
    
  // Mark as seen
  markSeen: protectedProcedure
    .input(z.object({
      listId: z.string(),
      apartmentId: z.string()
    }))
    .mutation(({ input }) => {
      // Update seen status
    }),
}

adminRouter = {
  // Scraping management
  getSources: adminProcedure
    .query(() => {
      // Return scraping sources
    }),
    
  startScraping: adminProcedure
    .input(z.object({ sourceId: z.string() }))
    .mutation(({ input }) => {
      // Start scraping job
    }),
    
  // Testing
  testEndpoint: adminProcedure
    .input(z.object({ 
      endpoint: z.string(),
      params: z.any()
    }))
    .mutation(({ input }) => {
      // Test API endpoint
    }),
}
```

### 6. Implementation Phases

#### Phase 1: Foundation (Week 1-2)
1. **Project Setup**
   - Initialize T3 stack
   - Configure Docker for PostgreSQL
   - Set up Prisma schema
   - Install additional dependencies

2. **Component Library**
   - Set up shadcn/ui
   - Create base components
   - Build component showcase page
   - Implement motion.dev animations

3. **Database Setup**
   - Run Prisma migrations
   - Seed station/line data
   - Create test data

#### Phase 2: Admin Panel (Week 3-4)
1. **Admin Layout**
   - Protected routes
   - Admin navigation
   - Dashboard skeleton

2. **Scraping System**
   - Scraper configuration UI
   - Scraping job management
   - Data parsing/validation
   - Error handling

3. **Testing Tools**
   - Endpoint testing UI
   - Request/response viewer
   - Performance metrics

#### Phase 3: Core Features (Week 5-8)
1. **Authentication**
   - NextAuth setup
   - User registration/login
   - Protected routes

2. **Search Implementation**
   - Standard search form
   - Filter system
   - Results display
   - Pagination

3. **Commute Search**
   - Commute configuration UI
   - Background job system
   - OTP integration
   - Progress tracking

4. **Lists Management**
   - Create/manage lists
   - Add/remove apartments
   - List views

#### Phase 4: Browse Feature (Week 9-10)
1. **Browse Interface**
   - Card stack implementation
   - Swipe gestures
   - Keyboard controls
   - Animation system

2. **Browse Logic**
   - Queue management
   - Seen tracking
   - List integration

#### Phase 5: Polish (Week 11-12)
1. **Performance**
   - Query optimization
   - Caching strategy
   - Image optimization

2. **Testing**
   - Unit tests
   - Integration tests
   - E2E tests

3. **Documentation**
   - API documentation
   - Setup guide
   - User guide

### 7. Key Technical Decisions

#### State Management
- **Server State**: React Query (via tRPC)
- **Client State**: React Context for UI state
- **Form State**: React Hook Form + Zod

#### Styling Strategy
- **Base**: Tailwind CSS
- **Components**: shadcn/ui (customized)
- **Animations**: motion.dev for complex animations
- **Theme**: CSS variables for easy customization

#### Data Fetching
- **Lists**: Paginated queries
- **Search**: Debounced input
- **Progress**: Polling for updates
- **Images**: Lazy loading

#### Security
- **Authentication**: Session-based (NextAuth)
- **Authorization**: Role-based (user/admin)
- **Data Validation**: Zod schemas
- **Rate Limiting**: For public endpoints

### 8. Development Guidelines

#### Code Organization
- **Feature-based**: Group by feature, not file type
- **Barrel Exports**: Use index.ts for clean imports
- **Shared Types**: Centralized in types/ directory

#### Naming Conventions
- **Components**: PascalCase
- **Functions**: camelCase
- **Constants**: UPPER_SNAKE_CASE
- **Files**: kebab-case

#### Git Workflow
- **Branches**: feature/*, fix/*, chore/*
- **Commits**: Conventional commits
- **PRs**: Not needed for solo project, but good practice

#### Testing Strategy
- **Unit**: For utilities and helpers
- **Integration**: For API endpoints
- **E2E**: For critical user flows
- **Visual**: For component library

### 9. Performance Considerations

#### Database
- **Indexes**: On frequently queried fields
- **Pagination**: Cursor-based for large lists
- **Caching**: Redis for future consideration

#### Frontend
- **Code Splitting**: Per route
- **Image Optimization**: Next.js Image component
- **Bundle Size**: Monitor with webpack-bundle-analyzer

#### Scraping
- **Concurrency**: Limited parallel requests
- **Caching**: Avoid re-scraping recent data
- **Error Recovery**: Retry logic with backoff

### 10. Multi-Agent Development Considerations

#### File Organization for Concurrent Development
- **Feature Isolation**: Each agent works on separate features/modules
- **Clear Boundaries**: Well-defined interfaces between modules
- **Minimal Conflicts**: Avoid overlapping file edits

#### Module Ownership
```
Agent Assignments:
├── Component Library (Agent 1)
│   ├── components/ui/*
│   ├── components/showcase/*
│   └── app/components/page.tsx
│
├── Admin Panel (Agent 2)
│   ├── app/admin/*
│   ├── components/admin/*
│   ├── server/api/routers/admin.ts
│   └── server/scrapers/*
│
├── Search Features (Agent 3)
│   ├── app/search/*
│   ├── components/search/*
│   └── server/api/routers/search.ts
│
├── Browse Feature (Agent 4)
│   ├── app/browse/*
│   ├── components/browse/*
│   └── server/api/routers/browse.ts
│
├── Authentication & Lists (Agent 5)
│   ├── app/api/auth/*
│   ├── app/lists/*
│   ├── components/lists/*
│   └── server/api/routers/lists.ts
│
├── Shared Resources (Coordinate changes)
│   ├── prisma/schema.prisma
│   ├── server/api/root.ts
│   ├── types/*
│   └── lib/utils/*
│
└── Project Documentation
    └── docs/
        ├── README.md           # Project overview
        ├── architecture/       # Architecture diagrams
        ├── api/               # API documentation
        ├── mockups/           # UI mockups/designs
        ├── examples/          # Code examples
        └── references/        # External references
```

#### Communication Protocol
1. **Shared Types**: Define interfaces early in `types/` directory
2. **API Contracts**: Document tRPC procedures before implementation
3. **Component Props**: Define prop types before building components
4. **Database Schema**: Lock schema early, use migrations for changes

#### Development Guidelines
1. **Branch Strategy**
   - Each agent uses feature branches: `agent-1/component-library`
   - Frequent commits with clear messages
   - Regular merges to avoid conflicts

2. **Code Standards**
   - ESLint/Prettier config locked
   - Consistent naming conventions
   - Comment public interfaces

3. **Testing Requirements**
   - Each module includes its own tests
   - Integration tests for module boundaries
   - Mock external dependencies

#### Conflict Prevention
1. **File Locking**
   - Shared files modified only with coordination
   - Use TODO comments for planned changes
   - Announce schema changes in advance

2. **Import Rules**
   - Use barrel exports (index.ts)
   - Avoid circular dependencies
   - Keep imports within module boundaries

3. **State Management**
   - Each feature manages its own state
   - Global state changes need coordination
   - Use tRPC for server state

### 11. Future Enhancements

#### Technical Debt
- **Testing Coverage**: Increase to 80%
- **Error Handling**: Centralized error boundary
- **Monitoring**: Add logging service

#### Feature Additions
- **Mobile App**: React Native
- **Notifications**: Email/push for new matches
- **ML Recommendations**: Based on user behavior
- **Multi-language**: i18n support

#### Infrastructure
- **CDN**: For static assets
- **Queue System**: For background jobs
- **Search Engine**: Elasticsearch for advanced search