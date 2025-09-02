# Database Architecture - Tokyo Rent Finder

## Overview

This document describes the database architecture for the Tokyo Rent Finder application, which uses PostgreSQL with Prisma ORM for type-safe database operations.

## Database Schema

### Core Entities

#### 1. Station
Stores all Tokyo train stations with metadata for commute calculations.

```typescript
model Station {
  id            String    // e.g., "00006668" (matches existing transit system)
  name          String    // English name: "Tokyo"
  nameJa        String    // Japanese name: "東京"
  lines         Json      // Array of line names
  transfers     Json?     // Available transfer lines
  latitude      Float?    // For future map features
  longitude     Float?    // For future map features
  apartments    Apartment[]
  searches      SearchStation[]
}
```

**Key Features:**
- Station IDs match the existing transit system data
- Denormalized line data for performance
- Support for bilingual search (English/Japanese)
- Geographic coordinates for future map integration

#### 2. Apartment
Primary entity for rental listings with comprehensive property details.

```typescript
model Apartment {
  id                String    // Generated CUID
  sourceUrl         String    // Original listing URL (unique)
  sourceSite        String    // "apts.jp", "suumo", etc.
  title             String    // Full property title
  buildingName      String    // Building name only
  rentMonthly       Int       // Monthly rent in JPY
  size              Float     // Size in m²
  layout            String    // "1K", "2LDK", etc.
  address           String    // Full address
  stationId         String    // Primary station (foreign key)
  walkingMinutes    Int       // Walking time to station
  features          String[]  // Array of amenities
  imageUrls         String[]  // Property images
  isAvailable       Boolean   // Current availability
  // ... additional fields
}
```

**Key Features:**
- Comprehensive property information
- Flexible features array for filtering
- Station relationship for commute calculations
- Source tracking for data management
- Price history tracking capability

#### 3. Search & Analytics
Track user searches for analytics and optimization.

```typescript
model Search {
  id                String   // Generated CUID
  targetStationId   String   // Work/school station
  maxCommuteMinutes Int      // Maximum commute time
  filters           Json?    // Applied filters
  totalResults      Int      // Number of results found
  searchDurationMs  Int?     // Performance tracking
  // ... additional fields
}
```

## Database Setup

### Prerequisites

- Docker (for PostgreSQL container)
- Node.js 18+
- npm or yarn

### Quick Setup

1. **Start the database:**
   ```bash
   make dbsetup
   ```

2. **Set up the web application:**
   ```bash
   cd web
   npm install
   cp ../.env.example .env
   ```

3. **Initialize the database schema:**
   ```bash
   make prisma-push
   ```

4. **Seed with station data:**
   ```bash
   make prisma-seed
   ```

### Development Commands

| Command | Description |
|---------|-------------|
| `make dbstart` | Start PostgreSQL container |
| `make dbstop` | Stop PostgreSQL container |
| `make dbstatus` | Check database status |
| `make dbconnect` | Connect to database via psql |
| `make prisma-studio` | Open Prisma Studio (GUI) |
| `make prisma-seed` | Seed database with station data |
| `make dev-reset` | Reset database for development |
| `make health` | Run health check |

### Production Commands

| Command | Description |
|---------|-------------|
| `make prisma-migrate` | Run migrations |
| `make dbbackup` | Create database backup |
| `make dbrestore FILE=backup.sql` | Restore from backup |

## Data Import Strategy

### Station Data
- **Source**: `/lines/station_data.json` (existing transit system)
- **Import**: Automatic via seed script
- **Volume**: ~1,168 unique stations
- **Updates**: Manual (stations rarely change)

### Apartment Data
- **Source**: Multiple scraping sources (apts.jp, suumo, etc.)
- **Import**: Via API endpoints and background jobs
- **Volume**: Expected 10,000+ listings
- **Updates**: Regular scraping (daily/weekly)

### Search Data
- **Source**: User interactions via tRPC API
- **Import**: Real-time via application
- **Volume**: Expected 1,000+ searches/day
- **Updates**: Real-time

## Performance Optimization

### Indexes
Strategic indexes for common query patterns:

```sql
-- Station search
CREATE INDEX "Station_name_idx" ON "Station"("name");
CREATE INDEX "Station_nameJa_idx" ON "Station"("nameJa");

-- Apartment search (most common)
CREATE INDEX "Apartment_stationId_rentMonthly_idx" ON "Apartment"("stationId", "rentMonthly");
CREATE INDEX "Apartment_rentMonthly_size_idx" ON "Apartment"("rentMonthly", "size");
CREATE INDEX "Apartment_isAvailable_rentMonthly_idx" ON "Apartment"("isAvailable", "rentMonthly");

-- Search analytics
CREATE INDEX "Search_targetStationId_idx" ON "Search"("targetStationId");
CREATE INDEX "Search_createdAt_idx" ON "Search"("createdAt");
```

### Query Optimization

1. **Commute-based searches**: Use station ID arrays for efficient IN queries
2. **Filtering**: Combine indexes for multi-column filters
3. **Pagination**: Cursor-based pagination for large result sets
4. **Caching**: Redis for frequently accessed data (future enhancement)

## Data Validation

### Prisma Schema Validation
- Type safety at compile time
- Required field validation
- Relationship constraints
- Enum validation for status fields

### Application Layer Validation
- Zod schemas for API inputs
- Business logic validation
- Price range validation
- Station existence checks

## Security Considerations

### Data Protection
- No sensitive user data stored (currently)
- Source URLs for audit trails
- Proper foreign key constraints
- Cascade deletes for orphaned data

### Access Control
- Database user with limited permissions
- Connection pooling for performance
- Prepared statements prevent SQL injection
- Environment variable configuration

## Monitoring & Maintenance

### Health Checks
```bash
# Database connectivity
make health

# Schema validation
make prisma-generate

# Data integrity
make dbconnect
# Then: SELECT COUNT(*) FROM "Station"; -- Should be ~1,168
```

### Backup Strategy
- Daily automated backups via `make dbbackup`
- Test restore procedures monthly
- Monitor disk space usage
- Archive old search data periodically

### Performance Monitoring
- Query performance via Prisma logs
- Index usage statistics
- Connection pool metrics
- Search response times

## Future Enhancements

### Planned Features
1. **User Accounts**: Full user management system
2. **Favorites**: Saved apartments and searches
3. **Notifications**: Email alerts for new listings
4. **Geolocation**: Map integration with coordinates
5. **Advanced Analytics**: ML-based recommendations

### Scalability Considerations
1. **Read Replicas**: For heavy read workloads
2. **Partitioning**: For large apartment datasets
3. **Caching Layer**: Redis for session data
4. **Full-text Search**: For advanced apartment search
5. **Time-series Data**: For price trend analysis

## Troubleshooting

### Common Issues

1. **Connection refused**
   ```bash
   make dbstatus  # Check if container is running
   make dbstart   # Start if stopped
   ```

2. **Schema out of sync**
   ```bash
   make prisma-generate
   make prisma-push
   ```

3. **Seed data missing**
   ```bash
   make prisma-seed
   ```

4. **Performance issues**
   ```bash
   make dbconnect
   EXPLAIN ANALYZE SELECT * FROM "Apartment" WHERE "stationId" = '00006668';
   ```

### Logs and Debugging
```bash
# Database logs
make dblogs

# Connection test
make dbconnect
\dt  # List all tables
\d "Station"  # Describe station table
```

## Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Performance](https://www.postgresql.org/docs/current/performance-tips.html)
- [Database Design Best Practices](https://www.postgresql.org/docs/current/ddl-best-practices.html)
- [Transit System Documentation](./lines/how_to_use.md)