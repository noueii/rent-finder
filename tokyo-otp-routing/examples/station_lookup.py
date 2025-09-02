#!/usr/bin/env python3
"""
Station lookup utility for Tokyo GTFS data
Helps find station coordinates for route planning
"""

import zipfile
import pandas as pd
import sys

def load_stops(gtfs_file='../data/tokyo_rail.zip'):
    """Load stops from GTFS file"""
    with zipfile.ZipFile(gtfs_file) as zf:
        with zf.open('stops.txt') as f:
            return pd.read_csv(f)

def search_stations(query, stops_df):
    """Search for stations matching the query"""
    # Case-insensitive search in stop_name
    mask = stops_df['stop_name'].str.contains(query, case=False, na=False)
    results = stops_df[mask][['stop_id', 'stop_name', 'stop_lat', 'stop_lon']].drop_duplicates()
    return results

def main():
    if len(sys.argv) < 2:
        print("Usage: python station_lookup.py <station_name>")
        print("Example: python station_lookup.py shibuya")
        return
    
    query = ' '.join(sys.argv[1:])
    
    try:
        stops = load_stops()
        results = search_stations(query, stops)
        
        if results.empty:
            print(f"No stations found matching '{query}'")
        else:
            print(f"\nStations matching '{query}':")
            print("-" * 80)
            for _, row in results.iterrows():
                print(f"{row['stop_name']}")
                print(f"  ID: {row['stop_id']}")
                print(f"  Coordinates: {row['stop_lat']}, {row['stop_lon']}")
                print()
                
    except FileNotFoundError:
        print("Error: GTFS file not found. Make sure tokyo_rail.zip is in the data/ directory")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()