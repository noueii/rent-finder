# Geocoding Service

This module provides geocoding capabilities for the Tokyo Apartment Finder application, converting Japanese addresses to latitude/longitude coordinates.

## Features

- 🗾 **Japanese Address Support**: Specialized handling for Japanese addresses including full-width to half-width conversion
- 💾 **Built-in Caching**: In-memory cache with 30-day TTL and LRU eviction
- 🔒 **Rate Limiting**: Respects API rate limits (1 request/second for Nominatim)
- 🔄 **Batch Processing**: Efficient bulk geocoding with progress tracking
- 🏢 **Database Integration**: Seamless integration with Prisma and apartment data
- 🤖 **Scraper Integration**: Automatic geocoding during apartment scraping

## Usage

### Basic Geocoding

```typescript
import { geocodingService } from '@/lib/geocoding';

// Geocode a single address
const result = await geocodingService.geocode('東京都渋谷区道玄坂1-12-1');
if (result) {
  console.log(`Coordinates: ${result.latitude}, ${result.longitude}`);
}
```

### Batch Geocoding

```typescript
// Geocode multiple addresses with progress tracking
const addresses = ['address1', 'address2', 'address3'];
const results = await geocodingService.batchGeocode(
  addresses,
  {},
  (completed, total) => {
    console.log(`Progress: ${completed}/${total}`);
  }
);
```

### Database Integration

```typescript
import { ApartmentGeocoder } from '@/lib/geocoding/apartment-geocoder';
import { db } from '@/server/db';

const geocoder = new ApartmentGeocoder(db);

// Geocode a single apartment
const result = await geocoder.geocodeApartment('apartment-id');

// Batch geocode apartments without coordinates
const results = await geocoder.geocodeUngeocoded(100);

// Get geocoding statistics
const stats = await geocoder.getStats();
```

### Scraper Integration

```typescript
import { GeocodingEnhancedScraper } from '@/lib/scrapers';

// Your scraper should extend GeocodingEnhancedScraper
export class MyScraper extends GeocodingEnhancedScraper {
  // Addresses will be automatically geocoded during scraping
}
```

## API Endpoints

### Admin Geocoding Endpoint

```bash
# Geocode apartments without coordinates
POST /api/admin/geocode
{
  "limit": 10,
  "sourceSite": "SUUMO" // optional
}

# Get geocoding statistics
GET /api/admin/geocode
```

## Configuration

### Cache Settings
- **TTL**: 30 days
- **Max Size**: 10,000 entries
- **Eviction**: LRU (Least Recently Used)

### Rate Limiting
- **Nominatim**: 1 request per second
- **Batch Size**: 10 addresses by default

## Japanese Address Handling

The service includes specialized handling for Japanese addresses:

1. **Number Conversion**: Full-width numbers (０-９) → Half-width (0-9)
2. **Hyphen Normalization**: Various dash characters → Standard hyphen
3. **Country Addition**: Automatically appends ", 日本" if not present
4. **Component Extraction**: Parses prefecture, city, ward, etc.

## Testing

```bash
# Test geocoding service
npx tsx src/lib/geocoding/test-geocoding.ts

# Test database integration
npx tsx scripts/test-geocoding-integration.ts
```

## Error Handling

The service handles various error scenarios:
- Network timeouts (10 second default)
- Invalid coordinates
- Rate limit exceeded
- No results found

All errors are logged and the service returns `null` rather than throwing.

## Future Enhancements

1. **Multiple Providers**: Add fallback providers (Google Maps, Mapbox)
2. **Background Jobs**: Process large batches in background
3. **Admin UI**: Visual geocoding status and controls
4. **Accuracy Scoring**: Confidence levels for geocoded results
5. **Address Validation**: Pre-validate addresses before geocoding