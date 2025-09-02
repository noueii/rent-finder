# Station ID Mapping Summary

## Overview
Successfully created mapping between CLI tool station IDs and realestate.co.jp station IDs.

## Statistics
- **Total CLI Stations**: 1,190
- **Total Realestate Stations**: 965
- **Successfully Mapped**: 547 stations (46.0%)
  - Exact Name Matches: 438
  - Fuzzy Name Matches: 109
  - Stations within 100m: 466
- **Unmapped CLI Stations**: 643
- **Unmapped Realestate Stations**: 419

## Mapping Structure

The `station_id_mapping.json` file contains:

```json
{
  "byCliId": {
    "00006668": {
      "cliId": "00006668",
      "cliName": "Tokyo",
      "cliNameJa": "東京",
      "realestateId": "100201",
      "realestateName": "Tokyo",
      "groupId": 1130101,
      "matchType": "exact",
      "matchScore": 100,
      "distance": 158,
      "coordinates": {...}
    }
  },
  "byRealestateId": {...},
  "byGroupId": {...},
  "unmappedCli": [...],
  "unmappedRealestate": [...],
  "statistics": {...}
}
```

## Key Features

1. **Multiple Access Methods**:
   - `byCliId`: Look up by CLI tool station ID
   - `byRealestateId`: Look up by realestate.co.jp station ID
   - `byGroupId`: Group stations by realestate group ID

2. **Match Quality Indicators**:
   - `matchType`: "exact" or "fuzzy"
   - `matchScore`: 0-100 score indicating match quality
   - `distance`: Distance in meters between coordinates

3. **Comprehensive Data**:
   - Station names in both English and Japanese
   - Coordinates from both sources
   - Group IDs for station grouping

## Why Only 46% Match Rate?

1. **Geographic Scope**: 
   - CLI tool includes stations outside Tokyo (Yokohama, Kamakura, etc.)
   - Realestate.co.jp only includes Tokyo prefecture stations

2. **Missing Lines**:
   - Some train lines in CLI tool aren't present in realestate data
   - Shinkansen lines are in realestate but not in CLI tool

3. **Station Name Variations**:
   - Different romanization styles (Shimbashi vs Shinbashi)
   - Station name suffixes and prefixes

## Usage in Application

To use this mapping in the rent-finder application:

```javascript
const mapping = require('./station_id_converter/station_id_mapping.json');

// Get realestate ID from CLI ID
const cliStationId = "00006668"; // Tokyo
const realestateData = mapping.byCliId[cliStationId];
if (realestateData) {
    console.log(`Realestate ID: ${realestateData.realestateId}`);
    console.log(`Group ID: ${realestateData.groupId}`);
}

// Get CLI ID from realestate ID
const realestateId = "100201";
const cliData = mapping.byRealestateId[realestateId];
if (cliData) {
    console.log(`CLI ID: ${cliData.cliId}`);
}
```

## Next Steps

1. **Integration**: Update the web app's real-time search to use these mapped IDs
2. **Fallback**: For unmapped stations, use coordinate-based matching
3. **Enhancement**: Consider adding more fuzzy matching rules for better coverage