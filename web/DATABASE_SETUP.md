# Database Setup Guide - Tokyo Rent Finder

## Overview

This guide documents the database setup for the Tokyo Rent Finder application. The database is configured to use SQLite for development and can be easily switched to PostgreSQL for production.

## Database Configuration

### Current Setup
- **Database Type**: SQLite (for development)
- **Database File**: `./rent-finder.db`
- **ORM**: Prisma
- **Station Data**: 1,190 unique stations imported from transit system

### Files Structure
```
web/
├── prisma/
│   ├── schema.prisma          # Database schema definition
│   ├── seed.ts                # Data seeding script
│   └── migrations/            # Database migrations (if using PostgreSQL)
├── lib/
│   └── db.ts                  # Database connection and utilities
├── scripts/
│   ├── verify-database.ts     # Database verification script
│   └── test-database-operations.ts  # Database testing script
├── .env                       # Environment variables
└── rent-finder.db             # SQLite database file (generated)
```

## Initial Setup

### 1. Install Dependencies
```bash
cd web
npm install
```

### 2. Environment Configuration
Ensure your `.env` file contains:
```env
DATABASE_URL="file:./rent-finder.db"
NODE_ENV="development"
SEED_SAMPLE_DATA="true"
```

### 3. Generate Prisma Client
```bash
npx prisma generate
```

### 4. Create Database and Tables
```bash
npx prisma db push
```

### 5. Import Station Data
```bash
npx prisma db seed
```

## Database Schema

### Core Models

#### Station
- **Purpose**: Stores all Tokyo train stations
- **Key Fields**: `id`, `name`, `nameJa`, `lines`, `transfers`
- **Data Source**: `/lines/station_data.json`
- **Records**: 1,190 unique stations

#### Apartment
- **Purpose**: Stores apartment listings
- **Key Fields**: `sourceUrl`, `title`, `rentMonthly`, `stationId`, `walkingMinutes`
- **Features**: JSON fields for features, images, and additional stations
- **Indexing**: Optimized for rent/size filtering and station-based queries

#### Search
- **Purpose**: Analytics and search history
- **Key Fields**: `targetStationId`, `maxCommuteMinutes`, `totalResults`
- **Usage**: Track user searches and system performance

### Supporting Models
- **PriceHistory**: Track apartment price changes over time
- **SearchStation**: Many-to-many relationship for search results
- **SearchResult**: Detailed search result tracking
- **ScrapeJob**: Scraping job management
- **User**: Future user account features
- **SavedSearch**: User's saved search queries
- **Favorite**: User's favorite apartments

## Database Utilities

### Basic Operations
```typescript
import { db, dbUtils } from './lib/db';

// Find stations by name
const stations = await dbUtils.findStations('Tokyo');

// Get station by ID
const station = await dbUtils.getStationById('00006668');

// Search apartments
const results = await dbUtils.searchApartments({
  stationIds: ['00006668'],
  maxPrice: 200000,
  limit: 20
});

// Record search for analytics
await dbUtils.recordSearch({
  targetStationId: '00006668',
  targetStationName: 'Tokyo',
  maxCommuteMinutes: 30,
  stationsSearched: 50,
  totalResults: 25,
  resultsReturned: 20
});
```

### Advanced Operations
```typescript
// Get all stations with apartment counts
const allStations = await dbUtils.getAllStationsWithCounts();

// Get apartments by station
const apartments = await dbUtils.getApartmentsByStation('00006668');

// Upsert apartment data (for scrapers)
await dbUtils.upsertApartment({
  sourceUrl: 'https://example.com/apartment/123',
  sourceSite: 'example.com',
  title: 'Example Apartment',
  buildingName: 'Example Building',
  rentMonthly: 120000,
  size: 25.5,
  layout: '1K',
  address: 'Tokyo, Japan',
  stationId: '00006668',
  walkingMinutes: 5,
  features: ['Air Conditioning', 'Balcony'],
  // ... other fields
});

// Get dashboard statistics
const stats = await dbUtils.getDashboardStats();
```

## Data Integrity

### Station Data Verification
The station data has been verified to ensure:
- ✅ All 1,190 stations imported correctly
- ✅ Station IDs match the existing transit system
- ✅ Station names (English and Japanese) are accurate
- ✅ Line assignments are correct
- ✅ Transfer information is complete

### Key Station Examples
- **Tokyo Station**: ID `00006668`, 10 lines, 13 transfers
- **Kanda Station**: ID `00004464`, 5 lines, 8 transfers
- **Shibuya Station**: Multiple entries for different lines

## Performance Considerations

### Indexing
- Station searches indexed on `name` and `nameJa`
- Apartment searches indexed on `stationId + rentMonthly`
- Search analytics indexed on `createdAt`

### JSON Field Handling
Since we're using SQLite, complex fields are stored as JSON strings:
- `lines`: Array of line names
- `transfers`: Array of transfer options
- `features`: Array of apartment features
- `additionalStations`: Array of nearby stations

## Migration to PostgreSQL

To switch from SQLite to PostgreSQL:

1. **Update schema.prisma**:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

2. **Update environment variables**:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/rent-finder"
```

3. **Change JSON fields back to native JSON**:
```prisma
lines         Json      // Change from String to Json
transfers     Json?     // Change from String to Json
features      String[]  // Change from String to String[]
```

4. **Update database utilities** to handle native JSON/arrays instead of JSON strings.

## Testing

### Verification Scripts
- **Database Verification**: `npx tsx scripts/verify-database.ts`
- **Operations Testing**: `npx tsx scripts/test-database-operations.ts`

### Manual Testing
```bash
# Connect to database
npx prisma studio

# Check station count
npx prisma db seed --preview-feature
```

## Backup and Maintenance

### Backup
```bash
# SQLite backup
cp rent-finder.db rent-finder-backup-$(date +%Y%m%d).db

# PostgreSQL backup
pg_dump rent-finder > backup.sql
```

### Maintenance
```typescript
// Clean up old searches
const deletedCount = await dbUtils.cleanupOldSearches(30);

// Get apartments needing verification
const needsVerification = await dbUtils.getApartmentsNeedingVerification(7);
```

## Troubleshooting

### Common Issues

1. **"Database locked" errors**
   - Stop all running processes
   - Restart the application

2. **Schema validation errors**
   - Run `npx prisma generate` after schema changes
   - Check for syntax errors in `schema.prisma`

3. **Seed script failures**
   - Verify `/lines/station_data.json` exists
   - Check for duplicate data conflicts

### Debug Commands
```bash
# Check database status
npx prisma studio

# Reset database (WARNING: destroys data)
npx prisma db push --force-reset

# Generate new client
npx prisma generate

# View logs
tail -f .env
```

## Production Considerations

### Security
- Use environment variables for database credentials
- Enable SSL connections for PostgreSQL
- Implement proper access controls

### Performance
- Monitor query performance with Prisma logging
- Consider connection pooling for high traffic
- Regular database maintenance and vacuuming

### Scaling
- Implement read replicas for search queries
- Consider caching for frequently accessed data
- Monitor database size and implement archiving

## Contact

For database-related issues or questions about the setup, refer to the project documentation or contact the development team.

---

*Last Updated: 2025-07-15*
*Database Version: SQLite with 1,190 stations*