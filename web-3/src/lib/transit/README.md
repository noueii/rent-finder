# Transit Services

This directory contains transit routing services for the Tokyo Apartment Finder application.

## Overview

The transit module provides multiple ways to calculate reachable stations and routes:

1. **Transit Graph** (Recommended) - Local pre-computed Tokyo transit data with 1190 stations
2. **Simplified OTP Service** - Clean interface with optional OpenTripPlanner integration
3. **Legacy OTP Service** - Complex implementation with extensive caching (consider using simplified version)
4. **Mock Service** - Basic distance-based calculations for testing

## Current Status

- ✅ **Transit Graph**: Working perfectly with full Tokyo coverage
- ❌ **OTP**: Not configured/running (requires separate server setup)
- ⚠️ **Data Quality**: 261 stations missing coordinates (being addressed)

## Recommended Usage

### Simplified OTP Service (Recommended)

The simplified service provides a clean interface with automatic fallback:

```typescript
import { getSimplifiedOTPService } from '@/lib/transit';

// Get the service instance
const transitService = await getSimplifiedOTPService();

// Calculate a route (automatically uses OTP if available, falls back to graph)
const route = await transitService.getRoute(
  fromLat, fromLon,
  toLat, toLon,
  maxMinutes
);

// Calculate commute time
const minutes = await transitService.calculateCommute(
  fromLat, fromLon,
  toLat, toLon,
  maxMinutes
);

// Find reachable stations
const stations = await transitService.findReachableLocations(
  fromLat, fromLon,
  maxMinutes
);

// Check service status
const status = transitService.getStatus();
console.log('Using OTP:', status.otpAvailable);
console.log('Transit graph loaded:', status.transitGraphLoaded);
```

### Direct Transit Graph Usage

For maximum performance when OTP is not needed:

```typescript
import { getTransitService } from '@/lib/transit';

const transitService = await getTransitService();

// Find reachable stations from a specific station
const stations = transitService.findReachableStations(
  startStationId,
  maxMinutes
);

// Search for stations by name
const results = transitService.findStation('Shinjuku');
```

## Configuration

### Environment Variables

```bash
# Optional - if not set, uses transit graph only
OTP_ENDPOINT=http://localhost:8080/otp/routers/default
```

## Implementation Details

### Transit Graph
- **Data Source**: Pre-computed graph at `../lines/tokyo_transit_graph_complete.json`
- **Stations**: 1190 stations (929 with valid coordinates)
- **Algorithm**: Dijkstra's algorithm with transfer penalties
- **Transfer Penalty**: 5 minutes per transfer

### Coordinate Handling
The services handle multiple coordinate formats:
- Array format: `[longitude, latitude]`
- Object format: `{ lat: number, lon: number }`

### Distance Calculations
- Uses Haversine formula for accurate distance
- Maximum walking distance: 1km to nearest station

## Performance Comparison

| Service | Pros | Cons |
|---------|------|------|
| Transit Graph | Fast, no external deps, always available | No walking routes, less accurate |
| OTP | Accurate, multimodal, real-time | Requires server, slower, complex setup |
| Mock | Simple, fast | Not realistic, testing only |

## Migration Guide

If you're using the legacy OTP service, migrate to the simplified version:

```typescript
// Old
import { getOTPService } from '@/lib/transit';
const otp = await getOTPService();
const route = await otp.calculateRoute(...);

// New
import { getSimplifiedOTPService } from '@/lib/transit';
const transit = await getSimplifiedOTPService();
const route = await transit.getRoute(...);
```

## Future Improvements

1. **Fix Missing Coordinates**: 261 stations need coordinate data
2. **Walking Integration**: Add proper walking time calculations
3. **Real-time Updates**: Consider integrating delay information
4. **Performance**: Pre-compute common routes for faster queries

## Testing

```bash
# Test transit services
npx tsx scripts/test-transit-cleanup.ts

# Legacy OTP test (if needed)
npm run test:otp
```