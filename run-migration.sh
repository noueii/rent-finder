#!/bin/bash

echo "🚀 Running apartment images migration..."

cd web

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Run the migration script
echo "Executing migration..."
node scripts/migrate-images.js

echo "✅ Migration complete!"

# Optional: Regenerate Prisma client to pick up schema changes
echo "Regenerating Prisma client..."
npx prisma generate

echo "🎉 All done! The new image schema is ready to use."