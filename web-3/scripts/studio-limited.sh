#!/bin/bash
# Run Prisma Studio with resource limits

# Set environment variables to limit Prisma Studio
export PRISMA_STUDIO_PORT=5555
export NODE_OPTIONS="--max-old-space-size=512"  # Limit to 512MB RAM

# You can also set query timeout
export PRISMA_QUERY_ENGINE_QUERY_TIMEOUT=5000  # 5 second timeout

echo "Starting Prisma Studio with limited resources..."
echo "RAM limit: 512MB"
echo "Query timeout: 5s"
echo "Port: 5555"

npx prisma studio