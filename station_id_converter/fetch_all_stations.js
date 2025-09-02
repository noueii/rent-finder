#!/usr/bin/env node

/**
 * Fetch All Stations from realestate.co.jp API
 * 
 * This script:
 * 1. Reads train line IDs from train_lines.json
 * 2. Makes GraphQL API requests to fetch stations for each train line
 * 3. Aggregates all station data into stations.json
 * 4. Implements rate limiting and error handling
 */

const fs = require('fs');
const path = require('path');

// Configuration
const RATE_LIMIT_MS = 2000; // 2 seconds between requests
const MAX_RETRIES = 3;
const OUTPUT_FILE = path.join(__dirname, 'realestate.co.jp', 'stations.json');
const TRAIN_LINES_FILE = path.join(__dirname, 'realestate.co.jp', 'train_lines.json');

// Rate limiting
let lastRequestTime = 0;

async function rateLimitedDelay() {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    
    if (timeSinceLastRequest < RATE_LIMIT_MS) {
        const waitTime = RATE_LIMIT_MS - timeSinceLastRequest;
        console.log(`⏳ Rate limiting: waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    lastRequestTime = Date.now();
}

// GraphQL query for fetching stations
const STATIONS_QUERY = `
query Stations($prefectureId: ID, $trainLineId: ID, $cityId: ID, $lang: Lang = EN, $groupByGroupId: Boolean = false) {
  stations(
    prefectureId: $prefectureId
    trainLineId: $trainLineId
    cityId: $cityId
    lang: $lang
    groupByGroupId: $groupByGroupId
  ) {
    stations {
      id
      groupId
      name
      slug
      mapLat
      mapLng
      __typename
    }
    __typename
  }
}`;

// Fetch stations for a specific train line
async function fetchStationsForLine(trainLineId, trainLineName, retryCount = 0) {
    try {
        console.log(`🚇 Fetching stations for: ${trainLineName} (ID: ${trainLineId})`);
        
        await rateLimitedDelay();
        
        const response = await fetch('https://realestate.co.jp/api', {
            method: 'POST',
            headers: {
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:139.0) Gecko/20100101 Firefox/139.0',
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                'Content-Type': 'application/json',
                'Origin': 'https://realestate.co.jp',
                'Connection': 'keep-alive',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
                'Priority': 'u=4'
            },
            body: JSON.stringify({
                operationName: 'Stations',
                variables: {
                    lang: 'EN',
                    groupByGroupId: true,
                    trainLineId: trainLineId,
                    prefectureId: 'JP-13' // Tokyo prefecture
                },
                query: STATIONS_QUERY
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.errors && data.errors.length > 0) {
            throw new Error(`GraphQL Error: ${JSON.stringify(data.errors)}`);
        }

        const stations = data.data?.stations?.stations || [];
        console.log(`✅ Found ${stations.length} stations for ${trainLineName}`);
        
        return {
            trainLineId,
            trainLineName,
            stationCount: stations.length,
            stations: stations.map(station => ({
                id: station.id,
                groupId: station.groupId,
                name: station.name,
                slug: station.slug,
                mapLat: station.mapLat,
                mapLng: station.mapLng,
                trainLineId: trainLineId,
                trainLineName: trainLineName
            }))
        };

    } catch (error) {
        console.error(`❌ Error fetching stations for ${trainLineName}: ${error.message}`);
        
        if (retryCount < MAX_RETRIES) {
            console.log(`🔄 Retrying... (${retryCount + 1}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 1000));
            return fetchStationsForLine(trainLineId, trainLineName, retryCount + 1);
        }
        
        return {
            trainLineId,
            trainLineName,
            stationCount: 0,
            stations: [],
            error: error.message
        };
    }
}

// Load train lines from JSON file
function loadTrainLines() {
    try {
        const content = fs.readFileSync(TRAIN_LINES_FILE, 'utf8');
        const data = JSON.parse(content);
        return data.data.trainLines.trainLines;
    } catch (error) {
        console.error(`❌ Error loading train lines: ${error.message}`);
        process.exit(1);
    }
}

// Save aggregated stations to JSON file
function saveStations(allStationsData) {
    try {
        const outputData = {
            metadata: {
                fetchedAt: new Date().toISOString(),
                totalTrainLines: allStationsData.length,
                totalStations: allStationsData.reduce((sum, line) => sum + line.stationCount, 0),
                successfulLines: allStationsData.filter(line => !line.error).length,
                failedLines: allStationsData.filter(line => line.error).length
            },
            trainLines: allStationsData,
            stations: {}
        };

        // Create a flat stations object for easy lookup
        allStationsData.forEach(lineData => {
            if (lineData.stations) {
                lineData.stations.forEach(station => {
                    outputData.stations[station.id] = station;
                });
            }
        });

        // Ensure directory exists
        const outputDir = path.dirname(OUTPUT_FILE);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(outputData, null, 2), 'utf8');
        console.log(`💾 Saved ${Object.keys(outputData.stations).length} stations to ${OUTPUT_FILE}`);
        
        return outputData;
    } catch (error) {
        console.error(`❌ Error saving stations: ${error.message}`);
        process.exit(1);
    }
}

// Display summary statistics
function displaySummary(data) {
    console.log('\n📊 FETCH SUMMARY');
    console.log('==================');
    console.log(`🚇 Total train lines: ${data.metadata.totalTrainLines}`);
    console.log(`🚉 Total stations: ${data.metadata.totalStations}`);
    console.log(`✅ Successful lines: ${data.metadata.successfulLines}`);
    console.log(`❌ Failed lines: ${data.metadata.failedLines}`);
    
    if (data.metadata.failedLines > 0) {
        console.log('\n❌ Failed train lines:');
        data.trainLines
            .filter(line => line.error)
            .forEach(line => {
                console.log(`   - ${line.trainLineName} (${line.trainLineId}): ${line.error}`);
            });
    }
    
    console.log('\n🔝 Top 5 lines by station count:');
    data.trainLines
        .filter(line => !line.error)
        .sort((a, b) => b.stationCount - a.stationCount)
        .slice(0, 5)
        .forEach((line, index) => {
            console.log(`   ${index + 1}. ${line.trainLineName}: ${line.stationCount} stations`);
        });
}

// Main execution function
async function main() {
    console.log('🚀 Starting station data fetch from realestate.co.jp API');
    console.log('======================================================');
    
    const startTime = Date.now();
    
    // Load train lines
    const trainLines = loadTrainLines();
    console.log(`📋 Loaded ${trainLines.length} train lines`);
    
    // Fetch stations for each train line
    const allStationsData = [];
    
    for (let i = 0; i < trainLines.length; i++) {
        const line = trainLines[i];
        console.log(`\n[${i + 1}/${trainLines.length}] Processing ${line.name}`);
        
        const lineStations = await fetchStationsForLine(line.id, line.name);
        allStationsData.push(lineStations);
        
        // Progress indicator
        const progress = ((i + 1) / trainLines.length * 100).toFixed(1);
        console.log(`📈 Progress: ${progress}%`);
    }
    
    // Save aggregated data
    console.log('\n💾 Saving aggregated station data...');
    const outputData = saveStations(allStationsData);
    
    // Display summary
    displaySummary(outputData);
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n⏱️  Total execution time: ${totalTime} seconds`);
    console.log(`📄 Output saved to: ${OUTPUT_FILE}`);
}

// Handle errors and run
if (require.main === module) {
    main().catch(error => {
        console.error('💥 Fatal error:', error);
        process.exit(1);
    });
}

module.exports = {
    fetchStationsForLine,
    loadTrainLines,
    saveStations
};