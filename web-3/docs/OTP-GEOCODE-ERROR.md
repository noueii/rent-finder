# OTP "Geocode Not Found" Error Explanation

## What is this error?

The "geocode not found" or "LOCATION_NOT_ACCESSIBLE" error from OpenTripPlanner (OTP) means that OTP cannot find a valid transit-accessible location for one or both of your coordinates.

## Common Error Messages

1. **404 / LOCATION_NOT_ACCESSIBLE**
   - "The location was found, but no stops could be found within the search radius"
   - "GEOCODE_FROM_NOT_FOUND" or "GEOCODE_TO_NOT_FOUND"

2. **OUTSIDE_BOUNDS**
   - "The location is outside the bounds of the transit graph"

## When Does This Happen?

### 1. **Location Too Far from Transit**
Most common cause. OTP can't find any transit stops within the `maxWalkDistance` radius.

**Example**: An apartment in a residential area 2km from the nearest station, but `maxWalkDistance` is set to 1000m (1km).

**Solution**: Increase `maxWalkDistance` parameter:
```javascript
// Default
maxWalkDistance: '1000'  // 1km

// For areas with sparse transit
maxWalkDistance: '2000'  // 2km
maxWalkDistance: '3000'  // 3km
```

### 2. **Coordinates Outside Service Area**
OTP only has transit data for the area covered by your GTFS feed.

**Example**: Trying to route to coordinates in Chiba when OTP only has Tokyo Metro data.

**Solution**: 
- Verify coordinates are within your GTFS coverage area
- Load additional GTFS data for wider coverage

### 3. **Invalid or Imprecise Coordinates**
Coordinates that fall in inaccessible areas.

**Examples**:
- Middle of Tokyo Bay: `35.6000, 139.8000`
- Inside a large park with no nearby roads
- On a highway with no pedestrian access

**Solution**: 
- Verify coordinates are accurate
- Use geocoding to get precise building locations
- Ensure coordinates are on or near roads/walkable areas

### 4. **No Street Network Data**
OTP needs OpenStreetMap (OSM) data to connect coordinates to transit stops.

**Symptoms**: Even locations next to stations return "not found"

**Solution**: 
- Ensure OSM data is loaded in OTP
- Verify OSM data covers your area
- Check OTP build logs for street data errors

### 5. **Graph Build Issues**
The OTP graph wasn't built correctly.

**Symptoms**: 
- Inconsistent errors
- Some nearby locations work, others don't
- Used to work but stopped

**Solution**:
- Rebuild OTP graph
- Check build logs for errors
- Verify all data files are present

## Diagnostic Steps

### 1. Run the Diagnostic Script
```bash
npm run diagnose-otp -- --lat 35.6812 --lon 139.7671
```

This will:
- Check if OTP is running
- Test route planning
- Validate coordinates
- Try different walk distances

### 2. Manual Checks

#### Check if location is near transit:
```bash
# Use Google Maps or similar to verify transit exists nearby
# Look for train/subway stations within 1-2km
```

#### Test with known good coordinates:
```bash
# Tokyo Station
npm run test-transit-route -- --from "35.6812,139.7671" --to "35.6580,139.7016"
```

#### Try increasing walk distance:
```javascript
// In your API call
maxWalkDistance: '3000'  // 3km - very generous
```

### 3. Common Tokyo Areas That May Have Issues

- **Residential areas in outer wards**: May be 2-3km from stations
- **Bay area/Odaiba**: Some parts have limited transit
- **Industrial areas**: Often have poor pedestrian access
- **Parks and gardens**: Coordinates inside may not be routable

## Best Practices

### 1. **Handle Errors Gracefully**
```javascript
if (data.error?.id === '404' || data.error?.msg?.includes('LOCATION')) {
  // Fall back to straight-line distance estimate
  // Or increase walk distance and retry
  // Or use nearest station instead
}
```

### 2. **Use Appropriate Walk Distances**
```javascript
// Urban core (Shibuya, Shinjuku, etc)
maxWalkDistance: '800'   // 800m is usually enough

// Suburban areas
maxWalkDistance: '1500'  // 1.5km for less dense areas

// Rural/sparse areas
maxWalkDistance: '3000'  // 3km as last resort
```

### 3. **Validate Coordinates First**
```javascript
function isInTokyoArea(lat: number, lon: number): boolean {
  return lat >= 35.3 && lat <= 36.0 && 
         lon >= 139.3 && lon <= 140.1;
}
```

### 4. **Cache Failed Locations**
Keep track of locations that consistently fail to avoid repeated API calls.

## Fallback Strategies

When OTP can't find a route:

1. **Use Nearest Station**
   - Find the nearest station to the coordinates
   - Route from station to station instead

2. **Increase Walk Distance**
   - Try progressively larger distances
   - Cap at reasonable maximum (3-5km)

3. **Estimate Based on Distance**
   - Use straight-line distance
   - Apply typical travel speed estimates

4. **Mark as "Transit Not Available"**
   - Be transparent with users
   - Show walking distance to nearest station

## Example Error Handling

```javascript
async function getRouteWithFallback(fromLat, fromLon, toLat, toLon) {
  // Try with normal walk distance
  let result = await tryRoute(fromLat, fromLon, toLat, toLon, 1000);
  
  if (result.error?.id === '404') {
    // Try with increased walk distance
    result = await tryRoute(fromLat, fromLon, toLat, toLon, 2000);
    
    if (result.error) {
      // Try with maximum walk distance
      result = await tryRoute(fromLat, fromLon, toLat, toLon, 3000);
      
      if (result.error) {
        // Fall back to nearest station routing
        const nearestFrom = await findNearestStation(fromLat, fromLon);
        const nearestTo = await findNearestStation(toLat, toLon);
        
        if (nearestFrom && nearestTo) {
          result = await tryRoute(
            nearestFrom.lat, 
            nearestFrom.lon,
            nearestTo.lat,
            nearestTo.lon,
            1000
          );
        }
      }
    }
  }
  
  return result;
}
```

## Testing Your Fix

1. **Test with problematic coordinates**:
   ```bash
   npm run diagnose-otp -- --lat [problematic_lat] --lon [problematic_lon]
   ```

2. **Compare with known working route**:
   ```bash
   # Should work - major stations
   npm run test-transit-station -- --from "Shinjuku" --to "Tokyo"
   ```

3. **Test edge cases**:
   - Coordinates in parks
   - Residential areas
   - Near water
   - Industrial zones

Remember: "Geocode not found" usually means "no transit access found within walking distance" rather than "invalid coordinates".