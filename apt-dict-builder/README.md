# Apartment Dictionary Builder

This tool combines apartment data from multiple real estate sources into a unified JSON format.

## Usage

```bash
node combine_apartments.js
```

## Supported Sources

1. **realestate.co.jp** - Looks for JSON files in:
   - `../station_id_converter/scraped_apartments/`
   - `../station_id_converter/`

2. **yolo-home.com** - Looks for JSON files in:
   - `../yolo-home/scraped_apartments/`
   - `../yolo-home/`

## Unified Data Structure

The script creates a unified apartment object with the following structure:

```javascript
{
  id: "unique_identifier",
  source: "source_website",
  sourceId: "original_id",
  url: "property_url",
  
  building: {
    name: "Building Name",
    nameJa: "建物名",
    type: "Apartment",
    yearBuilt: 2020,
    totalFloors: 10,
    totalUnits: 50,
    structure: "RC",
    features: []
  },
  
  unit: {
    title: "Unit Title",
    roomNumber: "101",
    floor: 1,
    layout: "1K",
    layoutType: "K",
    bedrooms: 1,
    hasLivingRoom: false,
    hasDiningKitchen: false,
    hasKitchen: true,
    hasServiceRoom: false
  },
  
  size: {
    totalArea: 25.5,
    unit: "m²",
    balconyArea: 0,
    hasBalcony: false
  },
  
  location: {
    address: "Full Address",
    area: "Shibuya",
    ward: "Shibuya-ku",
    wardJa: "渋谷区",
    city: "Tokyo",
    prefecture: "Tokyo",
    postalCode: "",
    coordinates: {
      latitude: null,
      longitude: null
    }
  },
  
  pricing: {
    monthlyRent: 100000,
    deposit: 100000,
    keyMoney: 100000,
    guaranteeFee: 0,
    managementFee: 10000,
    commonServiceFee: 0,
    parkingFee: 0,
    initialCost: 0,
    totalMonthlyCost: 110000
  },
  
  stations: [
    {
      name: "Shibuya",
      line: "JR Yamanote",
      walkingMinutes: 5,
      distance: null
    }
  ],
  
  features: ["Autolock", "Internet"],
  amenities: [],
  
  images: {
    main: [],
    floorPlan: "",
    all: []
  },
  
  availability: {
    status: "available",
    availableFrom: null,
    moveInDate: null,
    lastUpdated: null
  },
  
  agency: {
    name: "Agency Name",
    contact: "",
    phone: "",
    email: ""
  },
  
  metadata: {
    scrapedAt: "2025-01-15T12:00:00.000Z",
    lastModified: "2025-01-15T12:00:00.000Z",
    dataVersion: "1.0"
  }
}
```

## Output

The script generates two files:

1. **unified_apartments_[timestamp].json** - Complete unified apartment data
2. **unified_summary_[timestamp].txt** - Summary statistics and analysis

## Features

- Automatically finds and processes all apartment JSON files
- Converts different formats to a unified structure
- Removes duplicate apartments based on URL
- Generates comprehensive statistics
- Handles missing or incomplete data gracefully
- Preserves all original data while standardizing structure