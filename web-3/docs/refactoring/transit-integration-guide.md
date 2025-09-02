# Transit Integration Guide

## Overview

The Tokyo Apartment Finder uses a hybrid transit routing system that automatically falls back to local data when external services are unavailable.

## Architecture

```
┌─────────────────────────────────┐
│    Application Code             │
└────────────┬────────────────────┘
             │
┌────────────▼────────────────────┐
│  SimplifiedOTPService           │ ◄── Primary Interface
│  - Auto-fallback logic          │
│  - Clean API                    │
└────────────┬────────────────────┘
             │
       ┌─────┴─────┐
       │           │
┌──────▼─────┐ ┌──▼──────────────┐
│    OTP     │ │ Transit Graph   │
│  Service   │ │   Service       │
│ (External) │ │   (Local)       │
└────────────┘ └─────────────────┘
```

## Usage Examples

### Basic Route Calculation

```typescript
import { getSimplifiedOTPService } from '@/lib/transit';

const transitService = await getSimplifiedOTPService();

// Calculate commute time (returns minutes or null)
const commuteTime = await transitService.calculateCommute(
  fromLat, fromLon,
  toLat, toLon,
  maxMinutes
);

// Get detailed route information
const route = await transitService.getRoute(
  fromLat, fromLon,
  toLat, toLon,
  maxMinutes
);
```

### Finding Reachable Stations

```typescript
// Find all stations reachable within time limit
const stations = await transitService.findReachableLocations(
  fromLat, fromLon,
  maxMinutes
);
```

### Service Status Check

```typescript
// Check which service is being used
const status = transitService.getStatus();
console.log('Using OTP:', status.otpAvailable);
console.log('Transit graph loaded:', status.transitGraphLoaded);
```

## Configuration

### Environment Variables

```bash
# Optional - enables OpenTripPlanner integration
# If not set, uses local transit graph only
OTP_ENDPOINT=http://localhost:8080/otp/routers/default
```

### Service Behavior

1. **With OTP configured**: Tries OTP first, falls back to transit graph if unavailable
2. **Without OTP**: Always uses local transit graph (1190 Tokyo stations)
3. **Automatic fallback**: No configuration needed, handles failures gracefully

## Integration Points

### Search Integration Service

The main integration point for apartment search:

```typescript
// src/lib/search/search-integration.ts
const transitService = await getSimplifiedOTPService();
const stations = await transitService.findReachableLocations(
  workplaceCoords.lat,
  workplaceCoords.lon,
  maxCommuteMinutes
);
```

### List Refresh Service

For recalculating routes:

```typescript
// src/server/services/list-refresh.service.ts
const transitService = await getSimplifiedOTPService();
const route = await transitService.getRoute(
  apartment.latitude,
  apartment.longitude,
  targetStation.latitude,
  targetStation.longitude,
  120 // max 2 hours
);
```

## Best Practices

1. **Always use SimplifiedOTPService** - Don't use the legacy OTP service directly
2. **Handle null returns** - Routes may not be found for some locations
3. **Set reasonable limits** - Max commute time should typically be 60-120 minutes
4. **Check service status** - Log which backend is being used for debugging

## Testing

### Unit Tests
- Mock service available for predictable testing
- Use `MockTransitService` only for unit tests

### Integration Tests
- Test with real transit graph data
- Verify fallback behavior works correctly

### Manual Testing
```bash
# Test transit integration
npx tsx scripts/test-transit-cleanup.ts
```

## Performance Considerations

1. **Transit Graph** (Local)
   - Fast: ~50ms per route calculation
   - Always available
   - Less accurate for walking segments

2. **OTP** (External)
   - Slower: ~200-500ms per route
   - More accurate with multimodal routing
   - Requires external server

3. **Caching**
   - Routes are not cached by default
   - Implement application-level caching if needed

## Common Issues

### No Routes Found
- Check coordinates are valid Tokyo locations
- Verify stations exist within 1km walking distance
- Increase maxMinutes parameter

### OTP Not Working
- Check OTP_ENDPOINT environment variable
- Verify OTP server is running
- Service automatically falls back to transit graph

### Performance Issues
- Use transit graph for bulk operations
- Implement batching for multiple routes
- Consider caching frequently used routes

## Future Improvements

1. **Coordinate Fixes**: 261 stations need coordinate data
2. **Walking Time**: Improve walking segment calculations
3. **Real-time Data**: Consider delay information
4. **Route Caching**: Add intelligent caching layer