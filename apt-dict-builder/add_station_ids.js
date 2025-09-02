#!/usr/bin/env node

/**
 * Add Station IDs to Unified Apartment Data
 * Matches apartment stations with transit graph station IDs
 */

const fs = require('fs');
const path = require('path');

// Load transit graph
function loadTransitGraph() {
    const graphPath = path.join(__dirname, '../lines/tokyo_transit_graph_complete.json');
    try {
        const data = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
        return data.stations;
    } catch (error) {
        console.error('Error loading transit graph:', error.message);
        return null;
    }
}

// Normalize station name for matching
function normalizeStationName(name) {
    if (!name) return '';
    
    // Remove common suffixes
    let normalized = name
        .replace(/駅$/i, '')
        .replace(/\s*station$/i, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    
    // Handle special cases
    const replacements = {
        'jr ': '',
        'tokyo metro ': '',
        'toei ': '',
        'keio ': '',
        'odakyu ': '',
        'tokyu ': '',
        'seibu ': '',
        'tobu ': '',
        'keisei ': '',
        'keikyu ': '',
        'rinkai ': '',
        'yurikamome ': ''
    };
    
    for (const [prefix, replacement] of Object.entries(replacements)) {
        if (normalized.startsWith(prefix)) {
            normalized = normalized.replace(prefix, replacement);
        }
    }
    
    return normalized;
}

// Create station lookup maps
function createStationLookups(stations) {
    const byName = new Map();
    const byNameJa = new Map();
    const byNormalizedName = new Map();
    
    for (const [stationId, station] of Object.entries(stations)) {
        // By exact name
        byName.set(station.name, stationId);
        byNameJa.set(station.name_ja, stationId);
        
        // By normalized name
        const normalized = normalizeStationName(station.name);
        if (!byNormalizedName.has(normalized)) {
            byNormalizedName.set(normalized, []);
        }
        byNormalizedName.get(normalized).push({
            id: stationId,
            name: station.name,
            name_ja: station.name_ja,
            lines: station.transfers || []
        });
    }
    
    return { byName, byNameJa, byNormalizedName };
}

// Find best matching station
function findStationId(stationName, lineName, lookups) {
    if (!stationName) return null;
    
    // Try exact match first
    if (lookups.byName.has(stationName)) {
        return lookups.byName.get(stationName);
    }
    
    if (lookups.byNameJa.has(stationName)) {
        return lookups.byNameJa.get(stationName);
    }
    
    // Try normalized match
    const normalized = normalizeStationName(stationName);
    const candidates = lookups.byNormalizedName.get(normalized);
    
    if (!candidates || candidates.length === 0) {
        return null;
    }
    
    // If only one candidate, return it
    if (candidates.length === 1) {
        return candidates[0].id;
    }
    
    // If multiple candidates and we have line info, try to match by line
    if (lineName) {
        const normalizedLine = lineName.toLowerCase();
        
        for (const candidate of candidates) {
            const matchingLine = candidate.lines.some(line => 
                line.toLowerCase().includes(normalizedLine) ||
                normalizedLine.includes(line.toLowerCase())
            );
            
            if (matchingLine) {
                return candidate.id;
            }
        }
    }
    
    // Return the first candidate if no line match
    return candidates[0].id;
}

// Add station IDs to apartment data
function addStationIds(apartmentData, stations) {
    const lookups = createStationLookups(stations);
    const stats = {
        totalStations: 0,
        matched: 0,
        unmatched: 0,
        unmatchedStations: new Set(),
        unmatchedDetails: [] // Detailed info for debugging
    };
    
    // Process each apartment
    for (const apartment of apartmentData.apartments) {
        if (!apartment.stations || apartment.stations.length === 0) {
            continue;
        }
        
        // Process each station
        for (const station of apartment.stations) {
            stats.totalStations++;
            
            const stationId = findStationId(station.name, station.line, lookups);
            
            if (stationId) {
                station.stationId = stationId;
                station.matchedWith = stations[stationId].name;
                station.matchedWithJa = stations[stationId].name_ja;
                stats.matched++;
            } else {
                stats.unmatched++;
                station.stationId = null;
                station.matchStatus = 'unmatched';
                
                // Store detailed info for debugging
                const unmatchedInfo = {
                    originalName: station.name,
                    normalizedName: normalizeStationName(station.name),
                    line: station.line || 'No line',
                    apartmentId: apartment.id,
                    apartmentUrl: apartment.url
                };
                
                stats.unmatchedStations.add(`${station.name} (${station.line || 'No line'})`);
                stats.unmatchedDetails.push(unmatchedInfo);
            }
        }
    }
    
    return stats;
}

// Main function
async function processApartmentFile(inputFile) {
    console.log('🚉 Adding Station IDs to Apartment Data');
    console.log('=====================================\n');
    
    // Load transit graph
    console.log('📊 Loading transit graph...');
    const stations = loadTransitGraph();
    
    if (!stations) {
        console.error('❌ Failed to load transit graph');
        return;
    }
    
    console.log(`✅ Loaded ${Object.keys(stations).length} stations\n`);
    
    // Load apartment data
    console.log(`📄 Loading apartment data from: ${path.basename(inputFile)}`);
    
    let apartmentData;
    try {
        apartmentData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    } catch (error) {
        console.error('❌ Error loading apartment data:', error.message);
        return;
    }
    
    console.log(`✅ Loaded ${apartmentData.apartments.length} apartments\n`);
    
    // Add station IDs
    console.log('🔍 Matching stations...');
    const stats = addStationIds(apartmentData, stations);
    
    // Update metadata
    apartmentData.metadata.stationMatching = {
        processedAt: new Date().toISOString(),
        totalStations: stats.totalStations,
        matched: stats.matched,
        unmatched: stats.unmatched,
        matchRate: ((stats.matched / stats.totalStations) * 100).toFixed(2) + '%',
        unmatchedStations: Array.from(stats.unmatchedStations).sort(),
        unmatchedDetails: stats.unmatchedDetails
    };
    
    // Save updated data
    const outputFile = inputFile.replace('.json', '_with_station_ids.json');
    fs.writeFileSync(outputFile, JSON.stringify(apartmentData, null, 2));
    
    // Create detailed unmatched stations report
    if (stats.unmatchedStations.size > 0) {
        const unmatchedFile = inputFile.replace('.json', '_unmatched_stations.txt');
        const report = createUnmatchedReport(stats, stations);
        fs.writeFileSync(unmatchedFile, report);
    }
    
    // Print summary
    console.log('\n✅ Station ID Addition Complete!');
    console.log('================================');
    console.log(`Total stations processed: ${stats.totalStations}`);
    console.log(`Successfully matched: ${stats.matched} (${((stats.matched / stats.totalStations) * 100).toFixed(2)}%)`);
    console.log(`Unmatched: ${stats.unmatched}`);
    console.log(`\nOutput: ${outputFile}`);
    
    if (stats.unmatchedStations.size > 0) {
        console.log(`Unmatched stations report: ${inputFile.replace('.json', '_unmatched_stations.txt')}`);
        console.log('\nSample unmatched stations:');
        const samples = Array.from(stats.unmatchedStations).slice(0, 5);
        samples.forEach(s => console.log(`  - ${s}`));
        if (stats.unmatchedStations.size > 5) {
            console.log(`  ... and ${stats.unmatchedStations.size - 5} more`);
        }
    }
}

// CLI
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        // Look for the most recent unified apartments file
        const files = fs.readdirSync(__dirname)
            .filter(f => f.startsWith('unified_apartments_') && f.endsWith('.json'))
            .sort()
            .reverse();
        
        if (files.length === 0) {
            console.error('No unified apartment files found. Run combine_apartments.js first.');
            process.exit(1);
        }
        
        const latestFile = path.join(__dirname, files[0]);
        console.log(`Using latest file: ${files[0]}\n`);
        processApartmentFile(latestFile);
    } else {
        processApartmentFile(args[0]);
    }
}

// Create detailed unmatched stations report
function createUnmatchedReport(stats, stations) {
    const report = [`Unmatched Stations Debugging Report
===================================
Total Unmatched: ${stats.unmatchedStations.size}
`];
    
    // Group by normalized name
    const byNormalized = {};
    stats.unmatchedDetails.forEach(detail => {
        if (!byNormalized[detail.normalizedName]) {
            byNormalized[detail.normalizedName] = [];
        }
        byNormalized[detail.normalizedName].push(detail);
    });
    
    // Check for close matches in station data
    const stationNames = Object.values(stations).map(s => ({
        id: s.id,
        name: s.name,
        nameJa: s.name_ja,
        normalized: normalizeStationName(s.name)
    }));
    
    report.push('\nDetailed Analysis:\n');
    
    Object.entries(byNormalized).sort().forEach(([normalized, details]) => {
        report.push(`\n"${normalized}" (appears ${details.length} times)`);
        report.push('  Original forms:');
        
        // Show unique original forms
        const uniqueForms = [...new Set(details.map(d => `${d.originalName} (${d.line})`))].slice(0, 5);
        uniqueForms.forEach(form => report.push(`    - ${form}`));
        if (details.length > 5) report.push(`    ... and ${details.length - 5} more`);
        
        // Look for similar station names
        const similar = stationNames.filter(s => {
            const sNorm = s.normalized;
            return sNorm.includes(normalized) || normalized.includes(sNorm) ||
                   (sNorm.length > 3 && normalized.length > 3 && 
                    (sNorm.startsWith(normalized.substring(0, 3)) || 
                     normalized.startsWith(sNorm.substring(0, 3))));
        }).slice(0, 3);
        
        if (similar.length > 0) {
            report.push('  Possible matches in transit graph:');
            similar.forEach(s => report.push(`    - ${s.name} (${s.nameJa}) [${s.normalized}]`));
        } else {
            report.push('  No similar stations found in transit graph');
        }
    });
    
    // List all available stations for reference
    report.push('\n\nAll Available Stations in Transit Graph:\n');
    const allStations = Object.values(stations)
        .map(s => `${s.name} (${s.name_ja})`)
        .sort();
    
    // Show first 50 stations as reference
    allStations.slice(0, 50).forEach(s => report.push(`  ${s}`));
    report.push(`  ... and ${allStations.length - 50} more stations`);
    
    return report.join('\n');
}

module.exports = { addStationIds, findStationId, createUnmatchedReport };