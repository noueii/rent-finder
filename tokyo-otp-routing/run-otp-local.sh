#!/bin/bash
# Run OpenTripPlanner locally without Docker

OTP_VERSION="2.5.0"
OTP_JAR="otp-${OTP_VERSION}-shaded.jar"
OTP_URL="https://github.com/opentripplanner/OpenTripPlanner/releases/download/v${OTP_VERSION}/${OTP_JAR}"

echo "🚇 OpenTripPlanner Local Setup"
echo "=============================="

# Check if Java is installed
if ! command -v java &> /dev/null; then
    echo "❌ Java is not installed. Please install Java 17 or later."
    echo "   Ubuntu/Debian: sudo apt install openjdk-17-jre"
    echo "   Mac: brew install openjdk@17"
    exit 1
fi

# Check Java version
JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2 | cut -d'.' -f1)
if [ "$JAVA_VERSION" -lt 11 ]; then
    echo "❌ Java version $JAVA_VERSION is too old. Need Java 11 or later."
    exit 1
fi

echo "✅ Java version: $(java -version 2>&1 | head -n 1)"

# Download OTP if not present
if [ ! -f "$OTP_JAR" ]; then
    echo "📥 Downloading OpenTripPlanner ${OTP_VERSION}..."
    echo "   This may take a few minutes (file is ~150MB)"
    
    if command -v wget &> /dev/null; then
        wget -O "$OTP_JAR" "$OTP_URL"
    elif command -v curl &> /dev/null; then
        curl -L -o "$OTP_JAR" "$OTP_URL"
    else
        echo "❌ Neither wget nor curl is installed. Please install one."
        exit 1
    fi
    
    if [ ! -f "$OTP_JAR" ]; then
        echo "❌ Failed to download OTP"
        exit 1
    fi
    echo "✅ Downloaded successfully"
else
    echo "✅ OTP JAR already downloaded"
fi

# Check for GTFS data
if [ ! -f "data/tokyo_rail.zip" ]; then
    echo "❌ GTFS data not found at data/tokyo_rail.zip"
    exit 1
fi
echo "✅ GTFS data found"

# Check for OSM data
OSM_FILE=$(find data -name "*.osm.pbf" -o -name "*.osm" | head -n 1)
if [ -z "$OSM_FILE" ]; then
    echo "⚠️  No OSM data found. Run ./download-osm-data.sh first"
    echo "   OTP will work but without walking directions"
else
    echo "✅ OSM data found: $OSM_FILE"
fi

# Create directories
mkdir -p data/graphs

echo ""
echo "🚀 Starting OpenTripPlanner..."
echo "================================"
echo "This will:"
echo "1. Build the routing graph (first time: 5-10 minutes)"
echo "2. Start the web server"
echo ""
echo "Access OTP at:"
echo "  🌐 Web UI: http://localhost:8080/"
echo "  📡 API: http://localhost:8080/otp/routers/default/"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Run OTP
# --build: Build graph from GTFS+OSM
# --serve: Start web server
# --port: API port
# --securePort: Web UI port
exec java -Xmx4G -jar "$OTP_JAR" \
    --build \
    --serve \
    --basePath ./data \
    --port 8080 \
    --securePort 8081