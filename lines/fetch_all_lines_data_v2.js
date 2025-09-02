const fs = require('fs').promises;
const { JSDOM } = require('jsdom');

// Load line IDs from station_data.json
async function loadLineIds() {
  const data = await fs.readFile('station_data.json', 'utf-8');
  const stationData = JSON.parse(data);
  
  // Extract unique lines with their info
  const lines = stationData.map(lineData => ({
    line: lineData.line,
    operator: lineData.operator,
    navitime_id: lineData.navitime_id,
    navitime_name: lineData.line
  }));
  
  return lines;
}

// Load progress
async function loadProgress() {
  try {
    const data = await fs.readFile('collection_progress.json', 'utf-8');
    return JSON.parse(data);
  } catch {
    return {
      current_index: 0,
      processed_lines: [],
      failed_lines: [],
      total_lines: 0
    };
  }
}

// Save progress
async function saveProgress(progress) {
  await fs.writeFile('collection_progress.json', JSON.stringify(progress, null, 2));
}

// Fetch with retry
async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      console.log(`    Retry ${i + 1}/${retries} for ${url}: ${error.message}`);
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
    }
  }
}

// Load station data for a line from station_data.json
async function loadStationDataForLine(lineId) {
  try {
    // Load from station_data.json - this is the source of truth
    const allStations = await fs.readFile('station_data.json', 'utf-8')
      .then(JSON.parse)
      .catch(() => {
        console.log('  Error: Could not load station_data.json');
        return [];
      });
    
    // Find the line by navitime_id
    for (const lineData of allStations) {
      if (lineData.navitime_id === lineId) {
        return lineData;
      }
    }
    
    console.log(`  Warning: Line ${lineId} not found in station_data.json`);
  } catch (error) {
    console.log(`  Error loading station data: ${error.message}`);
  }
  
  return null;
}

// Process a single line
async function processLine(line, index, total) {
  console.log(`\n[${index + 1}/${total}] Processing ${line.line} (${line.navitime_id})`);
  console.log(`  Operator: ${line.operator}`);
  
  try {
    // Step 1: Load station data for this line
    const stationData = await loadStationDataForLine(line.navitime_id);
    
    if (!stationData || !stationData.stations || stationData.stations.length === 0) {
      console.log(`  Skipping - no station data available in station_data.json`);
      return null;
    }
    
    // Create a set of valid station IDs for this line
    const validStationIds = new Set(stationData.stations.map(s => s.station_id || s.id));
    console.log(`  Line has ${validStationIds.size} stations`);
    
    const firstStationId = stationData.stations[0].station_id || stationData.stations[0].id;
    console.log(`  First station: ${stationData.stations[0].name} (${firstStationId})`);
    
    // Step 2: Fetch timetable
    const timetableUrl = `https://japantravel.navitime.com/en/area/jp/timetable/${firstStationId}/${line.navitime_id}/`;
    console.log(`  Fetching timetable...`);
    
    const timetableHtml = await fetchWithRetry(timetableUrl);
    
    // Step 3: Extract train types and select examples
    const { availableTypes, exampleTrains } = extractTrainTypesFromHtml(timetableHtml);
    console.log(`  Found ${availableTypes.length} train types: ${availableTypes.join(', ')}`);
    
    // Step 4: Fetch stop details for each train type
    const trainStopDetails = {};
    
    for (const [trainType, trainExample] of Object.entries(exampleTrains)) {
      if (trainExample && trainExample.trainId) {
        console.log(`  Fetching stops for ${trainType}...`);
        
        try {
          const stopUrl = `https://japantravel.navitime.com/en/area/jp/async/diagram/transport/stop/?node=${firstStationId}&operation=${trainExample.trainId}&time=${trainExample.date || '2025-07-11'}`;
          const stopData = await fetchWithRetry(stopUrl);
          const parsedStops = JSON.parse(stopData);
          
          // Process stops but filter to only include stations on this line
          const processedData = processStopData(parsedStops, line.line, trainType, validStationIds);
          
          if (processedData && processedData.stops.length > 0) {
            trainStopDetails[trainType] = processedData;
            console.log(`    Found ${processedData.stops.length} stops on this line (filtered from ${parsedStops.stopStations?.length || 0} total stops)`);
          } else {
            console.log(`    No valid stops found for this train type`);
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay between stop requests
        } catch (error) {
          console.error(`    Error fetching stops for ${trainType}: ${error.message}`);
        }
      }
    }
    
    // Step 5: Save line data
    const lineResult = {
      line: line.line,
      operator: line.operator,
      navitime_id: line.navitime_id,
      first_station_id: firstStationId,
      stations: stationData.stations,
      train_types: availableTypes,
      example_trains: exampleTrains,
      train_stop_details: trainStopDetails,
      processed_date: new Date().toISOString()
    };
    
    // Save individual line file
    const filename = `line_data/${line.navitime_id}_${line.line.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    await fs.mkdir('line_data', { recursive: true });
    await fs.writeFile(filename, JSON.stringify(lineResult, null, 2));
    
    console.log(`  ✓ Saved to ${filename}`);
    return lineResult;
    
  } catch (error) {
    console.error(`  ✗ Error: ${error.message}`);
    return null;
  }
}

// Extract train types from timetable HTML
function extractTrainTypesFromHtml(html) {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  
  // Extract available types from filter
  const trainTypeLinks = document.querySelectorAll('.train-type-choice-area .train-type-link');
  const availableTypes = [];
  
  trainTypeLinks.forEach(link => {
    const type = link.textContent.trim();
    if (type !== 'All') {
      availableTypes.push(type);
    }
  });
  
  // Extract train examples
  const trainElements = document.querySelectorAll('[data-train-id]');
  const exampleTrains = {};
  
  // Group by type and select one example for each
  const trainsByType = {};
  trainElements.forEach(element => {
    const trainData = {
      trainId: element.getAttribute('data-train-id'),
      trainName: element.getAttribute('data-train-name'),
      destination: element.getAttribute('data-destination'),
      hour: parseInt(element.getAttribute('data-hour')),
      date: element.getAttribute('data-date'),
      time: element.querySelector('dt.time')?.textContent || '',
      type: element.querySelector('dd.type')?.textContent || ''
    };
    
    const type = trainData.type || 'Unknown';
    if (!trainsByType[type]) trainsByType[type] = [];
    trainsByType[type].push(trainData);
  });
  
  // Select example closest to noon for each type
  Object.entries(trainsByType).forEach(([type, trains]) => {
    const middayTrain = trains.find(t => t.hour >= 10 && t.hour <= 14) || trains[0];
    if (middayTrain) {
      exampleTrains[type] = middayTrain;
    }
  });
  
  return { availableTypes, exampleTrains };
}

// Process stop data with filtering for valid stations only
function processStopData(stopData, lineName, trainType, validStationIds) {
  if (!stopData || !stopData.stopStations) return null;
  
  const stops = [];
  const interStationTimes = [];
  let lastValidStop = null;
  
  for (let i = 0; i < stopData.stopStations.length; i++) {
    const item = stopData.stopStations[i];
    
    if (item.type === 'point') {
      // Only include stops that are on this line
      if (validStationIds.has(item.node_id)) {
        const stop = {
          name: item.name,
          station_id: item.node_id,
          arrival: item.from_time,
          departure: item.to_time,
          coord: item.coord
        };
        stops.push(stop);
        
        // If we have a previous valid stop, calculate the travel time
        if (lastValidStop) {
          // Look for move segments between the last valid stop and this one
          let totalTime = 0;
          for (let j = lastValidStop.index + 1; j < i; j++) {
            if (stopData.stopStations[j].type === 'move') {
              totalTime += stopData.stopStations[j].time || 0;
            }
          }
          
          if (totalTime > 0) {
            interStationTimes.push({
              from: lastValidStop.stop.name,
              from_id: lastValidStop.stop.station_id,
              to: stop.name,
              to_id: stop.station_id,
              travel_time_minutes: totalTime
            });
          }
        }
        
        lastValidStop = { stop, index: i };
      }
    }
  }
  
  return {
    line: lineName,
    train_type: trainType,
    total_stops: stops.length,
    stops: stops,
    inter_station_times: interStationTimes
  };
}

// Main function
async function main() {
  try {
    console.log('Starting Tokyo Transit Data Collection (v2 - with line filtering)');
    console.log('=========================================================\n');
    
    // Load lines and progress
    const lines = await loadLineIds();
    const progress = await loadProgress();
    
    if (progress.current_index === 0) {
      progress.total_lines = lines.length;
    }
    
    console.log(`Total lines to process: ${lines.length}`);
    console.log(`Already processed: ${progress.processed_lines.length}`);
    console.log(`Failed: ${progress.failed_lines.length}`);
    console.log(`Remaining: ${lines.length - progress.current_index}\n`);
    
    // Estimate time
    const estimatedMinutes = (lines.length - progress.current_index) * 0.5; // ~30 seconds per line
    console.log(`Estimated time: ${Math.ceil(estimatedMinutes)} minutes\n`);
    
    // Process remaining lines
    const allResults = [];
    
    for (let i = progress.current_index; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if already processed
      if (progress.processed_lines.includes(line.navitime_id)) {
        console.log(`\n[${i + 1}/${lines.length}] Skipping ${line.line} - already processed`);
        continue;
      }
      
      const result = await processLine(line, i, lines.length);
      
      if (result) {
        allResults.push(result);
        progress.processed_lines.push(line.navitime_id);
      } else {
        progress.failed_lines.push(line.navitime_id);
      }
      
      // Update progress
      progress.current_index = i + 1;
      await saveProgress(progress);
      
      // Delay between lines
      if (i < lines.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    console.log('\n\nCollection Complete!');
    console.log('===================');
    console.log(`Successfully processed: ${progress.processed_lines.length}`);
    console.log(`Failed: ${progress.failed_lines.length}`);
    
    if (progress.failed_lines.length > 0) {
      console.log('\nFailed lines:');
      progress.failed_lines.forEach(id => {
        const line = lines.find(l => l.navitime_id === id);
        if (line) console.log(`  - ${line.line} (${id})`);
      });
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { processLine, loadLineIds };