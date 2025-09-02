# RealEstate.co.jp Scraper Analysis

## Overview
This document provides a comprehensive analysis of the realestate.co.jp website structure and the enhanced TypeScript scraper implementation for the Tokyo Rent Finder project.

## Website Structure Analysis

### URL Parameters
The realestate.co.jp search URLs use the following parameters:

```
https://realestate.co.jp/en/rent?prefecture=JP-13&city=&trainline=11313&station=1130222&min_price=&max_price=140000&min_meter=30&rooms=5&distance_station=20&agent_id=&building_type=&building_age=40&updated_within=&transaction_type=&order=&search=Search
```

**Parameter Breakdown:**
- `prefecture`: `JP-13` (Tokyo prefecture code)
- `city`: Optional city filter (empty for all of Tokyo)
- `trainline`: Train line ID (e.g., `11313` for JR Keihin-Tohoku Line)
- `station`: Station ID (e.g., `1130222` for Ikegami Station)
- `min_price` / `max_price`: Price range filters in yen
- `min_meter`: Minimum apartment size in square meters
- `rooms`: Maximum number of rooms
- `distance_station`: Maximum walking distance to station in minutes
- `building_age`: Maximum building age in years
- `order`: Sort order (`relevance`, `price_asc`, `size_desc`, `date_desc`)

### HTML Structure

#### Listing Container
- **Primary selector**: `.property-listing`
- **Alternative selectors**: `.listing-item`, `.property-card`
- **Fallback selectors**: `div[class*="listing"]`, `a[href*="/rent/view/"]`

#### Individual Listing Data Fields

1. **Title/Name**: `.listing-title .text-semi-strong`
   - Format: "[Layout] Apartment in [Neighborhood]"
   - Example: "1K Apartment in Ikegami"

2. **Location**: `.listing-title span:not(.text-semi-strong)`
   - Contains area and ward separated by `<br/>` tags
   - Example: "Ikegami<br/>Ota-ku, Tokyo"

3. **Property Link**: `.listing-title a`
   - Relative URL format: `/en/rent/view/[property_id]`
   - Example: `/en/rent/view/854938`

4. **Data Fields Pattern**: `<span>Label</span>` followed by value in next sibling
   - Monthly Costs: `<span>Monthly Costs</span>` → next sibling contains price
   - Size: `<span>Size</span>` → next sibling contains "XX.XX m²"
   - Deposit: `<span>Deposit</span>` → next sibling contains deposit amount
   - Key Money: `<span>Key Money</span>` → next sibling contains key money
   - Floor: `<span>Floor</span>` → next sibling contains "X / XF"
   - Year Built: `<span>Year Built</span>` → next sibling contains year
   - Nearest Station: `<span>Nearest Station</span>` → next sibling contains "Station Name (X min. walk)"

5. **Availability**: `.text-success`
   - Contains availability status text

6. **Images**: `img[src*="media.realestate.co.jp"]`
   - Property images hosted on their media domain

### Data Extraction Pattern

The scraper follows this pattern for each listing:

```typescript
// 1. Extract title and parse layout
const title = element.querySelector('.listing-title .text-semi-strong')?.textContent;
const layout = title.match(/(\d+[SLDK]+)/i)?.[1];

// 2. Extract location
const locationContainer = element.querySelector('.listing-title span:not(.text-semi-strong)');
const [area, ward] = locationContainer?.innerHTML.split('<br/>') || [];

// 3. Extract data fields using label pattern
const monthlyCost = findNextSibling(element, 'Monthly Costs');
const size = findNextSibling(element, 'Size');
const deposit = findNextSibling(element, 'Deposit');
// ... etc for other fields

// 4. Extract station information
const stationText = findNextSibling(element, 'Nearest Station');
const stationName = stationText.match(/([^(]+)/)?.[1]?.trim();
const walkingMinutes = stationText.match(/(\d+)\s*min/)?.[1];
```

## Enhanced Scraper Implementation

### Key Improvements Made

1. **Proper URL Generation**: 
   - Comprehensive parameter handling
   - Pagination support
   - Flexible search options

2. **Robust Data Extraction**:
   - Improved sibling node parsing
   - Better error handling
   - Alternative selector fallbacks

3. **Station/Line ID Mapping**:
   - Station name to ID mapping
   - Train line name to ID mapping
   - Integration points for transit data

4. **Pagination Support**:
   - Automatic pagination URL generation
   - Next page detection
   - Result count parsing

### Usage Examples

```typescript
// Generate search URLs for a specific station
const searchUrls = realEstateScraper.generateSearchUrls({
  stationId: '1130222',     // Ikegami Station
  trainlineId: '11313',     // JR Keihin-Tohoku Line
  maxPrice: 140000,         // ¥140,000 max rent
  minSize: 30,              // 30m² minimum
  maxWalkingDistance: 20,   // 20 minutes max walk
  maxBuildingAge: 40,       // 40 years max age
  sortBy: 'price'           // Sort by price
});

// Parse apartment listings from HTML
const apartments = realEstateScraper.parseApartmentListing(html, sourceUrl);

// Check if more pages exist
const hasMore = realEstateScraper.hasNextPage(html);
```

## Integration with Transit System

The scraper is designed to integrate with the existing transit calculation system:

1. **Station Mapping**: Convert station names from transit data to realestate.co.jp station IDs
2. **Line Mapping**: Convert train line names to realestate.co.jp line IDs
3. **Reachability Integration**: Use transit reachability results to generate multiple search URLs

## Rate Limiting and Respectful Scraping

The scraper includes considerations for:
- Rate limiting between requests
- Respecting robots.txt
- Error handling for blocked requests
- Caching to reduce duplicate requests

## Data Output Structure

Each scraped apartment returns a `ScrapedApartment` object with:

```typescript
interface ScrapedApartment {
  sourceUrl: string;
  sourceSite: string;
  title: string;
  buildingName: string;
  unitNumber?: string;
  rentMonthly: number;
  keyMoney?: number;
  deposit?: number;
  size: number;
  layout: string;
  prefecture: string;
  city: string;
  ward: string;
  address: string;
  buildingAge?: number;
  buildYear?: number;
  floor?: string;
  totalFloors?: number;
  features: string[];
  imageUrls: string[];
  stationName: string;
  walkingMinutes: number;
  isAvailable: boolean;
}
```

## Testing and Validation

The scraper includes testing utilities:
- `testScraper()`: Test URL generation and parameter parsing
- `getStationMappingFromTransitData()`: Integration with transit data
- Console logging for debugging parsing issues

## Next Steps

1. **Station/Line ID Mapping**: Populate complete mapping from transit data
2. **Real-time Testing**: Test with actual HTML responses
3. **Error Handling**: Add retry logic and better error reporting
4. **Performance**: Implement caching and request queuing
5. **Validation**: Add data validation and sanitization
6. **Integration**: Connect with the search service and database

## Files Modified

- `/web/src/services/scrapers/realestate-scraper.ts`: Enhanced scraper implementation
- `/web/REALESTATE_SCRAPER_ANALYSIS.md`: This analysis document

The enhanced scraper provides a solid foundation for real-time apartment data extraction from realestate.co.jp, with proper URL generation, robust data parsing, and integration points for the existing transit system.