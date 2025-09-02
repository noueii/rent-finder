#!/usr/bin/env python3
"""
Tokyo Transit Route Finder using OpenTripPlanner
Example script to find the fastest route between two stations
"""

import requests
from datetime import datetime
import json
from typing import Dict, List, Optional

class TokyoRouteFinder:
    def __init__(self, otp_url: str = "http://localhost:8080"):
        self.otp_url = otp_url
        self.router_id = "default"
        
    def find_route(self, 
                   from_lat: float, 
                   from_lon: float, 
                   to_lat: float, 
                   to_lon: float,
                   date: Optional[str] = None,
                   time: Optional[str] = None,
                   arrive_by: bool = False) -> Dict:
        """
        Find routes between two points
        
        Args:
            from_lat, from_lon: Starting coordinates
            to_lat, to_lon: Destination coordinates
            date: Date in YYYY-MM-DD format (default: today)
            time: Time in HH:MM format (default: now)
            arrive_by: If True, time is arrival time; if False, departure time
        """
        
        # Use current date/time if not provided
        if not date:
            date = datetime.now().strftime("%Y-%m-%d")
        if not time:
            time = datetime.now().strftime("%H:%M")
            
        # Build query parameters
        params = {
            "fromPlace": f"{from_lat},{from_lon}",
            "toPlace": f"{to_lat},{to_lon}",
            "date": date,
            "time": time,
            "mode": "TRANSIT,WALK",
            "arriveBy": str(arrive_by).lower(),
            "maxWalkDistance": 1000,
            "numItineraries": 3
        }
        
        # Make request to OTP
        url = f"{self.otp_url}/otp/routers/{self.router_id}/plan"
        response = requests.get(url, params=params)
        
        if response.status_code != 200:
            raise Exception(f"OTP request failed: {response.status_code}")
            
        return response.json()
    
    def format_itinerary(self, itinerary: Dict) -> str:
        """Format a single itinerary for display"""
        duration = itinerary['duration'] // 60  # Convert to minutes
        start_time = datetime.fromtimestamp(itinerary['startTime'] / 1000).strftime("%H:%M")
        end_time = datetime.fromtimestamp(itinerary['endTime'] / 1000).strftime("%H:%M")
        
        output = [f"\n🚉 Route Option ({duration} minutes)"]
        output.append(f"Depart: {start_time} | Arrive: {end_time}")
        output.append("-" * 50)
        
        for leg in itinerary['legs']:
            mode = leg['mode']
            
            if mode == 'WALK':
                distance = round(leg['distance'])
                duration = round(leg['duration'] / 60)
                output.append(f"🚶 Walk {distance}m ({duration} min)")
            else:
                # Transit leg
                route = leg.get('routeShortName', leg.get('route', 'Unknown'))
                from_stop = leg['from']['name']
                to_stop = leg['to']['name']
                agency = leg.get('agencyName', '')
                
                output.append(f"🚃 {agency} {route}")
                output.append(f"   {from_stop} → {to_stop}")
                
        return "\n".join(output)
    
    def search_by_station_names(self, from_station: str, to_station: str, **kwargs):
        """
        Search for routes using station names
        Note: This is a simplified example. In production, you'd want to
        implement proper station name to coordinate mapping.
        """
        # Example station coordinates (you'd load these from your GTFS stops.txt)
        stations = {
            "Tokyo": (35.6812, 139.7671),
            "Shinjuku": (35.6896, 139.7004),
            "Shibuya": (35.6580, 139.7016),
            "Ikebukuro": (35.7295, 139.7109),
            "Ueno": (35.7141, 139.7774),
            "Shinagawa": (35.6284, 139.7387),
            "Harajuku": (35.6702, 139.7026),
            "Akihabara": (35.6984, 139.7731),
        }
        
        if from_station not in stations or to_station not in stations:
            available = ", ".join(stations.keys())
            raise ValueError(f"Unknown station. Available: {available}")
            
        from_coords = stations[from_station]
        to_coords = stations[to_station]
        
        return self.find_route(
            from_coords[0], from_coords[1],
            to_coords[0], to_coords[1],
            **kwargs
        )


def main():
    # Example usage
    finder = TokyoRouteFinder()
    
    print("🚅 Tokyo Transit Route Finder")
    print("=" * 50)
    
    # Example 1: Find route from Tokyo to Shibuya
    try:
        result = finder.search_by_station_names("Tokyo", "Shibuya")
        
        if 'plan' in result and 'itineraries' in result['plan']:
            itineraries = result['plan']['itineraries']
            print(f"\nFound {len(itineraries)} routes from Tokyo to Shibuya:")
            
            for itinerary in itineraries:
                print(finder.format_itinerary(itinerary))
        else:
            print("No routes found!")
            
    except Exception as e:
        print(f"Error: {e}")
        print("\nMake sure OpenTripPlanner is running on http://localhost:8080")
        print("Run: docker-compose up -d")


if __name__ == "__main__":
    main()