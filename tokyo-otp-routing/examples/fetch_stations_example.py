#!/usr/bin/env python3
"""
Example of how to fetch all station names from the OTP graph
"""

import zipfile
import csv
import json

def fetch_all_station_names(gtfs_file='../data/tokyo_rail.zip'):
    """
    Fetch all unique station names from the OTP GTFS data.
    
    Returns:
        list: List of unique station names
    """
    station_names = set()
    
    with zipfile.ZipFile(gtfs_file) as zf:
        with zf.open('stops.txt') as f:
            text_content = f.read().decode('utf-8')
            reader = csv.DictReader(text_content.splitlines())
            
            for row in reader:
                station_names.add(row['stop_name'])
    
    return sorted(list(station_names))

def fetch_stations_with_details(gtfs_file='../data/tokyo_rail.zip'):
    """
    Fetch all stations with their details (ID, name, coordinates).
    
    Returns:
        dict: Dictionary mapping station names to their details
    """
    stations = {}
    
    with zipfile.ZipFile(gtfs_file) as zf:
        with zf.open('stops.txt') as f:
            text_content = f.read().decode('utf-8')
            reader = csv.DictReader(text_content.splitlines())
            
            for row in reader:
                stop_name = row['stop_name']
                if stop_name not in stations:
                    stations[stop_name] = {
                        'stop_id': row['stop_id'],
                        'stop_name': stop_name,
                        'stop_lat': float(row['stop_lat']),
                        'stop_lon': float(row['stop_lon'])
                    }
    
    return stations

# Example usage
if __name__ == "__main__":
    # Get just the names
    names = fetch_all_station_names()
    print(f"Total stations: {len(names)}")
    print("\nFirst 10 stations:")
    for name in names[:10]:
        print(f"  - {name}")
    
    print("\n" + "="*50 + "\n")
    
    # Get stations with full details
    stations = fetch_stations_with_details()
    print(f"Stations with coordinates (first 5):")
    for i, (name, details) in enumerate(stations.items()):
        if i >= 5:
            break
        print(f"\n{name}:")
        print(f"  ID: {details['stop_id']}")
        print(f"  Lat: {details['stop_lat']}")
        print(f"  Lon: {details['stop_lon']}")