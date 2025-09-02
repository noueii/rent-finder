# Product Requirements Document (PRD)
## Tokyo Rent Finder

### Version 1.0
**Last Updated**: 2025-07-15
**Status**: In Development

---

## Executive Summary

Tokyo Rent Finder is a web application that revolutionizes apartment searching in Tokyo by prioritizing commute time over location. Users can find all available rental properties within their acceptable commute time from their workplace or school, making the apartment hunting process more practical and efficient.

## Problem Statement

Current apartment search platforms in Tokyo focus on location-based searches, requiring users to:
- Manually check commute times for each listing
- Limit searches to specific areas they already know
- Miss potentially perfect apartments in unfamiliar areas
- Spend hours cross-referencing train routes with apartment listings

## Solution

A web application that:
1. Takes a target station (workplace/school) and maximum commute time as input
2. Calculates all reachable stations within that time (using existing CLI tool)
3. Searches for available apartments near those stations
4. Presents results with commute details and property information

## Current Implementation Status

### ✅ Completed
- **Transit Calculation Engine**: Fully functional CLI tool
  - 1,168 Tokyo stations in database
  - Complete train line connections
  - Walking transfer support
  - Query tool for reachable stations

### 🚧 In Progress
- **Web Application**: Basic structure exists
  - tRPC route configured
  - Needs full Next.js setup

### ❌ Not Started
- Database schema and setup
- Apartment data scraping integration
- User interface components
- Search functionality
- API endpoints

## Target Users

### Primary Users
- **Young professionals** starting new jobs in Tokyo
- **University students** looking for apartments near campus
- **Families** relocating for work or school
- **Foreign residents** unfamiliar with Tokyo's geography

### User Personas

1. **Satoshi** - 24, new graduate
   - Just got a job in Shibuya
   - Wants max 30-minute commute
   - Budget: ¥80,000/month
   - Unfamiliar with Tokyo neighborhoods

2. **Emma** - 28, English teacher
   - Works in multiple locations
   - Needs good connections to Shinjuku and Ikebukuro
   - Prefers quieter residential areas
   - Budget: ¥100,000/month

## Core Features

### MVP (Minimum Viable Product)

1. **Commute-Based Search**
   - Input: Target station + max commute time
   - Output: All apartments within range
   - Show exact commute time for each result
   - Leverage existing transit calculation tool

2. **Property Listings**
   - Basic details: Rent, size, room layout
   - Photos (when available)
   - Distance from nearest station
   - Direct link to original listing

3. **Search Filters**
   - Rent range
   - Property type (apartment/mansion)
   - Room layout (1K, 1LDK, etc.)
   - Building age

4. **Results Display**
   - List view with key details
   - Sort by: commute time, rent, size
   - Clear commute information for each listing

### Future Enhancements (v2)

1. **Multiple Destination Support**
   - Add multiple workplaces/schools
   - Find optimal locations for couples

2. **Advanced Filters**
   - Pet-friendly
   - Specific amenities
   - Floor preferences

3. **Map Visualization**
   - Show properties on map
   - Commute route visualization
   - Neighborhood information

4. **User Accounts**
   - Save searches
   - Track viewed properties
   - Get alerts for new listings

## Technical Architecture

### Current Assets
1. **Transit Data** (✅ Complete)
   - `/lines/` directory with all data
   - `query_reachability.js` - Working query tool
   - Complete documentation

2. **Example Scrapers** (✅ Reference)
   - `apts.jp/extract.js` - JavaScript implementation
   - `html-converter-realestate/extract.py` - Python implementation

3. **Web Framework** (🚧 Minimal)
   - Next.js with tRPC route
   - Needs proper initialization

### Technology Stack (Planned)
- **Frontend**: Next.js, React, TypeScript
- **Backend**: Next.js API routes, tRPC
- **Database**: PostgreSQL (per Makefile) or SQLite
- **ORM**: Prisma (recommended)
- **Scraping**: Node.js with jsdom (existing dependency)

### Data Flow
1. User inputs station and commute time
2. Frontend sends request to API
3. API calls transit calculation tool
4. API queries database for apartments near reachable stations
5. Results returned with commute details
6. Frontend displays sorted results

## Implementation Phases

### Phase 1: Foundation Setup ⬅️ CURRENT
- [ ] Initialize Next.js project properly
- [ ] Set up TypeScript configuration
- [ ] Create database schema
- [ ] Set up ORM and migrations

### Phase 2: Core Backend
- [ ] Integrate transit calculation tool
- [ ] Create apartment data models
- [ ] Build scraping service
- [ ] Implement search API

### Phase 3: Frontend Development
- [ ] Create search interface
- [ ] Build results display
- [ ] Implement filters
- [ ] Add responsive design

### Phase 4: Polish & Launch
- [ ] Performance optimization
- [ ] Error handling
- [ ] User testing
- [ ] Documentation

## Success Metrics

### Technical Metrics
- Transit calculations: < 2 seconds
- Search results: < 5 seconds
- Database queries: < 500ms
- Page load: < 3 seconds

### User Metrics
- Find suitable apartment in < 10 searches
- 80% of users find results helpful
- 50% reduction in apartment hunting time

## Constraints & Considerations

### Technical
- Use existing transit calculation system as-is
- Respect website scraping limits
- Keep initial version simple
- Local deployment first

### Legal
- Comply with real estate site terms
- Provide clear attribution
- No personal data storage initially

### Resource
- Single developer project
- No paid APIs initially
- Use free/open source tools

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|---------|------------|
| Scraping blocks | High | Multiple sources, rate limiting |
| Data accuracy | Medium | Regular validation, user reports |
| Performance issues | Medium | Caching, query optimization |
| Limited apartment data | High | Start with major sites, expand gradually |

## Next Steps

1. **Immediate** (This Week)
   - Set up Next.js project properly
   - Design database schema
   - Create basic API structure

2. **Short Term** (Next 2 Weeks)
   - Integrate transit calculations
   - Build first scraper
   - Create basic UI

3. **Medium Term** (Month 1)
   - Complete MVP features
   - Test with real data
   - Gather feedback

## Conclusion

Tokyo Rent Finder solves a real problem for anyone searching for apartments in Tokyo. By leveraging the existing transit calculation system and building a focused web application around it, we can deliver immediate value while keeping the project scope manageable. The phased approach ensures we can launch quickly and iterate based on user feedback.