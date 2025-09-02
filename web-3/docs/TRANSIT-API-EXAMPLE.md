# Transit Service API Example

## Overview
The Tokyo Apartment Finder uses OpenTripPlanner (OTP) for transit routing calculations. Here's a complete example of how to make requests to the transit service API.

## API Endpoint
Default endpoint: `http://localhost:8080/otp/routers/default`

You can configure this via the `OTP_ENDPOINT` environment variable.

## Example Request

### 1. Plan a Route
Calculate a transit route between two coordinates in Tokyo.

**Endpoint**: `GET /plan`

**Parameters**:
- `fromPlace`: Starting coordinates (latitude,longitude)
- `toPlace`: Destination coordinates (latitude,longitude)
- `mode`: Transportation modes (e.g., "TRANSIT,WALK")
- `maxWalkDistance`: Maximum walking distance in meters
- `arriveBy`: Whether to plan backwards from arrival time (false for departure)
- `numItineraries`: Number of alternative routes to return
- `locale`: Language for response (e.g., "ja" for Japanese)

**Example Request**:
```bash
curl "http://localhost:8080/otp/routers/default/plan?\
fromPlace=35.6812,139.7671\
&toPlace=35.6580,139.7016\
&mode=TRANSIT,WALK\
&maxWalkDistance=1000\
&arriveBy=false\
&numItineraries=3\
&locale=ja"
```

This example:
- **From**: Shinjuku Station area (35.6812, 139.7671)
- **To**: Shibuya Station area (35.6580, 139.7016)
- **Max walking**: 1km
- **Routes**: 3 alternatives

### 2. Response Format

**Successful Response**:
```json
{
  "plan": {
    "itineraries": [
      {
        "duration": 720,          // Total duration in seconds (12 minutes)
        "walkTime": 180,          // Walking time in seconds
        "transitTime": 540,       // Transit time in seconds
        "transfers": 0,           // Number of transfers
        "legs": [
          {
            "mode": "WALK",
            "from": {
              "name": "Origin",
              "lat": 35.6812,
              "lon": 139.7671
            },
            "to": {
              "name": "Shinjuku Station",
              "lat": 35.6896,
              "lon": 139.7006
            },
            "duration": 120,      // 2 minutes walk
            "distance": 150       // 150 meters
          },
          {
            "mode": "TRANSIT",
            "from": {
              "name": "Shinjuku Station",
              "lat": 35.6896,
              "lon": 139.7006
            },
            "to": {
              "name": "Shibuya Station",
              "lat": 35.6580,
              "lon": 139.7016
            },
            "duration": 480,      // 8 minutes transit
            "route": {
              "id": "JY",
              "shortName": "JY",
              "longName": "Yamanote Line",
              "type": "RAIL"
            }
          },
          {
            "mode": "WALK",
            "from": {
              "name": "Shibuya Station",
              "lat": 35.6580,
              "lon": 139.7016
            },
            "to": {
              "name": "Destination",
              "lat": 35.6580,
              "lon": 139.7016
            },
            "duration": 60,       // 1 minute walk
            "distance": 50        // 50 meters
          }
        ]
      }
    ]
  }
}
```

**Error Response**:
```json
{
  "error": {
    "id": "404",
    "msg": "No route found",
    "message": "LOCATIONS_NOT_ACCESSIBLE"
  }
}
```

### 3. Health Check
Check if the OTP service is available.

**Endpoint**: `GET /index/routes`

**Example**:
```bash
curl "http://localhost:8080/otp/routers/default/index/routes"
```

**Response**: HTTP 200 if healthy

## Integration in Application

### TypeScript/JavaScript Example
```typescript
// Using the OTPService class
import { OTPService } from '~/lib/transit/otp-service';

const otpService = new OTPService();
await otpService.initialize();

// Calculate commute time (returns minutes)
const commuteTime = await otpService.calculateCommute(
  35.6812, 139.7671,  // From: Shinjuku area
  35.6580, 139.7016,  // To: Shibuya area
  60                   // Max 60 minutes
);

console.log(`Commute time: ${commuteTime} minutes`);

// Get detailed route
const route = await otpService.getRoute(
  35.6812, 139.7671,
  35.6580, 139.7016,
  60
);

if (route) {
  console.log(`Duration: ${route.duration} seconds`);
  console.log(`Transfers: ${route.transfers}`);
  route.legs.forEach(leg => {
    console.log(`${leg.mode}: ${leg.from.name} → ${leg.to.name}`);
  });
}
```

### Direct API Call Example
```typescript
async function getTransitRoute(fromLat: number, fromLon: number, toLat: number, toLon: number) {
  const params = new URLSearchParams({
    fromPlace: `${fromLat},${fromLon}`,
    toPlace: `${toLat},${toLon}`,
    mode: 'TRANSIT,WALK',
    maxWalkDistance: '1000',
    arriveBy: 'false',
    numItineraries: '3',
    locale: 'ja'
  });

  const response = await fetch(
    `http://localhost:8080/otp/routers/default/plan?${params}`
  );
  
  if (!response.ok) {
    throw new Error(`Transit API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (data.error) {
    console.error('No route found:', data.error.message);
    return null;
  }
  
  // Return the best route
  return data.plan?.itineraries?.[0];
}

// Usage
const route = await getTransitRoute(35.6812, 139.7671, 35.6580, 139.7016);
if (route) {
  console.log(`Found route: ${Math.round(route.duration / 60)} minutes`);
}
```

## Common Coordinates for Testing

### Major Tokyo Stations
- **Tokyo Station**: 35.6812, 139.7671
- **Shinjuku Station**: 35.6896, 139.7006
- **Shibuya Station**: 35.6580, 139.7016
- **Ikebukuro Station**: 35.7295, 139.7109
- **Shinagawa Station**: 35.6284, 139.7387
- **Ueno Station**: 35.7141, 139.7774
- **Akihabara Station**: 35.6984, 139.7731

### Example Apartment Locations
- **Roppongi Hills**: 35.6605, 139.7292
- **Tokyo Midtown**: 35.6659, 139.7309
- **Asakusa Area**: 35.7148, 139.7967
- **Odaiba**: 35.6251, 139.7756

## Troubleshooting

### Common Issues

1. **Service Unavailable**
   - Check if OTP service is running: `docker ps | grep opentripplanner`
   - Verify endpoint URL in environment variables
   - Check health endpoint: `/index/routes`

2. **No Route Found**
   - Coordinates might be too far from transit stations
   - Maximum walk distance might be too restrictive
   - Location might not be accessible by transit

3. **Timeout Errors**
   - Default timeout is 10 seconds
   - Complex routes may take longer
   - Consider caching results

### Fallback Behavior
If OTP is unavailable, the service falls back to a pre-computed transit graph that:
- Uses station-to-station connections only
- May be less accurate for walking distances
- Still provides reasonable commute estimates

## Performance Tips

1. **Caching**: Routes are cached for 1 hour by default
2. **Batch Processing**: When calculating multiple routes, use parallel requests
3. **Reasonable Limits**: Set appropriate `maxMinutes` to avoid expensive calculations
4. **Health Checks**: Service checks OTP availability every minute

## Environment Variables

```bash
# .env.local
OTP_ENDPOINT=http://localhost:8080/otp/routers/default
```

## Docker Setup (Optional)

If you need to run your own OTP instance:

```bash
docker run -p 8080:8080 \
  -v /path/to/gtfs:/var/opentripplanner \
  opentripplanner/opentripplanner:latest \
  --build --serve
```

You'll need:
- Tokyo GTFS data (transit schedules)
- OpenStreetMap data for Tokyo
- Adequate memory (4GB+ recommended)