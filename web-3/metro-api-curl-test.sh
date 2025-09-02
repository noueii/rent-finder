#!/bin/bash

# Metro Residences API Test Script
# This script tests the Metro Residences API using curl

echo "Testing Metro Residences API..."
echo "================================"

# Make the API request
curl -X POST https://www.metroresidences.com/api/mbp/building \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
  -H "Origin: https://www.metroresidences.com" \
  -H "Referer: https://www.metroresidences.com/jp-en/apartment-rental/" \
  -H "Sec-Fetch-Dest: empty" \
  -H "Sec-Fetch-Mode: cors" \
  -H "Sec-Fetch-Site: same-origin" \
  -d '{
    "price": "0,150000",
    "size": "25,165",
    "view": "grid-view",
    "countryCode": "jp",
    "languageCode": "en",
    "distance": "2.5km",
    "curPage": 1,
    "perPage": 24
  }' \
  | jq '.'

echo ""
echo "================================"
echo "Test completed!"