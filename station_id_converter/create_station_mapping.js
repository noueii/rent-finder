#!/usr/bin/env node

/**
 * Create Station ID Mapping between CLI Tool and Realestate.co.jp
 * 
 * This script:
 * 1. Loads station data from both sources
 * 2. Creates mappings based on station names and coordinates
 * 3. Outputs a comprehensive mapping file
 */

const fs = require('fs');
const path = require('path');

// File paths
const CLI_TRANSIT_GRAPH = path.join(__dirname, '..', 'lines', 'tokyo_transit_graph_complete.json');
const REALESTATE_STATIONS = path.join(__dirname, 'realestate.co.jp', 'stations.json');
const LINE_MAPPING = path.join(__dirname, 'line_name_mapping.json');
const OUTPUT_FILE = path.join(__dirname, 'station_id_mapping.json');

// Load data files
function loadData() {
    try {
        const cliGraph = JSON.parse(fs.readFileSync(CLI_TRANSIT_GRAPH, 'utf8'));
        const realestateData = JSON.parse(fs.readFileSync(REALESTATE_STATIONS, 'utf8'));
        const lineMapping = JSON.parse(fs.readFileSync(LINE_MAPPING, 'utf8'));
        
        return {
            cliStations: cliGraph.stations,
            realestateStations: realestateData.stations,
            realestateLines: realestateData.trainLines,
            lineMapping: lineMapping.mappings.direct_mappings
        };
    } catch (error) {
        console.error('Error loading data files:', error);
        process.exit(1);
    }
}

// Normalize station names for comparison
function normalizeStationName(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric
        .replace(/station$/i, '')
        .replace(/tokyo$/i, '')
        .replace(/^jr/i, '')
        .trim();
}

// Calculate distance between two coordinates (in meters)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}

// Find best match for a CLI station
function findBestMatch(cliStation, realestateStations, maxDistance = 500) {
    const candidates = [];
    const normalizedCliName = normalizeStationName(cliStation.name);
    
    // First pass: exact name match
    Object.values(realestateStations).forEach(reStation => {
        const normalizedReName = normalizeStationName(reStation.name);
        
        if (normalizedCliName === normalizedReName) {
            const distance = cliStation.coordinates ? 
                calculateDistance(
                    cliStation.coordinates[1], cliStation.coordinates[0],
                    reStation.mapLat, reStation.mapLng
                ) : null;
            
            candidates.push({
                station: reStation,
                score: 100,
                distance: distance,
                nameMatch: 'exact'
            });
        }
    });
    
    // Second pass: fuzzy name match with distance check
    if (candidates.length === 0 && cliStation.coordinates) {
        Object.values(realestateStations).forEach(reStation => {
            const distance = calculateDistance(
                cliStation.coordinates[1], cliStation.coordinates[0],
                reStation.mapLat, reStation.mapLng
            );
            
            if (distance <= maxDistance) {
                const normalizedReName = normalizeStationName(reStation.name);
                const nameScore = calculateNameSimilarity(normalizedCliName, normalizedReName);
                
                if (nameScore > 0.6) {
                    candidates.push({
                        station: reStation,
                        score: nameScore * 50 + (1 - distance/maxDistance) * 50,
                        distance: distance,
                        nameMatch: 'fuzzy'
                    });
                }
            }
        });
    }
    
    // Sort by score and return best match
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0] || null;
}

// Calculate string similarity (simple implementation)
function calculateNameSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
}

// Levenshtein distance
function levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i-1) === str1.charAt(j-1)) {
                matrix[i][j] = matrix[i-1][j-1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i-1][j-1] + 1,
                    matrix[i][j-1] + 1,
                    matrix[i-1][j] + 1
                );
            }
        }
    }
    
    return matrix[str2.length][str1.length];
}

// Create mappings
function createMappings(data) {
    const mappings = {
        byCliId: {},
        byRealestateId: {},
        byGroupId: {},
        unmappedCli: [],
        unmappedRealestate: [],
        statistics: {
            totalCliStations: 0,
            totalRealestateStations: 0,
            mappedStations: 0,
            exactMatches: 0,
            fuzzyMatches: 0,
            coordinateMatches: 0
        }
    };
    
    const mappedRealestateIds = new Set();
    
    // Process each CLI station
    Object.entries(data.cliStations).forEach(([cliId, cliStation]) => {
        mappings.statistics.totalCliStations++;
        
        const match = findBestMatch(cliStation, data.realestateStations);
        
        if (match) {
            const reStation = match.station;
            
            // Create mapping
            const mapping = {
                cliId: cliId,
                cliName: cliStation.name,
                cliNameJa: cliStation.name_ja,
                realestateId: reStation.id,
                realestateName: reStation.name,
                groupId: reStation.groupId,
                matchType: match.nameMatch,
                matchScore: match.score,
                distance: match.distance ? Math.round(match.distance) : null,
                coordinates: {
                    cli: cliStation.coordinates,
                    realestate: [reStation.mapLng, reStation.mapLat]
                }
            };
            
            mappings.byCliId[cliId] = mapping;
            mappings.byRealestateId[reStation.id] = mapping;
            
            if (!mappings.byGroupId[reStation.groupId]) {
                mappings.byGroupId[reStation.groupId] = [];
            }
            mappings.byGroupId[reStation.groupId].push(mapping);
            
            mappedRealestateIds.add(reStation.id);
            mappings.statistics.mappedStations++;
            
            if (match.nameMatch === 'exact') {
                mappings.statistics.exactMatches++;
            } else {
                mappings.statistics.fuzzyMatches++;
            }
            
            if (match.distance !== null && match.distance < 100) {
                mappings.statistics.coordinateMatches++;
            }
        } else {
            mappings.unmappedCli.push({
                id: cliId,
                name: cliStation.name,
                nameJa: cliStation.name_ja,
                lines: cliStation.lines
            });
        }
    });
    
    // Find unmapped realestate stations
    mappings.statistics.totalRealestateStations = Object.keys(data.realestateStations).length;
    
    Object.values(data.realestateStations).forEach(reStation => {
        if (!mappedRealestateIds.has(reStation.id)) {
            mappings.unmappedRealestate.push({
                id: reStation.id,
                name: reStation.name,
                trainLine: reStation.trainLineName,
                groupId: reStation.groupId
            });
        }
    });
    
    return mappings;
}

// Generate summary report
function generateSummary(mappings) {
    const stats = mappings.statistics;
    
    console.log('\n📊 MAPPING SUMMARY');
    console.log('==================');
    console.log(`Total CLI Stations: ${stats.totalCliStations}`);
    console.log(`Total Realestate Stations: ${stats.totalRealestateStations}`);
    console.log(`Successfully Mapped: ${stats.mappedStations} (${(stats.mappedStations/stats.totalCliStations*100).toFixed(1)}%)`);
    console.log(`  - Exact Name Matches: ${stats.exactMatches}`);
    console.log(`  - Fuzzy Name Matches: ${stats.fuzzyMatches}`);
    console.log(`  - Within 100m: ${stats.coordinateMatches}`);
    console.log(`Unmapped CLI Stations: ${mappings.unmappedCli.length}`);
    console.log(`Unmapped Realestate Stations: ${mappings.unmappedRealestate.length}`);
    
    if (mappings.unmappedCli.length > 0) {
        console.log('\n⚠️  Top Unmapped CLI Stations:');
        mappings.unmappedCli.slice(0, 10).forEach(station => {
            console.log(`  - ${station.name} (${station.nameJa}) [${station.id}]`);
        });
    }
    
    console.log('\n🔗 Sample Mappings:');
    Object.values(mappings.byCliId).slice(0, 5).forEach(mapping => {
        console.log(`  - ${mapping.cliName} → ${mapping.realestateName} (${mapping.matchType}, ${mapping.distance}m)`);
    });
}

// Main execution
async function main() {
    console.log('🚀 Creating Station ID Mapping');
    console.log('==============================');
    
    // Load data
    console.log('📂 Loading data files...');
    const data = loadData();
    console.log(`  ✓ CLI Stations: ${Object.keys(data.cliStations).length}`);
    console.log(`  ✓ Realestate Stations: ${Object.keys(data.realestateStations).length}`);
    
    // Create mappings
    console.log('\n🔍 Creating station mappings...');
    const mappings = createMappings(data);
    
    // Save results
    console.log('\n💾 Saving mapping file...');
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(mappings, null, 2), 'utf8');
    console.log(`  ✓ Saved to: ${OUTPUT_FILE}`);
    
    // Display summary
    generateSummary(mappings);
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('💥 Fatal error:', error);
        process.exit(1);
    });
}