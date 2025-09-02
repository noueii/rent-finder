#!/bin/bash
# Set up GTFS file in the correct location for OTP

cd /home/noueii/workspace/tokyo-otp-routing

# Clean up previous attempts
rm -rf data/gtfs data/gtfs.zip

# OTP expects GTFS files directly in the data directory
# Make sure the file is there
if [ ! -f "data/tokyo_rail.zip" ]; then
    echo "Error: data/tokyo_rail.zip not found!"
    exit 1
fi

# Check if it's a valid GTFS file
echo "Checking GTFS file contents..."
unzip -t data/tokyo_rail.zip | grep -E "(agency|routes|stops)" > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ GTFS file is valid and contains required files"
else
    echo "❌ GTFS file appears to be corrupted"
    exit 1
fi

# Clear any graph cache
rm -rf data/graphs

echo ""
echo "GTFS file is properly set up in data/tokyo_rail.zip"
echo "Restart OTP with: docker-compose restart"