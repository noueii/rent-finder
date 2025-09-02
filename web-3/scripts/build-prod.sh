#!/bin/bash
# Production build script for Tokyo Apartment Finder

set -e  # Exit on error

echo "🏗️  Starting production build..."

# Check if all required environment variables are set
check_env() {
  if [ -z "${!1}" ]; then
    echo "❌ Error: $1 is not set"
    exit 1
  fi
}

# Check critical environment variables
check_env "DATABASE_URL"
check_env "AUTH_SECRET"
check_env "AUTH_GOOGLE_ID"
check_env "AUTH_GOOGLE_SECRET"

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --production=false

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Run database migrations
echo "🗄️  Running database migrations..."
npx prisma migrate deploy

# Build the application
echo "🔨 Building Next.js application..."
npm run build

# Prune dev dependencies
echo "🧹 Removing dev dependencies..."
npm prune --production

echo "✅ Production build complete!"
echo ""
echo "To start the application, run:"
echo "  npm start"
echo ""
echo "Or with PM2:"
echo "  pm2 start npm --name 'tokyo-apartment-finder' -- start"