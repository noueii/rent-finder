# Metro Residences API Test Summary

## Test Date: 2025-01-18

### Test Results

#### 1. CURL Test ✅ SUCCESS
- **Status**: 200 OK
- **Response**: Valid JSON with apartment data
- **Server**: Cloudflare
- **Content-Type**: application/json

#### 2. Node.js Fetch Test ✅ SUCCESS
- **Status**: 200 OK
- **Response**: Valid JSON with apartment data

### API Details

**Endpoint**: `POST https://www.metroresidences.com/api/mbp/building`

**Request Headers**:
```json
{
  "Content-Type": "application/json",
  "Accept": "application/json",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Origin": "https://www.metroresidences.com",
  "Referer": "https://www.metroresidences.com/jp-en/apartment-rental/",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin"
}
```

**Request Body**:
```json
{
  "price": "0,150000",
  "size": "25,165",
  "view": "grid-view",
  "countryCode": "jp",
  "languageCode": "en",
  "distance": "2.5km",
  "curPage": 1,
  "perPage": 24
}
```

### Response Structure

The API returns data in this structure:
```json
{
  "filter": {
    "perPage": 24,
    "curPage": 1,
    "countryCode": "jp",
    "languageCode": "en",
    // ... other filter params
  },
  "units": [
    {
      "_property_id": 9130,
      "property_id": 9130,
      "property_unit_id": 49597,
      "property_name": {
        "ms": { "en": "Name", "ja": "名前" },
        "fts": { "en": "Name", "ja": "名前" }
      },
      "price": 148000,
      "location": {
        "city": { "en": "Tokyo", "ja": "東京" },
        "district": { "en": "District", "ja": "区" },
        "street": { "en": "Street", "ja": "通り" },
        "postcode": "123-4567"
      },
      "coord": { "lat": 35.662265, "lon": 139.8038584 },
      "stations": [
        {
          "id": 218,
          "name": { "en": "Station", "ja": "駅" },
          "lines": [{ "name": { "en": "Line", "ja": "線" } }],
          "walkingTime": { "unit": "min", "value": 11 }
        }
      ],
      "layout": {
        "size": { "val": 28.82, "unit": "sqm" },
        "bathrooms": "1",
        "bedroomLabel": "1dk"
      },
      "photos": [ /* array of photos */ ],
      "property_photos": [ /* array of property photos */ ],
      "layout_photos": [ /* array of layout photos */ ],
      "floor": "7",
      "unit_nbr": "705",
      "stories": 12,
      "availability": "2025-07-14",
      "permalinks": {
        "en": "/jp-en/apartment-rental/...",
        "ja": "/jp/apartment-rental/..."
      }
    }
  ]
}
```

### Key Findings

1. **No CORS Issues**: The API works fine from Node.js. Any CORS errors were likely due to missing headers.

2. **Data Structure**: The API returns apartments in a `units` array, not `buildings` or `items`.

3. **Required Headers**: The API expects specific headers including Origin and Referer.

4. **Pagination**: The API supports pagination via `curPage` and `perPage` parameters.

5. **Multilingual Support**: Property names and locations support both English and Japanese.

### Next Steps

The Metro Residences scraper needs to be updated to:
1. Look for data in the `units` array instead of `buildings`
2. Update the data conversion logic to match the actual API response structure
3. Ensure all required headers are included in requests