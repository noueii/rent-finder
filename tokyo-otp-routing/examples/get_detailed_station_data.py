#!/usr/bin/env python3
"""
Extract comprehensive station data from Tokyo GTFS including lines, routes, and coordinates
"""

import zipfile
import csv
import json
from collections import defaultdict

def load_gtfs_data(gtfs_file='../data/tokyo_rail.zip'):
    """Load all relevant GTFS data"""
    data = {
        'stops': {},
        'routes': {},
        'stop_times': defaultdict(set),
        'trips': {},
        'agencies': {}
    }
    
    with zipfile.ZipFile(gtfs_file) as zf:
        # Load agencies
        with zf.open('agency.txt') as f:
            text = f.read().decode('utf-8')
            reader = csv.DictReader(text.splitlines())
            for row in reader:
                data['agencies'][row['agency_id']] = {
                    'name': row['agency_name'],
                    'url': row['agency_url']
                }
        
        # Load routes
        with zf.open('routes.txt') as f:
            text = f.read().decode('utf-8')
            reader = csv.DictReader(text.splitlines())
            for row in reader:
                data['routes'][row['route_id']] = {
                    'agency_id': row['agency_id'],
                    'short_name': row['route_short_name'],
                    'long_name': row['route_long_name'],
                    'type': row['route_type'],
                    'color': row.get('route_color', ''),
                    'text_color': row.get('route_text_color', '')
                }
        
        # Load stops
        with zf.open('stops.txt') as f:
            text = f.read().decode('utf-8')
            reader = csv.DictReader(text.splitlines())
            for row in reader:
                # Only include actual stations (location_type = 1 or empty)
                if row.get('location_type', '') in ['', '1']:
                    data['stops'][row['stop_id']] = {
                        'id': row['stop_id'],
                        'name': row['stop_name'],
                        'lat': float(row['stop_lat']),
                        'lon': float(row['stop_lon']),
                        'parent_station': row.get('parent_station', '')
                    }
        
        # Load trips to connect routes to stops
        with zf.open('trips.txt') as f:
            text = f.read().decode('utf-8')
            reader = csv.DictReader(text.splitlines())
            for row in reader:
                data['trips'][row['trip_id']] = row['route_id']
        
        # Load stop_times to find which routes serve which stops
        with zf.open('stop_times.txt') as f:
            text = f.read().decode('utf-8')
            reader = csv.DictReader(text.splitlines())
            for row in reader:
                trip_id = row['trip_id']
                stop_id = row['stop_id']
                if trip_id in data['trips']:
                    route_id = data['trips'][trip_id]
                    data['stop_times'][stop_id].add(route_id)
    
    return data

def extract_station_names(name):
    """Extract English and Japanese names from combined string"""
    # Most names are in format "日本語 English"
    parts = name.split(' ', 1)
    if len(parts) == 2 and any('\u3000' <= c <= '\u9fff' or '\u4e00' <= c <= '\u9fff' for c in parts[0]):
        return parts[1], parts[0]  # English, Japanese
    return name, ''  # All English, no Japanese

def build_comprehensive_station_data(gtfs_file='../data/tokyo_rail.zip'):
    """Build comprehensive station data with all details"""
    data = load_gtfs_data(gtfs_file)
    
    stations = {}
    
    for stop_id, stop_info in data['stops'].items():
        name_en, name_ja = extract_station_names(stop_info['name'])
        
        # Get all routes serving this station
        routes_serving = []
        for route_id in data['stop_times'].get(stop_id, set()):
            if route_id in data['routes']:
                route = data['routes'][route_id]
                agency = data['agencies'].get(route['agency_id'], {})
                
                # Extract operator name
                operator_full = agency.get('name', '')
                operator_en = operator_full.split(' ')[-1] if ' ' in operator_full else operator_full
                
                routes_serving.append({
                    'route_id': route_id,
                    'route_short_name': route['short_name'],
                    'route_long_name': route['long_name'],
                    'operator': operator_en,
                    'operator_full': operator_full,
                    'color': route['color']
                })
        
        # Create station entry
        stations[stop_id] = {
            'id': stop_id,
            'name': stop_info['name'],
            'name_en': name_en,
            'name_ja': name_ja,
            'lat': stop_info['lat'],
            'lon': stop_info['lon'],
            'coordinates': [stop_info['lon'], stop_info['lat']],  # GeoJSON format
            'routes': routes_serving,
            'operators': list(set(r['operator'] for r in routes_serving)),
            'lines': list(set(r['route_long_name'] for r in routes_serving))
        }
    
    return stations

def main():
    try:
        print("Extracting comprehensive station data...")
        stations = build_comprehensive_station_data()
        
        # Convert to list and sort by name
        stations_list = sorted(stations.values(), key=lambda x: x['name_en'])
        
        print(f"\nTotal stations: {len(stations_list)}")
        print("\nSample station data:")
        print("-" * 80)
        
        # Show a few example stations
        examples = ['Shibuya', 'Tokyo', 'Shinjuku', 'Ikebukuro', 'Ueno']
        for example in examples:
            for station in stations_list:
                if example.lower() in station['name_en'].lower():
                    print(f"\n{station['name']}:")
                    print(f"  ID: {station['id']}")
                    print(f"  English: {station['name_en']}")
                    print(f"  Japanese: {station['name_ja']}")
                    print(f"  Coordinates: {station['lat']}, {station['lon']}")
                    print(f"  Operators: {', '.join(station['operators'])}")
                    print(f"  Lines ({len(station['lines'])}):")
                    for line in station['lines'][:5]:  # Show first 5 lines
                        print(f"    - {line}")
                    if len(station['lines']) > 5:
                        print(f"    ... and {len(station['lines']) - 5} more lines")
                    break
        
        # Save to JSON
        output_file = 'tokyo_stations_detailed.json'
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump({
                'metadata': {
                    'total_stations': len(stations_list),
                    'source': 'Tokyo GTFS Rail Data',
                    'fields': [
                        'id', 'name', 'name_en', 'name_ja', 
                        'lat', 'lon', 'coordinates',
                        'routes', 'operators', 'lines'
                    ]
                },
                'stations': stations_list
            }, f, ensure_ascii=False, indent=2)
        
        print(f"\n✓ Detailed station data saved to {output_file}")
        
        # Also create a simplified version for quick lookup
        simple_stations = []
        for station in stations_list:
            simple_stations.append({
                'id': station['id'],
                'name': station['name_en'],
                'name_ja': station['name_ja'],
                'lat': station['lat'],
                'lon': station['lon'],
                'operators': station['operators'],
                'line_count': len(station['lines'])
            })
        
        with open('tokyo_stations_simple.json', 'w', encoding='utf-8') as f:
            json.dump(simple_stations, f, ensure_ascii=False, indent=2)
        
        print(f"✓ Simplified station list saved to tokyo_stations_simple.json")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()