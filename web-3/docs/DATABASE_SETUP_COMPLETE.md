# Database Setup - Complete Guide

## Current Status

The database setup is **80% complete**. All scripts and configurations are ready, but the PostgreSQL database needs to be started before migrations can be run.

## What's Been Done

### 1. Prisma Schema ✅
- Complete schema created in `prisma/schema.prisma`
- All models from PLANNING.md implemented
- Relationships properly configured

### 2. Seed Script ✅
- Created `prisma/seed.ts` with comprehensive data:
  - Imports all Tokyo stations from `docs/references/tokyo_stations_detailed.json`
  - Creates train lines and station relationships
  - Adds 3 sample apartments with images
  - Configures 2 scraping sources (SUUMO, Homes)

### 3. Test Scripts ✅
- `scripts/test-db.ts` - Tests database connection
- `scripts/init-db.sh` - Complete initialization script

### 4. Configuration ✅
- Added `tsx` for TypeScript execution
- Configured Prisma seed in `package.json`
- Database connection string in `.env`

## How to Complete Setup

### Option 1: Using Docker (Recommended)

1. Start Docker Desktop or Docker daemon
2. Run the database:
   ```bash
   make db-up
   # or
   docker-compose up -d postgres
   ```
3. Initialize the database:
   ```bash
   ./scripts/init-db.sh
   ```

### Option 2: Using Local PostgreSQL

1. Install PostgreSQL 16+
2. Create database and user:
   ```sql
   CREATE DATABASE "web-3";
   CREATE USER postgres WITH PASSWORD 'password';
   GRANT ALL PRIVILEGES ON DATABASE "web-3" TO postgres;
   ```
3. Run initialization:
   ```bash
   ./scripts/init-db.sh
   ```

### Option 3: Using Remote PostgreSQL

1. Update `.env` with your connection string:
   ```
   DATABASE_URL="postgresql://user:pass@host:port/dbname"
   ```
2. Run initialization:
   ```bash
   ./scripts/init-db.sh
   ```

## Verification Steps

After setup completes:

1. **Check the data**:
   ```bash
   npm run db:studio
   ```
   Open http://localhost:5555 to browse data

2. **Verify counts**:
   ```bash
   npx tsx scripts/test-db.ts
   ```
   Should show:
   - ~900+ stations
   - ~40+ train lines
   - 3 sample apartments

## Seed Data Details

### Stations & Lines
- All JR lines (Yamanote, Chuo, etc.)
- Tokyo Metro lines
- Private railways (Tokyu, Keio, etc.)
- Complete with English names and coordinates

### Sample Apartments
1. **Modern 1LDK near Shibuya Station**
   - ¥150,000/month, 45.5m²
   - 3F/8F, 5 years old

2. **Cozy Studio in Nakameguro**
   - ¥95,000/month, 25m²
   - 2F/4F, 15 years old

3. **Spacious 2LDK Family Apartment**
   - ¥220,000/month, 65m²
   - 5F/10F, 3 years old

### Scraping Sources
- SUUMO configuration
- Homes.co.jp configuration

## Next Steps

Once the database is running and initialized:

1. **For BE Agent**: Continue with API development (Task 2.1)
2. **For SC Agent**: Can start scraper development using seed sources
3. **For FE Agent**: Can use sample apartment data for UI development

## Troubleshooting

### "Database connection failed"
- Ensure PostgreSQL is running
- Check DATABASE_URL in .env
- Verify port 5432 is not blocked

### "Migration failed"
- Check if database exists
- Ensure user has proper permissions
- Look for detailed error in console

### "Seed failed"
- Check if migrations ran successfully
- Ensure tokyo_stations_detailed.json exists
- Look for specific error messages

## Files Created

- `/prisma/seed.ts` - Main seed script
- `/scripts/test-db.ts` - Connection test
- `/scripts/init-db.sh` - Initialization script
- `/docs/DATABASE_SETUP_COMPLETE.md` - This guide

---

Created by BE Agent on 2025-01-18