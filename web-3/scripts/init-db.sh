#!/bin/bash

echo "🚀 Database Initialization Script"
echo "================================="

# Check if database is running
echo "🔍 Checking database connection..."
if ! npx tsx scripts/test-db.ts 2>/dev/null; then
    echo "❌ Database is not accessible."
    echo ""
    echo "Please ensure PostgreSQL is running:"
    echo "  Option 1: Run 'make db-up' or 'docker-compose up -d postgres'"
    echo "  Option 2: Install and run PostgreSQL locally"
    echo "  Option 3: Use a remote PostgreSQL instance and update DATABASE_URL in .env"
    exit 1
fi

echo ""
echo "📦 Running Prisma migrations..."
npx prisma migrate dev --name init

if [ $? -eq 0 ]; then
    echo "✅ Migrations completed successfully!"
    
    echo ""
    echo "🌱 Seeding database with initial data..."
    npm run db:seed
    
    if [ $? -eq 0 ]; then
        echo "✅ Database seeding completed!"
        echo ""
        echo "🎉 Database initialization complete!"
        echo ""
        echo "You can now:"
        echo "  - Run 'npm run dev' to start the development server"
        echo "  - Run 'npm run db:studio' to open Prisma Studio"
    else
        echo "❌ Database seeding failed. Check the error messages above."
        exit 1
    fi
else
    echo "❌ Migrations failed. Check the error messages above."
    exit 1
fi