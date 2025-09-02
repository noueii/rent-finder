const fs = require('fs').promises;

const TRANSFER_PENALTY_MINUTES = 5;

async function buildFinalGraph() {
  try {
    console.log('Building Complete Tokyo Transit Graph');
    console.log('====================================\n');
    
    // Load all line data files
    const lineFiles = await fs.readdir('line_data');
    console.log(`Found ${lineFiles.length} line data files\n`);
    
    const graph = {
      metadata: {
        created: new Date().toISOString(),
        transfer_penalty: TRANSFER_PENALTY_MINUTES,
        total_lines: 0,
        total_stations: 0,
        total_edges: 0
      },
      stations: {},
      edges: {}
    };
    
    const allStations = new Map(); // station_id -> station info
    const allConnections = []; // List of all connections
    
    // Process each line file
    for (const file of lineFiles) {
      if (!file.endsWith('.json')) continue;
      
      try {
        const lineData = JSON.parse(await fs.readFile(`line_data/${file}`, 'utf-8'));
        console.log(`Processing ${lineData.line}...`);
        
        graph.metadata.total_lines++;
        
        // Add stations
        if (lineData.stations) {
          lineData.stations.forEach(station => {
            const id = station.station_id;
            if (!allStations.has(id)) {
              allStations.set(id, {
                name: station.name,
                name_ja: station.japanese_name || station.name_ja,
                lines: [],
                transfers: station.transfers || []
              });
            }
            
            const stationInfo = allStations.get(id);
            if (!stationInfo.lines.includes(lineData.navitime_id)) {
              stationInfo.lines.push(lineData.navitime_id);
            }
          });
        }
        
        // Add connections from train stop details
        Object.entries(lineData.train_stop_details || {}).forEach(([trainType, details]) => {
          if (details && details.inter_station_times) {
            details.inter_station_times.forEach(segment => {
              allConnections.push({
                from: segment.from_id,
                to: segment.to_id,
                line_id: lineData.navitime_id,
                line_name: lineData.line,
                train_type: trainType,
                travel_time: segment.travel_time_minutes
              });
            });
          }
          
          // Also add coordinates from stops
          if (details && details.stops) {
            details.stops.forEach(stop => {
              if (stop.coord && allStations.has(stop.station_id)) {
                allStations.get(stop.station_id).coordinates = [stop.coord.lon, stop.coord.lat];
              }
            });
          }
        });
        
      } catch (error) {
        console.error(`  Error processing ${file}: ${error.message}`);
      }
    }
    
    // Build final station list
    allStations.forEach((info, id) => {
      graph.stations[id] = info;
    });
    graph.metadata.total_stations = allStations.size;
    
    // Build edges
    allConnections.forEach(conn => {
      if (!graph.edges[conn.from]) graph.edges[conn.from] = {};
      if (!graph.edges[conn.from][conn.to]) graph.edges[conn.from][conn.to] = [];
      
      graph.edges[conn.from][conn.to].push({
        line_id: conn.line_id,
        line_name: conn.line_name,
        train_type: conn.train_type,
        travel_time: conn.travel_time
      });
      
      // Add reverse direction
      if (!graph.edges[conn.to]) graph.edges[conn.to] = {};
      if (!graph.edges[conn.to][conn.from]) graph.edges[conn.to][conn.from] = [];
      
      graph.edges[conn.to][conn.from].push({
        line_id: conn.line_id,
        line_name: conn.line_name,
        train_type: conn.train_type,
        travel_time: conn.travel_time
      });
      
      graph.metadata.total_edges += 2; // Both directions
    });
    
    // Save the complete graph
    console.log('\nGraph Statistics:');
    console.log(`  Lines: ${graph.metadata.total_lines}`);
    console.log(`  Stations: ${graph.metadata.total_stations}`);
    console.log(`  Edges: ${graph.metadata.total_edges}`);
    
    await fs.writeFile(
      'tokyo_transit_graph_complete.json',
      JSON.stringify(graph, null, 2)
    );
    
    console.log('\nGraph saved to tokyo_transit_graph_complete.json');
    
    // Create a summary file
    const summary = {
      metadata: graph.metadata,
      lines: [],
      major_hubs: []
    };
    
    // Find major hubs (stations with many lines)
    const hubStations = Array.from(allStations.entries())
      .filter(([id, info]) => info.lines.length >= 3)
      .sort((a, b) => b[1].lines.length - a[1].lines.length)
      .slice(0, 20);
    
    summary.major_hubs = hubStations.map(([id, info]) => ({
      station_id: id,
      name: info.name,
      name_ja: info.name_ja,
      line_count: info.lines.length,
      lines: info.lines
    }));
    
    console.log('\nTop 10 Transit Hubs:');
    summary.major_hubs.slice(0, 10).forEach(hub => {
      console.log(`  ${hub.name} (${hub.name_ja}): ${hub.line_count} lines`);
    });
    
    await fs.writeFile('graph_summary.json', JSON.stringify(summary, null, 2));
    
  } catch (error) {
    console.error('Error building graph:', error);
  }
}

// Test reachability function
async function testReachability() {
  const graph = JSON.parse(await fs.readFile('tokyo_transit_graph_complete.json', 'utf-8'));
  
  // Simple reachability test from major stations
  const testStations = [
    { id: '00006668', name: 'Tokyo' },
    { id: '00004254', name: 'Shinjuku' },
    { id: '00003544', name: 'Shibuya' }
  ];
  
  console.log('\n\nReachability Test (30 minutes):');
  console.log('==============================');
  
  for (const station of testStations) {
    const reachable = findReachableStations(graph, station.id, 30);
    console.log(`\nFrom ${station.name}: ${reachable.length} stations reachable`);
  }
}

// Reachability algorithm (reused from before)
function findReachableStations(graph, startStationId, maxMinutes) {
  const distances = {};
  const visited = new Set();
  const queue = [];
  
  Object.keys(graph.stations).forEach(id => {
    distances[id] = Infinity;
  });
  distances[startStationId] = 0;
  
  queue.push({ 
    station: startStationId, 
    distance: 0, 
    currentLine: null,
    currentTrainType: null
  });
  
  while (queue.length > 0) {
    queue.sort((a, b) => a.distance - b.distance);
    const current = queue.shift();
    
    const stateKey = `${current.station}-${current.currentLine || 'start'}-${current.currentTrainType || 'start'}`;
    if (visited.has(stateKey)) continue;
    visited.add(stateKey);
    
    const edges = graph.edges[current.station] || {};
    
    Object.entries(edges).forEach(([toStation, connections]) => {
      connections.forEach(conn => {
        let travelTime = conn.travel_time;
        
        const changingTrain = current.currentLine && (
          current.currentLine !== conn.line_id || 
          current.currentTrainType !== conn.train_type
        );
        
        if (changingTrain) {
          travelTime += graph.metadata.transfer_penalty;
        }
        
        const newDistance = current.distance + travelTime;
        
        if (newDistance <= maxMinutes && newDistance < distances[toStation]) {
          distances[toStation] = newDistance;
          
          queue.push({
            station: toStation,
            distance: newDistance,
            currentLine: conn.line_id,
            currentTrainType: conn.train_type
          });
        }
      });
    });
  }
  
  return Object.entries(distances)
    .filter(([id, dist]) => dist > 0 && dist <= maxMinutes)
    .map(([id, dist]) => ({ station_id: id, travel_time: dist }));
}

// Run if called directly
if (require.main === module) {
  buildFinalGraph().then(() => testReachability());
}

module.exports = { buildFinalGraph, findReachableStations };