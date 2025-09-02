#!/bin/bash
# Download OpenStreetMap data for Tokyo region

echo "Downloading OpenStreetMap data for Tokyo..."

# Tokyo bounding box (covers Greater Tokyo Area)
# Min: 35.5, 139.4 (Southwest)
# Max: 35.9, 140.0 (Northeast)

cd data

# Option 1: Download from Geofabrik (recommended - smaller file)
echo "Downloading from Geofabrik..."
wget -O kanto-latest.osm.pbf https://download.geofabrik.de/asia/japan/kanto-latest.osm.pbf

echo "Download complete!"
echo "The OSM file covers the entire Kanto region including Tokyo."
echo "OTP will automatically clip it to the area covered by your GTFS data."