#!/bin/bash
cd /home/noueii/workspace/github.com/noueii/rent-finder/web

echo "Fixing Prisma client..."

# Stop the Next.js dev server if it's running
echo "Make sure to stop the dev server first!"

# Clear Next.js cache
echo "Clearing Next.js cache..."
rm -rf .next

# Clear node_modules Prisma cache
echo "Clearing Prisma cache..."
rm -rf node_modules/.prisma

# Regenerate Prisma client
echo "Regenerating Prisma client..."
npx prisma generate

# Push schema to ensure database is in sync
echo "Syncing database schema..."
npx prisma db push

echo "Done! Now restart your dev server."