# Unmatched Stations in Output

After running the apartment dictionary builder with station ID matching, unmatched stations are stored in multiple places for debugging:

## 1. In the JSON Output File

The unified apartment JSON will include unmatched station information in three places:

### a) In the metadata section:
```json
{
  "metadata": {
    "stationMatching": {
      "processedAt": "2025-01-15T12:00:00.000Z",
      "totalStations": 500,
      "matched": 475,
      "unmatched": 25,
      "matchRate": "95.00%",
      "unmatchedStations": [
        "Hasunuma (JR Keihin-Tohoku)",
        "Kanamecho (Tokyo Metro Yurakucho)",
        "Nishidai (Toei Mita)",
        "Suijin (Keisei Main Line)"
      ],
      "unmatchedDetails": [
        {
          "originalName": "Hasunuma",
          "normalizedName": "hasunuma",
          "line": "JR Keihin-Tohoku",
          "apartmentId": "realestate_12345",
          "apartmentUrl": "https://realestate.co.jp/property/12345"
        },
        // ... more detailed entries
      ]
    }
  }
}
```

### b) In each apartment's station data:
```json
{
  "stations": [
    {
      "name": "Shibuya",
      "line": "JR Yamanote",
      "walkingMinutes": 5,
      "stationId": "00001234",
      "matchedWith": "Shibuya",
      "matchedWithJa": "渋谷"
    },
    {
      "name": "Hasunuma",
      "line": "JR Keihin-Tohoku",
      "walkingMinutes": 10,
      "stationId": null,
      "matchStatus": "unmatched"
    }
  ]
}
```

## 2. In the Unmatched Stations Report File

A separate text file `unified_apartments_[timestamp]_unmatched_stations.txt` will be created with detailed debugging information:

```
Unmatched Stations Debugging Report
===================================
Total Unmatched: 25

Detailed Analysis:

"hasunuma" (appears 15 times)
  Original forms:
    - Hasunuma (JR Keihin-Tohoku)
    - Hasunuma (JR Keihin-Tohoku Line)
    - Hasunuma Station (JR)
  Possible matches in transit graph:
    - Hasune (蓮根) [hasune]
    - Higashi-Jujo (東十条) [higashi-jujo]

"kanamecho" (appears 7 times)
  Original forms:
    - Kanamecho (Tokyo Metro Yurakucho)
    - Kanamecho (Tokyo Metro Yurakucho Line)
  Possible matches in transit graph:
    - Kanamecho (要町) [kanamecho]
    - Note: This should match - investigate line name format

"nishidai" (appears 10 times)
  Original forms:
    - Nishidai (Toei Mita)
    - Nishidai (Toei Mita Line)
  Possible matches in transit graph:
    - Nishi-Takashimadaira (西高島平) [nishi-takashimadaira]
    - Takashimadaira (高島平) [takashimadaira]

All Available Stations in Transit Graph:

  Akabanebashi (赤羽橋)
  Akasaka (赤坂)
  Akasaka-mitsuke (赤坂見附)
  Akebonobashi (曙橋)
  Akihabara (秋葉原)
  ... and 1140 more stations
```

## Common Reasons for Unmatched Stations:

1. **Different station name formats**: "Hasunuma" vs "Renuma" (蓮沼)
2. **Line name variations**: "JR Keihin-Tohoku" vs "JR Keihin-Tohoku Line"
3. **Missing stations**: Some newer or smaller stations might not be in the transit graph
4. **Spelling variations**: Romanization differences
5. **Station consolidation**: Multiple stations treated as one in different systems

## How to Debug:

1. Check the `unmatchedDetails` in the JSON to see which apartments have unmatched stations
2. Review the unmatched stations report to find possible matches
3. Update the station name normalization logic if patterns emerge
4. Consider adding manual mappings for frequently unmatched stations