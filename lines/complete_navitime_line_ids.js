const fs = require('fs').promises;

async function createCompleteLineIds() {
  // Read existing data
  const existingData = JSON.parse(await fs.readFile('navitime_line_ids.json', 'utf-8'));
  const searchResults = JSON.parse(await fs.readFile('missing_lines_search_results.json', 'utf-8'));
  
  // Extract existing line names to avoid duplicates
  const existingLineNames = new Set(existingData.map(line => line.navitime_name));
  
  // Start with existing data
  const completeData = [...existingData];
  
  // Add new lines that were found and not already in the file
  for (const result of searchResults) {
    if (result.found && !existingLineNames.has(result.navitime_name)) {
      // Determine operator based on line name
      let operator = '';
      const name = result.navitime_name;
      
      if (name.startsWith('Tokyo Metro')) {
        operator = 'Tokyo Metro';
      } else if (name.startsWith('Toei')) {
        operator = 'Toei';
      } else if (name.startsWith('JR')) {
        operator = 'JR East';
      } else if (name.startsWith('Keio')) {
        operator = 'Keio Corporation';
      } else if (name.startsWith('Odakyu')) {
        operator = 'Odakyu Electric Railway';
      } else if (name.startsWith('Seibu')) {
        operator = 'Seibu Railway';
      } else if (name.startsWith('Tobu')) {
        operator = 'Tobu Railway';
      } else if (name.startsWith('Sotetsu')) {
        operator = 'Sotetsu';
      } else if (name.includes('Yokohama')) {
        operator = 'Yokohama City';
      }
      
      completeData.push({
        line: result.expectedName.replace(' Line', '').replace('JR ', ''), // Simplified name
        operator: operator,
        navitime_id: result.navitime_id,
        navitime_name: result.navitime_name
      });
    }
  }
  
  // Sort by operator and then by line name
  completeData.sort((a, b) => {
    if (a.operator !== b.operator) {
      return a.operator.localeCompare(b.operator);
    }
    return a.line.localeCompare(b.line);
  });
  
  // Write complete data to new file
  await fs.writeFile(
    'complete_navitime_line_ids.json',
    JSON.stringify(completeData, null, 2)
  );
  
  console.log(`Created complete_navitime_line_ids.json with ${completeData.length} lines`);
  
  // Show summary
  const operatorCounts = {};
  completeData.forEach(line => {
    operatorCounts[line.operator] = (operatorCounts[line.operator] || 0) + 1;
  });
  
  console.log('\nLines by operator:');
  Object.entries(operatorCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([operator, count]) => {
      console.log(`  ${operator}: ${count}`);
    });
}

createCompleteLineIds().catch(console.error);