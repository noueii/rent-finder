"""
Example of calling OTP from another Docker container
"""
import requests
import os

# When running in Docker on same network
OTP_INTERNAL_URL = "http://tokyo-otp:8080"

# When running from host machine
OTP_EXTERNAL_URL = "http://localhost:8080"

def get_otp_url():
    """Detect if running in Docker or on host"""
    # Check if we're in a container
    if os.path.exists('/.dockerenv'):
        return OTP_INTERNAL_URL
    return OTP_EXTERNAL_URL

def find_route(from_lat, from_lon, to_lat, to_lon):
    """Find route using OTP"""
    base_url = get_otp_url()
    
    params = {
        "fromPlace": f"{from_lat},{from_lon}",
        "toPlace": f"{to_lat},{to_lon}",
        "mode": "TRANSIT,WALK"
    }
    
    url = f"{base_url}/otp/routers/default/plan"
    response = requests.get(url, params=params)
    
    return response.json()

# Example usage
if __name__ == "__main__":
    # Tokyo to Shibuya
    result = find_route(35.6812, 139.7671, 35.6580, 139.7016)
    print(f"Found {len(result['plan']['itineraries'])} routes")