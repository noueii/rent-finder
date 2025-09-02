#!/bin/bash
cd /home/noueii/workspace/github.com/noueii/rent-finder/web

echo "Setting up database..."

# Remove old database files to start fresh
echo "Removing old database files..."
rm -f prisma/rent-finder.db
rm -f prisma/rent-finder.db-journal
rm -f prisma/dev.db
rm -f prisma/dev.db-journal

# Generate Prisma Client
echo "Generating Prisma Client..."
npx prisma generate

# Push schema to database
echo "Creating database schema..."
npx prisma db push --skip-generate

echo "Database setup complete!"

# Verify tables
echo "Verifying tables..."
node check-db.js