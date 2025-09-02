#!/bin/bash
# Start rent-finder with OTP

echo "🏠 Starting Rent Finder with Transit Routing"
echo "=========================================="

# Set default AUTH_SECRET if not provided
if [ -z "$AUTH_SECRET" ]; then
    export AUTH_SECRET="development-secret-key-please-change-this"
    echo "⚠️  Using default AUTH_SECRET - change this in production!"
fi

# Check if OTP data exists
if [ ! -f "./tokyo-otp-routing/data/tokyo_rail.zip" ]; then
    echo "❌ OTP data not found. Please set up tokyo-otp-routing first."
    exit 1
fi

echo "✅ Starting services..."
docker compose -f docker-compose.combined.yml up -d --build

echo ""
echo "Services starting up..."
echo "- Rent Finder: http://localhost:3000"
echo "- OTP API: http://localhost:8080"
echo ""
echo "Check logs with: docker-compose -f docker-compose.combined.yml logs -f"