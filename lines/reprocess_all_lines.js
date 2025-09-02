const fs = require('fs').promises;
const { processLine } = require('./fetch_all_lines_data_v2');

async function reprocessAllLines() {
  console.log('Reprocessing all line data with through-service filtering\n');
  
  // Get all line data files
  const files = await fs.readdir('line_data');
  const lineFiles = files.filter(f => f.endsWith('.json') && !f.includes('_v2_test'));
  
  console.log(`Found ${lineFiles.length} line data files to reprocess\n`);
  
  let processed = 0;
  let failed = 0;
  
  for (const file of lineFiles) {
    try {
      // Extract navitime_id from filename
      const navitime_id = file.split('_')[0];
      
      // Load the existing line data to get basic info
      const existingData = JSON.parse(await fs.readFile(`line_data/${file}`, 'utf-8'));
      
      // Create line object for processing
      const line = {
        line: existingData.line,
        operator: existingData.operator,
        navitime_id: navitime_id,
        navitime_name: existingData.line
      };
      
      console.log(`\nProcessing ${line.line} (${navitime_id})`);
      
      // Process with the v2 algorithm
      const result = await processLine(line, processed, lineFiles.length);
      
      if (result) {
        processed++;
        console.log(`✓ Successfully reprocessed ${line.line}`);
      } else {
        failed++;
        console.log(`✗ Failed to reprocess ${line.line}`);
      }
      
      // Small delay between processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`Error processing ${file}: ${error.message}`);
      failed++;
    }
  }
  
  console.log('\n\nReprocessing Complete!');
  console.log('===================');
  console.log(`Successfully processed: ${processed}`);
  console.log(`Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\nNote: Failed lines may be due to missing data in station_data.json');
  }
}

reprocessAllLines().catch(console.error);