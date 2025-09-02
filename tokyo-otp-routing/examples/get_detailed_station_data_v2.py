#!/usr/bin/env python3
"""
Extract comprehensive station data from Tokyo GTFS including lines, routes, and coordinates
Version 2: Fixed to properly match stop_ids between files
"""

import zipfile
import csv
import json
from collections import defaultdict

def load_gtfs_data(gtfs_file='../data/tokyo_rail.zip'):
    """Load all relevant GTFS data"""
    data = {
        'stops': {},
        'child_stops': defaultdict(list),  # Maps parent stations to their platforms
        'routes': {},
        'stop_routes': defaultdict(set),  # Maps stop_id to route_ids
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
        
        # Load stops - including both stations and platforms
        all_stops = {}
        with zf.open('stops.txt') as f:
            text = f.read().decode('utf-8')
            reader = csv.DictReader(text.splitlines())
            for row in reader:
                all_stops[row['stop_id']] = row
                
                # Main stations (location_type = 1)
                if row.get('location_type', '') == '1':
                    data['stops'][row['stop_id']] = {
                        'id': row['stop_id'],
                        'name': row['stop_name'],
                        'lat': float(row['stop_lat']),
                        'lon': float(row['stop_lon']),
                        'type': 'station'
                    }
                # Platforms/stops (location_type = 0 or empty)
                elif row.get('location_type', '') in ['', '0']:
                    parent = row.get('parent_station', '')
                    if parent:
                        data['child_stops'][parent].append(row['stop_id'])
                    else:
                        # Standalone stop (acts as both station and platform)
                        data['stops'][row['stop_id']] = {
                            'id': row['stop_id'],
                            'name': row['stop_name'],
                            'lat': float(row['stop_lat']),
                            'lon': float(row['stop_lon']),
                            'type': 'stop'
                        }
        
        # Load trips
        with zf.open('trips.txt') as f:
            text = f.read().decode('utf-8')
            reader = csv.DictReader(text.splitlines())
            for row in reader:
                data['trips'][row['trip_id']] = row['route_id']
        
        # Load stop_times and map routes to stops
        with zf.open('stop_times.txt') as f:
            text = f.read().decode('utf-8')
            reader = csv.DictReader(text.splitlines())
            for row in reader:
                trip_id = row['trip_id']
                stop_id = row['stop_id']
                
                if trip_id in data['trips']:
                    route_id = data['trips'][trip_id]
                    
                    # Add route to this stop
                    data['stop_routes'][stop_id].add(route_id)
                    
                    # If this is a platform, also add to parent station
                    if stop_id in all_stops:
                        parent = all_stops[stop_id].get('parent_station', '')
                        if parent:
                            data['stop_routes'][parent].add(route_id)
    
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
        
        # Get all routes serving this station (including via child stops)
        all_routes = set()
        
        # Routes directly serving this stop
        all_routes.update(data['stop_routes'].get(stop_id, set()))
        
        # Routes serving child stops
        for child_id in data['child_stops'].get(stop_id, []):
            all_routes.update(data['stop_routes'].get(child_id, set()))
        
        # Build route information
        routes_serving = []
        operators = set()
        lines = set()
        
        for route_id in all_routes:
            if route_id in data['routes']:
                route = data['routes'][route_id]
                agency = data['agencies'].get(route['agency_id'], {})
                
                # Extract operator name
                operator_full = agency.get('name', '')
                operator_parts = operator_full.split(' ')
                # Try to get English name (usually last part)
                operator_en = operator_parts[-1] if len(operator_parts) > 1 else operator_full
                
                route_info = {
                    'route_id': route_id,
                    'route_short_name': route['short_name'],
                    'route_long_name': route['long_name'],
                    'operator': operator_en,
                    'operator_full': operator_full,
                    'color': route['color']
                }
                
                routes_serving.append(route_info)
                operators.add(operator_en)
                lines.add(route['long_name'])
        
        # Create station entry
        stations[stop_id] = {
            'id': stop_id,
            'name': stop_info['name'],
            'name_en': name_en,
            'name_ja': name_ja,
            'lat': stop_info['lat'],
            'lon': stop_info['lon'],
            'coordinates': [stop_info['lon'], stop_info['lat']],  # GeoJSON format
            'routes': sorted(routes_serving, key=lambda x: (x['operator'], x['route_long_name'])),
            'operators': sorted(list(operators)),
            'lines': sorted(list(lines)),
            'platform_count': len(data['child_stops'].get(stop_id, []))
        }
    
    return stations

def main():
    try:
        print("Extracting comprehensive station data (v2)...")
        stations = build_comprehensive_station_data()
        
        # Convert to list and sort by name
        stations_list = sorted(stations.values(), key=lambda x: x['name_en'])
        
        print(f"\nTotal stations: {len(stations_list)}")
        
        # Count stations with routes
        stations_with_routes = sum(1 for s in stations_list if s['routes'])
        print(f"Stations with route data: {stations_with_routes}")
        
        print("\nSample station data:")
        print("-" * 80)
        
        # Show a few example stations
        examples = ['Shibuya', 'Tokyo', 'Shinjuku', 'Ikebukuro', 'Ueno']
        for example in examples:
            found = False
            for station in stations_list:
                if example.lower() in station['name_en'].lower() and station['routes']:
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
                    found = True
                    break
            
            if not found:
                print(f"\n{example}: No station found with route data")
        
        # Save to JSON
        output_file = 'tokyo_stations_detailed.json'
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump({
                'metadata': {
                    'total_stations': len(stations_list),
                    'stations_with_routes': stations_with_routes,
                    'source': 'Tokyo GTFS Rail Data',
                    'fields': [
                        'id', 'name', 'name_en', 'name_ja', 
                        'lat', 'lon', 'coordinates',
                        'routes', 'operators', 'lines', 'platform_count'
                    ]
                },
                'stations': stations_list
            }, f, ensure_ascii=False, indent=2)
        
        print(f"\n✓ Detailed station data saved to {output_file}")
        
        # Show some statistics
        print("\nStatistics:")
        operators_count = defaultdict(int)
        for station in stations_list:
            for op in station['operators']:
                operators_count[op] += 1
        
        print("\nStations by operator:")
        for op, count in sorted(operators_count.items(), key=lambda x: -x[1])[:10]:
            print(f"  {op}: {count} stations")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()