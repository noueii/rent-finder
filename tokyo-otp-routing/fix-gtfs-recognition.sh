#!/bin/bash
# Ensure OTP recognizes the GTFS file

cd data

# OTP better recognizes GTFS files in a subdirectory
mkdir -p gtfs
cp tokyo_rail.zip gtfs/

# Also try renaming to a more standard name
cp tokyo_rail.zip gtfs.zip

echo "Created multiple copies to ensure OTP finds the GTFS data:"
echo "- data/gtfs/tokyo_rail.zip"
echo "- data/gtfs.zip"
echo ""
echo "Restart OTP to pick up the changes:"
echo "docker-compose restart"