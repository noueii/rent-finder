#!/usr/bin/env python3
"""
Extract all unique station names from Tokyo GTFS data (no external dependencies)
"""

import zipfile
import csv
import json

def get_all_stations(gtfs_file='../data/tokyo_rail.zip'):
    """Extract all unique stations from GTFS file"""
    stations = {}
    
    with zipfile.ZipFile(gtfs_file) as zf:
        with zf.open('stops.txt') as f:
            # Decode bytes to string
            text_content = f.read().decode('utf-8')
            reader = csv.DictReader(text_content.splitlines())
            
            for row in reader:
                stop_name = row['stop_name']
                # Use station name as key to avoid duplicates
                if stop_name not in stations:
                    stations[stop_name] = {
                        'stop_id': row['stop_id'],
                        'stop_name': stop_name,
                        'stop_lat': float(row['stop_lat']),
                        'stop_lon': float(row['stop_lon'])
                    }
    
    # Convert to sorted list
    stations_list = sorted(stations.values(), key=lambda x: x['stop_name'])
    return stations_list

def main():
    try:
        stations = get_all_stations()
        
        print(f"Total unique stations: {len(stations)}")
        print("\nAll station names:")
        print("-" * 50)
        
        # Print first 50 stations as example
        for i, station in enumerate(stations):
            print(f"{station['stop_name']} (ID: {station['stop_id']})")
            if i >= 49:  # Show first 50
                print(f"\n... and {len(stations) - 50} more stations")
                break
        
        # Save to JSON
        with open('all_stations.json', 'w', encoding='utf-8') as f:
            json.dump(stations, f, ensure_ascii=False, indent=2)
        
        print(f"\nComplete station data saved to all_stations.json")
        
    except FileNotFoundError:
        print("Error: GTFS file not found. Make sure tokyo_rail.zip is in the data/ directory")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()