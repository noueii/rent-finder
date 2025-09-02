#!/bin/bash
# Quick production startup script

set -e

echo "🚀 Tokyo Apartment Finder - Production Startup"
echo "============================================"

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo "❌ Error: .env.production not found"
    echo "Please copy .env.production.example to .env.production and configure it"
    exit 1
fi

# Build the Docker image
echo "🔨 Building Docker image..."
docker build -t tokyo-apartment-finder .

# Start the production stack
echo "🚀 Starting production stack..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check health
echo "🏥 Checking application health..."
curl -f http://localhost:3000/api/health || echo "⚠️  Health check failed - services may still be starting"

echo ""
echo "✨ Production stack started!"
echo ""
echo "Access points:"
echo "- Application: http://localhost:3000"
echo "- Monitoring (if enabled): http://localhost:3001 (Grafana)"
echo ""
echo "To view logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "To stop: docker-compose -f docker-compose.prod.yml down"