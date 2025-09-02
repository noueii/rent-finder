#!/usr/bin/env node

/**
 * Test station matching logic
 */

const fs = require('fs');
const path = require('path');

// Load transit graph
const graphPath = path.join(__dirname, '../lines/tokyo_transit_graph_complete.json');
const transitData = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
const stations = transitData.stations;

// Test cases
const testStations = [
    { name: 'Shibuya', line: 'JR Yamanote' },
    { name: 'Shinjuku', line: 'JR Chuo' },
    { name: 'Tokyo', line: 'JR Yamanote Line' },
    { name: 'Ikebukuro', line: '' },
    { name: 'Ueno', line: 'JR' },
    { name: 'Roppongi', line: 'Tokyo Metro Hibiya' },
    { name: 'Asakusa', line: 'Tokyo Metro Ginza' },
    { name: 'Kamata', line: 'JR Keihin-Tohoku' },
    { name: 'Iriya', line: 'Tokyo Metro-Hibiya line' },
    { name: 'Kameido', line: 'JR Sobu' }
];

console.log('Station Matching Test');
console.log('====================\n');

// Count stations by name
const stationsByName = {};
for (const [id, station] of Object.entries(stations)) {
    const name = station.name.toLowerCase();
    if (!stationsByName[name]) {
        stationsByName[name] = [];
    }
    stationsByName[name].push({
        id,
        name: station.name,
        name_ja: station.name_ja,
        lines: station.transfers || []
    });
}

// Test each station
for (const test of testStations) {
    console.log(`\nSearching for: "${test.name}" on "${test.line}"`);
    
    const normalized = test.name.toLowerCase().replace(/\s*station$/i, '');
    const matches = stationsByName[normalized] || [];
    
    if (matches.length === 0) {
        console.log('  ❌ No matches found');
    } else if (matches.length === 1) {
        console.log(`  ✅ Found: ${matches[0].name} (${matches[0].name_ja}) - ID: ${matches[0].id}`);
        console.log(`     Lines: ${matches[0].lines.slice(0, 3).join(', ')}${matches[0].lines.length > 3 ? '...' : ''}`);
    } else {
        console.log(`  ⚠️  Multiple matches (${matches.length}):`);
        matches.forEach(m => {
            console.log(`     - ${m.name} (${m.name_ja}) - ID: ${m.id}`);
            console.log(`       Lines: ${m.lines.slice(0, 2).join(', ')}${m.lines.length > 2 ? '...' : ''}`);
        });
    }
}

// Show some statistics
console.log('\n\nStation Statistics');
console.log('==================');
console.log(`Total stations: ${Object.keys(stations).length}`);

const duplicateNames = Object.entries(stationsByName)
    .filter(([name, list]) => list.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

console.log(`\nStations with duplicate names: ${duplicateNames.length}`);
console.log('Top 5 most common station names:');
duplicateNames.slice(0, 5).forEach(([name, list]) => {
    console.log(`  - "${name}": ${list.length} stations`);
});