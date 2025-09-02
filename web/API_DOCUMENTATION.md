# Tokyo Rent Finder API Documentation

## Overview

This document describes the tRPC API endpoints for the Tokyo Rent Finder application. The API provides comprehensive apartment search functionality based on commute time, station data, and various filters.

## Base URL

All API endpoints are available at `/api/trpc/` with the following routers:

- `station.*` - Station-related operations
- `apartment.*` - Apartment search and retrieval
- `system.*` - System health and analytics

## Station Router (`station.*`)

### `station.search`

Search for stations by name (supports fuzzy matching).

**Input:**
```typescript
{
  query: string,      // Search query (min 1, max 50 chars)
  limit?: number      // Max results (default: 10, max: 50)
}
```

**Output:**
```typescript
Station[] // Array of matching stations
```

### `station.getById`

Get detailed information about a specific station.

**Input:**
```typescript
{
  stationId: string   // Station ID (required)
}
```

**Output:**
```typescript
Station | null
```

### `station.reachable`

Find all stations reachable within a specified time from a given station.

**Input:**
```typescript
{
  stationId: string,   // Origin station ID
  maxMinutes: number   // Max travel time (1-120 minutes)
}
```

**Output:**
```typescript
{
  stations: ReachableStation[],
  count: number,
  maxMinutes: number,
  fromStation: Station | null
}
```

### `station.travelTime`

Calculate travel time between two stations.

**Input:**
```typescript
{
  fromStationId: string,  // Origin station ID
  toStationId: string     // Destination station ID
}
```

**Output:**
```typescript
{
  travel_time: number,    // Total travel time in minutes
  transfers: number,      // Number of transfers required
  path: PathSegment[]     // Detailed route information
}
```

### `station.popular`

Get popular stations based on search frequency.

**Input:**
```typescript
{
  limit?: number,    // Max results (default: 10, max: 50)
  days?: number      // Time period in days (default: 30, max: 365)
}
```

**Output:**
```typescript
Array<Station & { searchCount: number }>
```

### `station.suggestions`

Get station suggestions for autocomplete with apartment counts.

**Input:**
```typescript
{
  query: string,     // Search query (min 2, max 50 chars)
  limit?: number     // Max results (default: 10, max: 20)
}
```

**Output:**
```typescript
Array<Station & { apartmentCount: number }>
```

### `station.list`

Get all stations with pagination.

**Input:**
```typescript
{
  limit?: number,    // Results per page (default: 20, max: 100)
  offset?: number    // Starting position (default: 0)
}
```

**Output:**
```typescript
{
  stations: Station[],
  total: number
}
```

### `station.stats`

Get statistics for a specific station.

**Input:**
```typescript
{
  stationId: string   // Station ID
}
```

**Output:**
```typescript
{
  station: Station,
  apartmentCount: number,
  averageRent: number,
  averageSize: number,
  averageWalkingTime: number,
  rentRange: { min: number, max: number },
  sizeRange: { min: number, max: number }
}
```

## Apartment Router (`apartment.*`)

### `apartment.searchByCommute`

Main search endpoint - find apartments within commute range with filters.

**Input:**
```typescript
{
  targetStationId: string,        // Work/school station ID
  maxCommuteMinutes: number,      // Max commute time (1-120 minutes)
  filters?: {
    maxPrice?: number,            // Max monthly rent
    minPrice?: number,            // Min monthly rent
    minSize?: number,             // Min size in m²
    maxSize?: number,             // Max size in m²
    layouts?: string[],           // Room layouts (1K, 1LDK, etc.)
    features?: string[],          // Required features
    maxWalkingMinutes?: number,   // Max walking time to station
    buildingTypes?: string[],     // Building types
    maxBuildingAge?: number,      // Max building age in years
    hasImages?: boolean,          // Must have images
    petFriendly?: boolean         // Pet-friendly properties
  },
  limit?: number,                 // Results per page (default: 20, max: 50)
  offset?: number,                // Starting position (default: 0)
  sortBy?: 'price' | 'size' | 'commute_time' | 'building_age',
  sortOrder?: 'asc' | 'desc'      // Sort order (default: 'asc')
}
```

**Output:**
```typescript
{
  apartments: EnrichedApartment[],  // Apartment data with commute info
  pagination: {
    total: number,
    limit: number,
    offset: number,
    hasMore: boolean
  },
  searchMetadata: {
    stationsSearched: number,
    searchDurationMs: number,
    targetStation: Station | null
  }
}
```

### `apartment.getById`

Get detailed information about a specific apartment.

**Input:**
```typescript
{
  apartmentId: string,      // Apartment ID (required)
  fromStationId?: string    // Optional: calculate commute from this station
}
```

**Output:**
```typescript
Apartment & {
  commute: {
    totalMinutes: number,
    transitMinutes: number,
    walkingMinutes: number,
    transferCount: number,
    route: PathSegment[]
  }
}
```

### `apartment.nearStation`

Get apartments near a specific station.

**Input:**
```typescript
{
  stationId: string,        // Station ID
  filters?: SearchFilters,  // Same as searchByCommute
  limit?: number,
  offset?: number,
  sortBy?: string,
  sortOrder?: 'asc' | 'desc'
}
```

**Output:**
```typescript
{
  apartments: Apartment[],
  pagination: PaginationInfo
}
```

### `apartment.getFilters`

Get available filter options for apartment search.

**Input:** None

**Output:**
```typescript
{
  layouts: Array<{ layout: string, count: number }>,
  features: Array<{ feature: string, count: number }>,
  buildingTypes: Array<{ buildingType: string, count: number }>,
  priceRange: { min: number, max: number },
  sizeRange: { min: number, max: number },
  buildingAgeRange: { min: number, max: number }
}
```

## System Router (`system.*`)

### `system.health`

Check system health status.

**Input:**
```typescript
{
  includeDatabase?: boolean,  // Check database connection
  includeTransit?: boolean    // Check transit service
}
```

**Output:**
```typescript
{
  status: 'healthy' | 'unhealthy',
  timestamp: string,
  checks: {
    api: { status: string, timestamp: string },
    database?: { status: string, timestamp: string },
    transit?: { status: string, timestamp: string }
  }
}
```

### `system.stats`

Get system statistics.

**Input:** None

**Output:**
```typescript
{
  apartments: {
    total: number,
    available: number,
    occupancyRate: string
  },
  stations: {
    total: number
  },
  searches: {
    total: number,
    recent: number,
    averagePerDay: string
  },
  topStations: Array<{
    stationId: string,
    stationName: string,
    searchCount: number
  }>
}
```

### `system.searchAnalytics`

Get search analytics data.

**Input:**
```typescript
{
  includeDatabase?: boolean,
  days?: number              // Analysis period (default: 7)
}
```

**Output:**
```typescript
{
  period: {
    days: number,
    from: string,
    to: string
  },
  totalSearches: number,
  averageResults: {
    total: number,
    returned: number
  },
  averageSearchDuration: number,
  popularFilters: Array<{ filter: string, count: number }>,
  commuteTimeDistribution: Array<{ minutes: number, count: number }>
}
```

### `system.databaseInfo`

Get database statistics and information.

**Input:** None

**Output:**
```typescript
{
  sources: Array<{ site: string, count: number }>,
  layouts: Array<{ layout: string, count: number }>,
  priceDistribution: Record<string, number>,
  recentlyUpdated: Array<{
    id: string,
    title: string,
    sourceSite: string,
    updatedAt: Date,
    rentMonthly: number,
    station: { name: string }
  }>
}
```

## Data Types

### Station
```typescript
interface Station {
  id: string;
  name: string;
  name_ja: string;
  lines: string[];
  coordinates?: [number, number];
}
```

### ReachableStation
```typescript
interface ReachableStation {
  station_id: string;
  name: string;
  name_ja: string;
  travel_time: number;
  coordinates?: [number, number];
  transfers: number;
  path: PathSegment[];
}
```

### PathSegment
```typescript
interface PathSegment {
  from: string;
  to: string;
  line: string;
  line_id: string;
  train_type: string;
  time: number;
  transfer: boolean;
}
```

### EnrichedApartment
```typescript
interface EnrichedApartment {
  // Basic apartment data
  id: string;
  title: string;
  buildingName: string;
  unitNumber: string | null;
  rentMonthly: number;
  managementFee: number | null;
  keyMoney: number | null;
  deposit: number | null;
  size: number;
  sizeJo: number | null;
  layout: string;
  address: string;
  walkingMinutes: number;
  buildingType: string | null;
  buildingAge: number | null;
  buildYear: number | null;
  features: string[];
  nearbyFacilities: string[];
  imageUrls: string[];
  floorPlanUrl: string | null;
  sourceUrl: string;
  sourceSite: string;
  availableFrom: Date | null;
  station: {
    id: string;
    name: string;
    nameJa: string;
  };
  
  // Commute information
  commute: {
    totalMinutes: number;
    transitMinutes: number;
    walkingMinutes: number;
    transferCount: number;
    route: PathSegment[];
  };
}
```

## Error Handling

All endpoints use tRPC's built-in error handling with proper HTTP status codes:

- `400 BAD_REQUEST` - Invalid input parameters
- `404 NOT_FOUND` - Resource not found
- `500 INTERNAL_SERVER_ERROR` - Server error

Errors include detailed messages and, for validation errors, specific field information.

## Rate Limiting

Search endpoints (`apartment.searchByCommute`) are rate-limited to prevent abuse. Other endpoints have caching for performance.

## Authentication

Currently, all endpoints are public. Future versions may include authentication for certain features.

## Usage Examples

### Search for apartments with 30-minute commute to Tokyo Station

```typescript
const result = await trpc.apartment.searchByCommute.query({
  targetStationId: "00006668", // Tokyo Station ID
  maxCommuteMinutes: 30,
  filters: {
    maxPrice: 150000,
    minSize: 20,
    layouts: ["1K", "1DK"],
    hasImages: true
  },
  limit: 20,
  sortBy: "commute_time"
});
```

### Get station suggestions for autocomplete

```typescript
const suggestions = await trpc.station.suggestions.query({
  query: "shinjuku",
  limit: 5
});
```

### Check system health

```typescript
const health = await trpc.system.health.query({
  includeDatabase: true,
  includeTransit: true
});
```

## Performance Notes

- Station searches are cached for better performance
- Reachable station calculations are computationally expensive and may take 1-3 seconds
- Apartment searches are optimized with database indexes
- All endpoints support pagination for large result sets