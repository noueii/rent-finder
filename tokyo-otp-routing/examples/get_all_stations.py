#!/usr/bin/env python3
"""
Extract all unique station names from Tokyo GTFS data
"""

import zipfile
import pandas as pd
import json

def get_all_stations(gtfs_file='../data/tokyo_rail.zip'):
    """Extract all unique stations from GTFS file"""
    with zipfile.ZipFile(gtfs_file) as zf:
        with zf.open('stops.txt') as f:
            stops_df = pd.read_csv(f)
    
    # Get unique stations (some stations may have multiple stop_ids)
    stations = stops_df[['stop_id', 'stop_name', 'stop_lat', 'stop_lon']].drop_duplicates(subset=['stop_name'])
    
    # Sort by name
    stations = stations.sort_values('stop_name')
    
    return stations

def main():
    try:
        stations = get_all_stations()
        
        print(f"Total unique stations: {len(stations)}")
        print("\nAll station names:")
        print("-" * 50)
        
        # Print all station names
        for _, station in stations.iterrows():
            print(f"{station['stop_name']} (ID: {station['stop_id']})")
        
        # Optionally save to JSON
        stations_list = stations.to_dict('records')
        with open('all_stations.json', 'w', encoding='utf-8') as f:
            json.dump(stations_list, f, ensure_ascii=False, indent=2)
        
        print(f"\nStation data saved to all_stations.json")
        
    except FileNotFoundError:
        print("Error: GTFS file not found. Make sure tokyo_rail.zip is in the data/ directory")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()