#!/bin/bash
# Complete OTP startup script

echo "🚇 Starting Tokyo OpenTripPlanner"
echo "================================"

# Check if graph exists
if [ -f "data/graphs/default/graph.obj" ]; then
    echo "✅ Graph already built, starting OTP..."
    docker-compose up -d
else
    echo "📊 No graph found, need to build first..."
    echo "This will take 5-10 minutes on first run."
    
    # First build the graph
    echo "Building graph..."
    docker run --rm \
        -v "$(pwd)/data":/var/opentripplanner \
        -v "$(pwd)/otp-config.json":/var/opentripplanner/otp-config.json \
        -v "$(pwd)/data/build-config.json":/var/opentripplanner/build-config.json \
        -e JAVA_OPTS="-Xmx3G" \
        docker.io/opentripplanner/opentripplanner:2.5.0 \
        --build --save
    
    if [ $? -eq 0 ]; then
        echo "✅ Graph built successfully!"
        echo "Starting OTP server..."
        docker-compose up -d
    else
        echo "❌ Graph build failed. Check the logs above."
        exit 1
    fi
fi

echo ""
echo "OTP is starting up. Check status with:"
echo "  docker-compose logs -f"
echo ""
echo "Once running, access at:"
echo "  http://localhost:8080/"