const fs = require('fs');
const { JSDOM } = require('jsdom');

/**
 * Station scraper for NAVITIME line pages
 * Gets station names, IDs, and transfer connections from HTML pages
 */

// Helper function to normalize line names
function normalizeLineName(n) {
  return n.replace(/\s+/g, ' ').trim();
}

// Load the line IDs
const lineIds = JSON.parse(fs.readFileSync('lines/complete_navitime_line_ids.json', 'utf8'));
const results = [];

// Function to extract station data from HTML
function extractStations(html, lineName) {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  const stations = [];
  const stationItems = document.querySelectorAll('li.stop-station__item');

  stationItems.forEach((item, index) => {
    const nameLink = item.querySelector('.stop-station__item__name-area__name__link');
    const timetableLink = item.querySelector('.timetable');

    if (nameLink && timetableLink) {
      const name = nameLink.textContent.trim();
      const jaName = item.querySelector('.stop-station__item__name-area__name__link__ja');
      const timetableUrl = timetableLink.getAttribute('href');

      // Extract station ID from timetable URL
      const stationIdMatch = timetableUrl.match(/timetable\/(\d+)\//);
      const stationId = stationIdMatch ? stationIdMatch[1] : null;

      // Extract transfer connections from the transfers section
      const transferEls = item.querySelectorAll('.stop-station__item__info-area__detail__dd__transfers__link a');
      const transfers = [...transferEls]
        .map(el => normalizeLineName(el.textContent))
        .filter(name => name && name !== lineName); // skip the current line

      stations.push({
        name: name,
        japanese_name: jaName ? jaName.textContent.trim() : null,
        station_id: stationId,
        order: index + 1,
        transfers: transfers
      });
    }
  });

  return stations;
}

// Function to fetch and process a line
async function processLine(line) {
  console.log(`Processing ${line.line} (ID: ${line.navitime_id})`);

  if (!line.navitime_id) {
    console.log(`  Skipping - no NAVITIME ID`);
    return {
      line: line.line,
      operator: line.operator,
      navitime_id: null,
      stations: []
    };
  }

  const url = `https://japantravel.navitime.com/en/area/jp/railroad/${line.navitime_id}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.log(`  Error: HTTP ${response.status}`);
      return {
        line: line.line,
        operator: line.operator,
        navitime_id: line.navitime_id,
        stations: [],
        error: `HTTP ${response.status}`
      };
    }

    const html = await response.text();
    const stations = extractStations(html, line.line);

    const totalTransfers = stations.reduce((sum, station) => sum + station.transfers.length, 0);
    console.log(`  Found ${stations.length} stations with ${totalTransfers} total transfers`);

    return {
      line: line.line,
      operator: line.operator,
      navitime_id: line.navitime_id,
      stations: stations
    };

  } catch (error) {
    console.log(`  Error: ${error.message}`);
    return {
      line: line.line,
      operator: line.operator,
      navitime_id: line.navitime_id,
      stations: [],
      error: error.message
    };
  }
}

// Main function
async function main() {
  console.log(`Processing ${lineIds.length} lines for station data...`);

  for (let i = 0; i < lineIds.length; i++) {
    const line = lineIds[i];
    console.log(`\n${i + 1}/${lineIds.length}:`);

    const result = await processLine(line);
    results.push(result);

    // Add delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Save results
  fs.writeFileSync('lines/station_data.json', JSON.stringify(results, null, 2));
  console.log('\nResults saved to lines/station_data.json');

  // Summary
  const totalStations = results.reduce((sum, line) => sum + line.stations.length, 0);
  const totalTransfers = results.reduce((sum, line) =>
    sum + line.stations.reduce((stationSum, station) => stationSum + station.transfers.length, 0), 0);
  const successfulLines = results.filter(line => line.stations.length > 0).length;

  console.log(`\nSummary:`);
  console.log(`Lines processed: ${results.length}`);
  console.log(`Lines with stations: ${successfulLines}`);
  console.log(`Total stations found: ${totalStations}`);
  console.log(`Total transfer connections found: ${totalTransfers}`);
}

// Node.js 18+ has built-in fetch, no need for node-fetch

// Run the scraper
main().catch(console.error);
