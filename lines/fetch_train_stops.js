const https = require('https');
const fs = require('fs').promises;

// Load the test results from previous script
async function loadTestResults() {
  const data = await fs.readFile('complete_train_types_test.json', 'utf-8');
  return JSON.parse(data);
}

// Fetch train stop details from NAVITIME API
async function fetchTrainStops(stationId, trainId, date = '2025-07-11') {
  return new Promise((resolve, reject) => {
    const url = `https://japantravel.navitime.com/en/area/jp/async/diagram/transport/stop/?node=${stationId}&operation=${trainId}&time=${date}`;
    console.log(`Fetching stops from: ${url}`);
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (e) {
          // If not JSON, return raw data
          resolve({ raw: data });
        }
      });
    }).on('error', reject);
  });
}

// Calculate travel time between stations
function calculateTravelTime(departureTime, arrivalTime) {
  // Convert time strings (HH:MM) to minutes
  const [depHour, depMin] = departureTime.split(':').map(Number);
  const [arrHour, arrMin] = arrivalTime.split(':').map(Number);
  
  let depMinutes = depHour * 60 + depMin;
  let arrMinutes = arrHour * 60 + arrMin;
  
  // Handle day transition (e.g., 23:55 to 00:05)
  if (arrMinutes < depMinutes) {
    arrMinutes += 24 * 60;
  }
  
  return arrMinutes - depMinutes;
}

// Process stop data to extract inter-station travel times
function processStopData(stopData, lineName, trainType) {
  if (!stopData || !stopData.stopStations || !Array.isArray(stopData.stopStations)) {
    console.log('No stop data found');
    return null;
  }
  
  const stopStations = stopData.stopStations;
  const stops = [];
  const interStationTimes = [];
  
  // Extract station stops (type: "point") and travel times (type: "move")
  for (let i = 0; i < stopStations.length; i++) {
    const item = stopStations[i];
    
    if (item.type === 'point') {
      // This is a station stop
      stops.push({
        name: item.name,
        station_id: item.node_id,
        arrival: item.from_time,
        departure: item.to_time,
        coord: item.coord
      });
    } else if (item.type === 'move' && i > 0) {
      // This is travel between stations
      const prevStop = stops[stops.length - 1];
      const travelMinutes = item.time || 0;
      
      if (prevStop && i + 1 < stopStations.length && stopStations[i + 1].type === 'point') {
        const nextStop = stopStations[i + 1];
        
        interStationTimes.push({
          from: prevStop.name,
          from_id: prevStop.station_id,
          to: nextStop.name,
          to_id: nextStop.node_id,
          travel_time_minutes: travelMinutes,
          departure: item.from_time,
          arrival: item.to_time,
          train_info: {
            id: item.trainId,
            name: item.trainLongName,
            color: item.transport?.color,
            congestion: item.congestion
          }
        });
      }
    }
  }
  
  // Calculate total travel time
  let totalTravelTime = 0;
  if (stops.length > 1) {
    const firstTime = stops[0].departure || stops[0].arrival;
    const lastTime = stops[stops.length - 1].arrival || stops[stops.length - 1].departure;
    
    if (firstTime && lastTime) {
      const [startHour, startMin] = firstTime.split('T')[1].split(':').slice(0, 2).map(Number);
      const [endHour, endMin] = lastTime.split('T')[1].split(':').slice(0, 2).map(Number);
      
      totalTravelTime = (endHour * 60 + endMin) - (startHour * 60 + startMin);
      if (totalTravelTime < 0) totalTravelTime += 24 * 60;
    }
  }
  
  return {
    line: lineName,
    train_type: trainType,
    total_stops: stops.length,
    total_travel_time: totalTravelTime,
    stops: stops,
    inter_station_times: interStationTimes
  };
}

// Test fetching stop data for selected trains
async function testFetchStops() {
  try {
    const testResults = await loadTestResults();
    const enhancedResults = [];
    
    for (const lineResult of testResults) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Processing ${lineResult.line}`);
      console.log(`${'='.repeat(60)}`);
      
      const enhancedLine = {
        ...lineResult,
        train_stop_details: {}
      };
      
      // For each train type example
      for (const [trainType, trainExample] of Object.entries(lineResult.example_trains)) {
        if (trainExample && trainExample.trainId) {
          console.log(`\nFetching stops for ${trainType} (Train ID: ${trainExample.trainId})`);
          
          try {
            const stopData = await fetchTrainStops(
              lineResult.first_station_id,
              trainExample.trainId,
              trainExample.date || '2025-07-11'
            );
            
            // Save raw response for debugging
            await fs.writeFile(
              `stops_${lineResult.line.replace(/[^a-zA-Z0-9]/g, '_')}_${trainType.replace(/[^a-zA-Z0-9]/g, '_')}.json`,
              JSON.stringify(stopData, null, 2)
            );
            
            // Process the stop data
            const processedData = processStopData(stopData, lineResult.line, trainType);
            
            if (processedData) {
              enhancedLine.train_stop_details[trainType] = processedData;
              
              console.log(`  Total stops: ${processedData.total_stops}`);
              console.log(`  Total travel time: ${processedData.total_travel_time} minutes`);
              console.log(`  Sample inter-station times:`);
              
              // Show first 3 inter-station times
              processedData.inter_station_times.slice(0, 3).forEach(segment => {
                console.log(`    ${segment.from} → ${segment.to}: ${segment.travel_time_minutes} min`);
              });
            }
            
            // Add delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
            
          } catch (error) {
            console.error(`  Error fetching stops for ${trainType}:`, error.message);
          }
        }
      }
      
      enhancedResults.push(enhancedLine);
    }
    
    // Save enhanced results
    await fs.writeFile(
      'enhanced_train_data_with_stops.json',
      JSON.stringify(enhancedResults, null, 2)
    );
    
    console.log('\n\nEnhanced data saved to enhanced_train_data_with_stops.json');
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY OF INTER-STATION TIMES');
    console.log('='.repeat(60));
    
    enhancedResults.forEach(result => {
      console.log(`\n${result.line}:`);
      
      Object.entries(result.train_stop_details || {}).forEach(([trainType, details]) => {
        console.log(`  ${trainType}:`);
        console.log(`    Stops: ${details.total_stops}`);
        console.log(`    Total time: ${details.total_travel_time} minutes`);
        
        if (details.inter_station_times.length > 0) {
          const avgTime = details.inter_station_times.reduce((sum, segment) => 
            sum + segment.travel_time_minutes, 0) / details.inter_station_times.length;
          console.log(`    Average inter-station time: ${avgTime.toFixed(1)} minutes`);
        }
      });
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the test
testFetchStops();