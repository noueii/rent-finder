# How to Use the Tokyo Transit Query System

## Data Collection and Processing

### 1. Initial Setup
Ensure you have all required dependencies:
```bash
npm install
```

### 2. Collect Transit Data
If you need to collect fresh data from NAVITIME:

```bash
# Fetch all line data with through-service filtering
node fetch_all_lines_data_v2.js
```

This will:
- Fetch train schedules for all 70 Tokyo lines
- Filter out through-service stations using station_data.json
- Save data to line_data/ directory
- Track progress in collection_progress.json
- Takes approximately 35-40 minutes

### 3. Build the Transit Graph
After data collection is complete:
```bash
node build_final_graph.js
```

This creates `tokyo_transit_graph_complete.json` with:
- 1,190+ stations
- 7,770+ connections
- Travel times for different train types
- Transfer penalty information

## Using the Query System

### 1. Interactive Command Line Tool

Start the interactive tool:
```bash
node query_reachability.js
```

#### Available Commands:

**Search for a station:**
```
> search shinjuku
Found 3 station(s):
  00004254: Shinjuku (新宿) - 9 line(s)
  00004813: Nishi-shinjuku (西新宿) - 1 line(s)
  ...
```

**Set starting station:**
```
> from 00004254
Starting station set to: Shinjuku (新宿)
```

**Find reachable stations:**
```
> time 30
Finding stations reachable in 30 minutes...
Found 414 stations
```

**Exit:**
```
> exit
```

### 2. Programmatic Usage

```javascript
const { findStation, findReachable, loadGraph } = require('./query_reachability');

async function example() {
  // Load the graph first
  await loadGraph();
  
  // Search for stations
  const stations = findStation('shibuya');
  console.log(stations);
  
  // Find reachable stations from Shibuya in 30 minutes
  const reachable = findReachable('00003544', 30);
  
  // Show results
  reachable.forEach(station => {
    console.log(`${station.name}: ${station.travel_time} min (${station.transfers} transfers)`);
  });
}

example().catch(console.error);
```

### 3. Run Example Scripts

```bash
# Basic usage examples
node example_usage.js

# Test specific station reachability
node test_meguro_complete.js
```

## Understanding Results

Each result includes:
- **station_id**: Unique identifier
- **name**: English name  
- **name_ja**: Japanese name
- **travel_time**: Total minutes including transfers
- **transfers**: Number of train changes
- **coordinates**: [longitude, latitude]
- **path**: Detailed route with each segment

### Transfer Rules:
- Any train change = 5 minute penalty
- This includes:
  - Different lines (e.g., Yamanote → Chuo)
  - Different train types on same line (e.g., Local → Rapid)

## Common Use Cases

### Find apartments near multiple offices:
```javascript
// Find stations reachable from both Shinjuku and Shibuya in 20 min
const fromShinjuku = findReachable('00004254', 20);
const fromShibuya = findReachable('00003544', 20);

// Find overlap
const bothReachable = fromShinjuku.filter(s1 => 
  fromShibuya.some(s2 => s2.station_id === s1.station_id)
);
```

### Export results for mapping:
```javascript
const results = findReachable(stationId, 30);

// Save as GeoJSON
const geojson = {
  type: 'FeatureCollection',
  features: results.map(r => ({
    type: 'Feature',
    properties: {
      name: r.name,
      time: r.travel_time,
      transfers: r.transfers
    },
    geometry: {
      type: 'Point',
      coordinates: r.coordinates || [0, 0]
    }
  }))
};

await fs.writeFile('reachable_stations.geojson', JSON.stringify(geojson, null, 2));
```

## Troubleshooting

### Graph not found error
If you get "Cannot read graph file", rebuild it:
```bash
node build_final_graph.js
```

### Incorrect connections (through-service issues)
If you see incorrect connections (e.g., Saikyo Line connecting to bay area):
1. Reprocess the problematic line data:
   ```bash
   node fetch_all_lines_data_v2.js
   ```
2. Rebuild the graph:
   ```bash
   node build_final_graph.js
   ```

### Missing stations
Check that the line exists in station_data.json. The v2 fetching algorithm requires stations to be listed there to avoid through-service contamination.

## Data Files

- **station_data.json**: Master list of all stations by line
- **line_data/*.json**: Individual line files with train schedules
- **tokyo_transit_graph_complete.json**: Final graph used for queries
- **collection_progress.json**: Tracks fetching progress

## Integration with Apartment Search

The transit data can be integrated with apartment listing APIs:

```javascript
// Example: Filter apartments by commute time
const maxCommute = 30; // minutes
const targetStation = '00004254'; // Shinjuku

const reachableStations = findReachable(targetStation, maxCommute);
const stationIds = reachableStations.map(s => s.station_id);

// Filter apartments near reachable stations
const apartments = await getApartments();
const filtered = apartments.filter(apt => 
  stationIds.includes(apt.nearest_station_id)
);
```
