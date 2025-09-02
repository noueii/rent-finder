const fs = require('fs').promises;
const readline = require('readline');

const TRANSFER_PENALTY = 5;

// Load graph
let graph = null;

async function loadGraph() {
  try {
    // Load the complete graph
    graph = JSON.parse(await fs.readFile('tokyo_transit_graph_complete.json', 'utf-8'));
    console.log(`Complete Tokyo Transit Graph loaded: ${Object.keys(graph.stations).length} stations, ${graph.metadata.total_edges} edges`);
  } catch (e) {
    console.error('Complete graph not found. Please run build_final_graph.js first.');
    console.error('Error:', e.message);
    process.exit(1);
  }
}

// Search for station by name
function findStation(query) {
  const results = [];
  const lowerQuery = query.toLowerCase();
  
  Object.entries(graph.stations).forEach(([id, station]) => {
    if (station.name.toLowerCase().includes(lowerQuery) ||
        (station.name_ja && station.name_ja.includes(query))) {
      results.push({ id, ...station });
    }
  });
  
  return results;
}

// Find reachable stations with FIXED path tracking
function findReachable(startId, maxMinutes) {
  const bestPaths = {}; // Store best path to each station
  const visited = new Set();
  const queue = [];
  
  // Initialize with start station
  queue.push({ 
    station: startId, 
    distance: 0, 
    currentLine: null,
    currentTrainType: null,
    path: []
  });
  
  while (queue.length > 0) {
    // Sort by distance (priority queue)
    queue.sort((a, b) => a.distance - b.distance);
    const current = queue.shift();
    
    // Create unique state key
    const stateKey = `${current.station}-${current.currentLine || 'start'}-${current.currentTrainType || 'start'}`;
    if (visited.has(stateKey)) continue;
    visited.add(stateKey);
    
    // Get edges from current station
    const edges = graph.edges[current.station] || {};
    
    Object.entries(edges).forEach(([toStation, connections]) => {
      connections.forEach(conn => {
        // Calculate travel time with transfer penalty
        let travelTime = conn.travel_time;
        const changingTrain = current.currentLine && (
          current.currentLine !== conn.line_id || 
          current.currentTrainType !== conn.train_type
        );
        
        if (changingTrain) {
          travelTime += TRANSFER_PENALTY;
        }
        
        const newDistance = current.distance + travelTime;
        
        // Only process if within time limit
        if (newDistance <= maxMinutes) {
          // Check if this is a better path to the destination
          const currentBest = bestPaths[toStation];
          if (!currentBest || newDistance < currentBest.distance) {
            // Create new path segment
            const newPath = [...current.path, {
              from: current.station,
              to: toStation,
              line: conn.line_name,
              line_id: conn.line_id,
              train_type: conn.train_type,
              time: conn.travel_time,
              transfer: changingTrain
            }];
            
            // Update best path
            bestPaths[toStation] = {
              distance: newDistance,
              path: newPath,
              transfers: newPath.filter(seg => seg.transfer).length
            };
            
            // Add to queue for further exploration
            queue.push({
              station: toStation,
              distance: newDistance,
              currentLine: conn.line_id,
              currentTrainType: conn.train_type,
              path: newPath
            });
          }
        }
      });
    });
  }
  
  // Build results from best paths
  const results = [];
  Object.entries(bestPaths).forEach(([stationId, pathInfo]) => {
    const station = graph.stations[stationId];
    if (station && pathInfo.distance > 0) {
      results.push({
        station_id: stationId,
        name: station.name,
        name_ja: station.name_ja,
        travel_time: pathInfo.distance,
        coordinates: station.coordinates,
        transfers: pathInfo.transfers,
        path: pathInfo.path
      });
    }
  });
  
  return results.sort((a, b) => {
    if (a.travel_time === b.travel_time) {
      return a.transfers - b.transfers;
    }
    return a.travel_time - b.travel_time;
  });
}

// Interactive CLI
async function interactive() {
  await loadGraph();
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log('\nTokyo Transit Reachability Query Tool');
  console.log('=====================================');
  console.log('Commands:');
  console.log('  search <name>     - Search for a station');
  console.log('  from <station_id> - Set starting station');
  console.log('  time <minutes>    - Find reachable stations');
  console.log('  exit              - Quit\n');
  
  let currentStation = null;
  
  const prompt = () => {
    rl.question('> ', async (input) => {
      const [command, ...args] = input.trim().split(' ');
      
      switch (command) {
        case 'search':
          const query = args.join(' ');
          const results = findStation(query);
          if (results.length === 0) {
            console.log('No stations found');
          } else {
            console.log(`Found ${results.length} station(s):`);
            results.slice(0, 10).forEach(s => {
              console.log(`  ${s.id}: ${s.name} (${s.name_ja}) - ${s.lines.length} line(s)`);
            });
          }
          break;
          
        case 'from':
          const stationId = args[0];
          if (graph.stations[stationId]) {
            currentStation = stationId;
            const station = graph.stations[stationId];
            console.log(`Starting station set to: ${station.name} (${station.name_ja})`);
          } else {
            console.log('Station not found');
          }
          break;
          
        case 'time':
          if (!currentStation) {
            console.log('Please set a starting station first (use "from" command)');
          } else {
            const minutes = parseInt(args[0]);
            if (isNaN(minutes)) {
              console.log('Please provide a valid number of minutes');
            } else {
              console.log(`Finding stations reachable in ${minutes} minutes...`);
              const reachable = findReachable(currentStation, minutes);
              
              console.log(`\nFound ${reachable.length} stations:`);
              
              // Group by travel time ranges
              const ranges = {
                '0-10 min': reachable.filter(s => s.travel_time <= 10),
                '11-20 min': reachable.filter(s => s.travel_time > 10 && s.travel_time <= 20),
                '21-30 min': reachable.filter(s => s.travel_time > 20 && s.travel_time <= 30),
                '31+ min': reachable.filter(s => s.travel_time > 30)
              };
              
              Object.entries(ranges).forEach(([range, stations]) => {
                if (stations.length > 0) {
                  console.log(`\n${range}: ${stations.length} stations`);
                  stations.slice(0, 5).forEach(s => {
                    const transfers = s.transfers > 0 ? ` (${s.transfers} transfer${s.transfers > 1 ? 's' : ''})` : '';
                    console.log(`  ${s.name} - ${s.travel_time} min${transfers}`);
                  });
                  if (stations.length > 5) {
                    console.log(`  ... and ${stations.length - 5} more`);
                  }
                }
              });
              
              // Save results
              const filename = `reachable_from_${currentStation}_${minutes}min.json`;
              await fs.writeFile(filename, JSON.stringify(reachable, null, 2));
              console.log(`\nResults saved to ${filename}`);
            }
          }
          break;
          
        case 'exit':
        case 'quit':
          console.log('Goodbye!');
          rl.close();
          return;
          
        default:
          console.log('Unknown command. Try: search, from, time, or exit');
      }
      
      prompt();
    });
  };
  
  prompt();
}

// Run if called directly
if (require.main === module) {
  interactive();
}

module.exports = { findStation, findReachable, loadGraph };