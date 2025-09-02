const fs = require('fs');

/**
 * Simple NAVITIME Line ID Scraper
 * Searches for line IDs based on the lines in lines/lines.json
 */

// Load the lines from JSON file
const lines = JSON.parse(fs.readFileSync('lines/lines.json', 'utf8'));
const results = [];

// Simple function to search for a line
async function searchLine(lineName) {
  const searchTerm = lineName.replace(' Line', '').toLowerCase();
  const url = `https://japantravel.navitime.com/en/async/transport/suggest/lines?word=${encodeURIComponent(searchTerm)}&name=${encodeURIComponent(searchTerm)}`;
  
  try {
    const response = await fetch(url);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error(`Error searching for ${lineName}:`, error.message);
  }
  return [];
}

// Process each line
async function processLines() {
  console.log(`Processing ${lines.length} lines...`);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    console.log(`${i + 1}/${lines.length}: Searching for ${line.line}`);
    
    const searchResults = await searchLine(line.line);
    
    if (searchResults.length > 0) {
      // Take the first result as the best match
      const match = searchResults[0];
      results.push({
        line: line.line,
        operator: line.operator,
        navitime_id: match.id,
        navitime_name: match.name
      });
      console.log(`  Found: ${match.name} (ID: ${match.id})`);
    } else {
      results.push({
        line: line.line,
        operator: line.operator,
        navitime_id: null,
        navitime_name: null
      });
      console.log(`  No results found`);
    }
    
    // Wait 1 second between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Save results
  fs.writeFileSync('lines/navitime_line_ids.json', JSON.stringify(results, null, 2));
  console.log('\nResults saved to lines/navitime_line_ids.json');
  
  // Summary
  const found = results.filter(r => r.navitime_id).length;
  console.log(`\nSummary: ${found}/${results.length} lines found`);
}

// Check if we need to install node-fetch
if (typeof fetch === 'undefined') {
  try {
    const { default: fetch } = require('node-fetch');
    global.fetch = fetch;
  } catch (error) {
    console.error('Please install node-fetch: npm install node-fetch');
    process.exit(1);
  }
}

// Run the script
processLines().catch(console.error);
