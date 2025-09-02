# CLAUDE.md - Agent Guidelines for Tokyo Rent Finder

## Project Overview

You are working on **Tokyo Rent Finder**, a web application that helps users find apartments in Tokyo based on commute time rather than just location. The project is currently in early development with the transit calculation system complete but the web application not yet built.

### Core Concept
Users can input their workplace/school station and maximum acceptable commute time, then discover all available apartments within that commute range, complete with pricing and property details.

## Current Project State

### What's Implemented ✅
1. **Transit Calculation System** - Fully functional
   - Complete station data for Tokyo
   - Transit graph with connections
   - Reachability query tool
   - Documentation and examples

2. **Example Scrapers** - Reference implementations
   - apts.jp scraper (JavaScript)
   - Real estate HTML converter (Python)
   - Sample output data

### What's NOT Implemented ❌
1. **Web Application** - Needs to be built
   - Only basic tRPC route exists
   - No UI components
   - No pages or layouts
   - Missing package.json and config files

2. **Database** - Not set up
   - Makefile references PostgreSQL
   - No schema or models defined
   - No data integration

3. **API/Backend** - Minimal
   - Only tRPC route stub
   - No apartment search endpoints
   - No integration with transit data

## Project Structure

```
rent-finder/
├── .agents/shared/          # Project documentation
│   ├── CLAUDE.md           # This file - your guide
│   ├── PRD.md              # Product requirements
│   ├── PLANNING.md         # Technical planning
│   ├── TASKS.md            # Task breakdown
│   └── SESSION.md          # Development session logs
├── lines/                   # Transit data (COMPLETE)
│   ├── line_data/          # 70+ train line JSON files
│   ├── station_data.json   # All stations (1,168 stations)
│   ├── tokyo_transit_graph_complete.json # Transit connections
│   ├── query_reachability.js # Find reachable stations
│   ├── how_to_use.md       # Transit system documentation
│   └── [various utility scripts]
├── web/                     # Next.js web app (MINIMAL)
│   └── src/app/api/trpc/   # Basic tRPC setup only
├── apts.jp/                 # Example scraper (JavaScript)
│   ├── extract.js          # Scraper implementation
│   ├── listings.json       # Sample data
│   └── listings.csv        # CSV output
├── html-converter-realestate/ # Example scraper (Python)
│   ├── extract.py          # Scraper implementation
│   └── [HTML files and output]
├── package.json            # Basic Node project setup
├── Makefile                # PostgreSQL database commands
└── prompt.txt              # Initial scraping instructions
```

## Understanding the Codebase

### 1. Transit System (✅ COMPLETE)
- **Location**: `/lines/` directory
- **Status**: Fully implemented and documented
- **Key Features**:
  - Query stations reachable within X minutes
  - Support for walking connections
  - Complete Tokyo metro/train coverage
- **Usage**: `node lines/query_reachability.js`
- **Documentation**: See `lines/how_to_use.md`

### 2. Example Scrapers (✅ REFERENCE ONLY)
- **Purpose**: Show how to extract apartment data
- **Not integrated**: These are standalone examples
- **Use as reference**: Copy patterns when building the actual scraper

### 3. Web Application (❌ NEEDS BUILDING)
- **Current state**: Only tRPC route exists
- **Required setup**:
  1. Initialize Next.js properly
  2. Create package.json with dependencies
  3. Set up TypeScript configuration
  4. Build UI components
  5. Create pages and layouts
  6. Integrate with backend

### 4. Database (❌ NOT SET UP)
- **Makefile suggests**: PostgreSQL intended
- **No schema exists**: Need to design data models
- **No ORM configured**: Need to choose and set up

## Development Priorities

### Immediate Next Steps
1. **Set up the web application properly**
   - Initialize Next.js project in /web
   - Configure TypeScript and ESLint
   - Set up basic routing

2. **Design and implement database**
   - Create schema for apartments and stations
   - Set up ORM (Prisma recommended)
   - Create migration system

3. **Build core API endpoints**
   - Search apartments by commute time
   - Get apartment details
   - List reachable stations

4. **Create basic UI**
   - Search form for station and time
   - Results display
   - Map integration (optional)

## Quick Command Reference

```bash
# Test transit calculations (WORKING)
node lines/query_reachability.js

# View station data
cat lines/station_data.json | jq '.' | head -50

# Check example scrapers
cat apts.jp/extract.js
python html-converter-realestate/extract.py

# Database setup (when ready)
make setup-db
make migrate
```

## Important Notes

1. **Transit data is production-ready** - Don't modify the /lines directory
2. **Web app needs full setup** - The /web directory is essentially empty
3. **Database decision needed** - PostgreSQL vs SQLite
4. **Scrapers are examples only** - Need integration approach
5. **No user authentication** - Keep it simple initially

## Development Guidelines

### Do's ✅
- Use the working transit system as-is
- Follow Next.js best practices
- Keep the initial version simple
- Test with real station names
- Document API endpoints

### Don'ts ❌
- Don't modify transit calculation logic
- Don't over-engineer the first version
- Don't implement auth initially
- Don't scrape without rate limiting
- Don't assume web app is set up

## Getting Started

If you're starting fresh on the web application:

1. Navigate to /web directory
2. Initialize a proper Next.js project
3. Set up the database connection
4. Create basic API endpoints
5. Build a simple search UI
6. Integrate with transit calculations

Remember: The transit system works perfectly. Your main task is building the web application and connecting it to apartment data.