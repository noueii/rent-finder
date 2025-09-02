# CLAUDE.md - Agent Guidelines for Tokyo Rent Finder

## Project Overview

You are working on **Tokyo Rent Finder**, a web application that revolutionizes apartment searching in Tokyo by allowing users to find rentals based on commute time rather than just location. This is a local project that should remain simple and avoid over-engineering.

### Core Concept
Users can input their workplace/school station and maximum acceptable commute time, then discover all available apartments within that commute range, complete with pricing and property details.

## Project Structure

```
rent-finder/
├── .agents/shared/          # Project documentation (YOU ARE HERE)
│   ├── CLAUDE.md           # This file - your guide
│   ├── PRD.md              # Product requirements
│   ├── PLANNING.md         # Technical planning
│   ├── TASKS.md            # Task breakdown
│   └── SESSION.md          # Development session logs
├── lines/                   # Transit data (existing CLI tool)
│   ├── line_data/          # Individual train line data
│   ├── station_data.json   # All stations information
│   └── *.js                # Transit calculation scripts
├── web/                     # Next.js web application
│   └── src/app/api/trpc/   # tRPC API setup
├── apts.jp/                # Existing scraper example
└── html-converter-realestate/ # Another scraper example
```

## Understanding the Codebase

### 1. Transit System (Already Implemented)
- **Location**: `/lines/` directory
- **Key Files**:
  - `station_data.json` - All Tokyo stations
  - `tokyo_transit_graph_complete.json` - Transit connections
  - `query_reachability.js` - Find reachable stations
- **Purpose**: Calculate which stations are reachable within X minutes

### 2. Existing Scrapers (Reference Implementation)
- **apts.jp scraper**: `/apts.jp/extract.js`
- **Real estate HTML converter**: `/html-converter-realestate/extract.py`
- **Purpose**: Examples of how apartment data has been scraped

### 3. Web Application (Partially Set Up)
- **Location**: `/web/` directory
- **Framework**: Next.js with tRPC
- **Status**: Basic structure exists, needs apartment search features

## Development Workflow

### Before Starting Any Task

1. **Read Current Status**:
   ```bash
   # Check SESSION.md for latest progress
   cat .agents/shared/SESSION.md
   ```

2. **Understand the Task**:
   ```bash
   # Review what needs to be done
   cat .agents/shared/TASKS.md
   ```

3. **Check Existing Code**:
   - Always search for existing implementations before creating new files
   - Reuse patterns from existing scrapers
   - Follow the project's coding style

### When Working on Features

1. **Database/Models**:
   - Keep it simple with SQLite
   - Use the data models defined in PLANNING.md
   - Store apartment data with station associations

2. **Scraping**:
   - Study existing scrapers first
   - Respect robots.txt and rate limits
   - Only scrape on user request (no background jobs initially)

3. **API Development**:
   - Extend the existing tRPC setup
   - Keep endpoints focused and simple
   - Integrate with the transit calculator

4. **UI Components**:
   - Follow Next.js patterns in the web directory
   - Keep the interface clean and functional
   - Focus on search and results display

## Documentation Updates

### After Each Session

1. **Update SESSION.md**:
   ```markdown
   ### Session XXX - [Your Focus Area]
   **Date**: [Today's Date]
   **Duration**: [Time Spent]
   **Focus Area**: [What You Worked On]
   
   **Completed**:
   - ✅ [Completed tasks]
   
   **In Progress**:
   - 🔄 [Ongoing work]
   
   **Blockers**:
   - [Any issues encountered]
   
   **Next Steps**:
   1. [Priority items for next session]
   ```

2. **Update TASKS.md**:
   - Check off completed tasks
   - Add any new tasks discovered
   - Update progress percentages

3. **Update Status in SESSION.md**:
   - Update the Module Status table
   - Increment session count and dev time
   - Note any important decisions

### When Making Architectural Changes

1. **Update PLANNING.md** if you:
   - Change the technology stack
   - Modify data models
   - Alter the architecture

2. **Update PRD.md** if you:
   - Add/remove features
   - Change project scope
   - Modify success criteria

## Key Implementation Guidelines

### Do's ✅
- **Keep it simple** - This is a local project
- **Reuse existing code** - Especially transit calculations
- **Test incrementally** - Verify each component works
- **Document decisions** - Update SESSION.md
- **Follow patterns** - Use existing code as reference

### Don'ts ❌
- **Don't over-engineer** - No microservices, no complex infra
- **Don't scrape aggressively** - Respect rate limits
- **Don't store sensitive data** - No user credentials
- **Don't reinvent the wheel** - Use existing transit logic
- **Don't skip documentation** - Keep SESSION.md current

## Quick Command Reference

```bash
# Run existing transit query tool
node lines/query_reachability.js

# Check web app
cd web && npm run dev

# View station data structure
cat lines/station_data.json | head -50

# See scraper examples
cat apts.jp/extract.js
cat html-converter-realestate/extract.py
```

## Common Tasks

### Starting a New Feature
1. Read relevant docs (PRD, PLANNING, TASKS)
2. Check existing implementations
3. Update SESSION.md with your plan
4. Implement incrementally
5. Test your changes
6. Update documentation

### Debugging Transit Data
1. Check `lines/station_data.json` for station info
2. Use `query_reachability.js` to test connections
3. Verify line data in `lines/line_data/`

### Adding a New Scraper
1. Study existing scrapers in `/apts.jp/` and `/html-converter-realestate/`
2. Follow the same patterns for consistency
3. Add proper error handling
4. Implement rate limiting
5. Store data in consistent format

## Remember

This project helps people find apartments based on what really matters - their daily commute. Keep the user's needs in focus, maintain simplicity, and build something that works reliably. The existing transit data is solid; your job is to connect it with real apartment listings to create value.

Good luck! 🚀