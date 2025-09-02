#!/usr/bin/env node

/**
 * Analyze unmapped realestate.co.jp stations
 * Find out which stations and lines are missing from CLI tool
 */

const fs = require('fs');
const path = require('path');

// Load mapping data
const mappingFile = path.join(__dirname, 'station_id_mapping.json');
const mapping = JSON.parse(fs.readFileSync(mappingFile, 'utf8'));

// Group unmapped stations by train line
const stationsByLine = {};
mapping.unmappedRealestate.forEach(station => {
    if (!stationsByLine[station.trainLine]) {
        stationsByLine[station.trainLine] = [];
    }
    stationsByLine[station.trainLine].push(station);
});

// Sort lines by number of unmapped stations
const sortedLines = Object.entries(stationsByLine)
    .map(([line, stations]) => ({
        trainLine: line,
        count: stations.length,
        stations: stations
    }))
    .sort((a, b) => b.count - a.count);

// Output detailed analysis
console.log('# Unmapped Realestate.co.jp Stations Analysis\n');
console.log(`Total unmapped stations: ${mapping.unmappedRealestate.length}\n`);

// Summary by category
const categories = {
    shinkansen: [],
    newLines: [],
    missingStations: [],
    airportLines: []
};

sortedLines.forEach(lineData => {
    if (lineData.trainLine.includes('Shinkansen')) {
        categories.shinkansen.push(lineData);
    } else if (lineData.trainLine.includes('Airport') || lineData.trainLine.includes('Sky Access')) {
        categories.airportLines.push(lineData);
    } else if (['Toden Arakawa Line', 'Keiō Sagamihara Line', 'Seibu Tamako Line', 
                'Seibu Yurakucho Line', 'JR Narita Express', 'JR Chūō-Sōbu Line',
                'Keiō Keibajō Line', 'Seibu Toshima Line', 'Seibu Tamagawa Line',
                'Tokyo Metro Yūrakuchō New Line', 'Tōbu Daishi Line'].includes(lineData.trainLine)) {
        categories.newLines.push(lineData);
    } else {
        categories.missingStations.push(lineData);
    }
});

// Output by category
console.log('## 1. Shinkansen Lines (High-speed rail - not for daily commute)\n');
categories.shinkansen.forEach(line => {
    console.log(`- **${line.trainLine}**: ${line.count} stations`);
    line.stations.forEach(st => console.log(`  - ${st.name}`));
});

console.log('\n## 2. Lines Not in CLI Tool\n');
categories.newLines.forEach(line => {
    console.log(`- **${line.trainLine}**: ${line.count} stations`);
    if (line.count <= 10) {
        line.stations.forEach(st => console.log(`  - ${st.name}`));
    } else {
        console.log(`  - First 5: ${line.stations.slice(0, 5).map(s => s.name).join(', ')}`);
        console.log(`  - ... and ${line.count - 5} more`);
    }
});

console.log('\n## 3. Airport/Access Lines\n');
categories.airportLines.forEach(line => {
    console.log(`- **${line.trainLine}**: ${line.count} stations`);
    line.stations.forEach(st => console.log(`  - ${st.name}`));
});

console.log('\n## 4. Missing Stations from Existing Lines\n');
console.log('These are stations on lines that exist in CLI tool but specific stations are missing:\n');
categories.missingStations.slice(0, 10).forEach(line => {
    console.log(`- **${line.trainLine}**: ${line.count} missing stations`);
    if (line.count <= 5) {
        line.stations.forEach(st => console.log(`  - ${st.name}`));
    } else {
        console.log(`  - Examples: ${line.stations.slice(0, 3).map(s => s.name).join(', ')}`);
        console.log(`  - ... and ${line.count - 3} more`);
    }
});

// Create a unique stations list
const uniqueStationNames = new Set();
mapping.unmappedRealestate.forEach(station => {
    uniqueStationNames.add(station.name);
});

console.log('\n## Summary Statistics\n');
console.log(`- Total unmapped stations: ${mapping.unmappedRealestate.length}`);
console.log(`- Unique station names: ${uniqueStationNames.size}`);
console.log(`- Number of train lines with unmapped stations: ${Object.keys(stationsByLine).length}`);

// Most common unmapped station names (likely transfer stations)
const stationNameCounts = {};
mapping.unmappedRealestate.forEach(station => {
    stationNameCounts[station.name] = (stationNameCounts[station.name] || 0) + 1;
});

const commonStations = Object.entries(stationNameCounts)
    .filter(([name, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

console.log('\n## Most Common Unmapped Station Names\n');
console.log('These stations appear on multiple lines but are not mapped:\n');
commonStations.forEach(([name, count]) => {
    console.log(`- **${name}**: appears ${count} times`);
});

// Save detailed JSON report
const report = {
    summary: {
        totalUnmapped: mapping.unmappedRealestate.length,
        uniqueStations: uniqueStationNames.size,
        trainLines: Object.keys(stationsByLine).length
    },
    byCategory: {
        shinkansen: categories.shinkansen.map(l => ({
            line: l.trainLine,
            count: l.count,
            stations: l.stations.map(s => s.name)
        })),
        newLines: categories.newLines.map(l => ({
            line: l.trainLine,
            count: l.count,
            stations: l.stations.map(s => s.name)
        })),
        airportLines: categories.airportLines.map(l => ({
            line: l.trainLine,
            count: l.count,
            stations: l.stations.map(s => s.name)
        })),
        missingStations: categories.missingStations.map(l => ({
            line: l.trainLine,
            count: l.count,
            stations: l.stations.map(s => s.name)
        }))
    },
    commonStations: commonStations.map(([name, count]) => ({ name, count })),
    fullList: sortedLines
};

fs.writeFileSync(
    path.join(__dirname, 'unmapped_realestate_analysis.json'),
    JSON.stringify(report, null, 2),
    'utf8'
);

console.log('\n✅ Detailed report saved to unmapped_realestate_analysis.json');