#!/bin/bash
# Production database migration script

set -e  # Exit on error

echo "🗄️  Tokyo Apartment Finder - Production Database Migration"
echo "=========================================="

# Load environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
elif [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "❌ Error: No environment file found"
    echo "Please create .env.production or .env file"
    exit 1
fi

# Check database URL
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL is not set"
    exit 1
fi

echo "📊 Database URL: ${DATABASE_URL//:*@/:****@}"
echo ""

# Backup current schema (if database exists)
echo "💾 Creating backup of current schema..."
BACKUP_FILE="prisma/backups/backup_$(date +%Y%m%d_%H%M%S).sql"
mkdir -p prisma/backups

# Try to create backup (may fail if database doesn't exist yet)
pg_dump "$DATABASE_URL" --schema-only > "$BACKUP_FILE" 2>/dev/null || echo "⚠️  No existing database to backup"

# Run migrations
echo ""
echo "🚀 Running database migrations..."
npx prisma migrate deploy

# Verify migration
echo ""
echo "✅ Verifying database schema..."
npx prisma db pull --print

echo ""
echo "✨ Migration completed successfully!"
echo ""
echo "Next steps:"
echo "1. Verify the application can connect to the database"
echo "2. Run health check: curl https://yourdomain.com/api/health"
echo "3. Check application logs for any issues"