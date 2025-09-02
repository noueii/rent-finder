#!/bin/bash
# Download and clip OpenStreetMap data for a custom Tokyo bounding box

# Define bounding box (edit as needed)
MIN_LAT=35.5
MIN_LON=139.4
MAX_LAT=35.9
MAX_LON=140.0

echo "Downloading OpenStreetMap data for Kanto region (includes Tokyo)..."

mkdir -p data
cd data

# Download the full region (Kanto) from Geofabrik
if [ ! -f kanto-latest.osm.pbf ]; then
    wget -O kanto-latest.osm.pbf https://download.geofabrik.de/asia/japan/kanto-latest.osm.pbf
else
    echo "Kanto OSM extract already exists, skipping download."
fi

# Check if osmconvert is installed
if ! command -v osmconvert &> /dev/null; then
    echo "Error: osmconvert not installed. Install it from https://wiki.openstreetmap.org/wiki/Osmconvert"
    exit 1
fi

# Clip to bounding box
echo "Clipping to bounding box: $MIN_LON,$MIN_LAT,$MAX_LON,$MAX_LAT ..."
osmconvert kanto-latest.osm.pbf -b=$MIN_LON,$MIN_LAT,$MAX_LON,$MAX_LAT -o=tokyo-bbox.osm.pbf

echo "Download and clipping complete!"
echo "Output: data/tokyo-bbox.osm.pbf covers only your custom Tokyo area."

