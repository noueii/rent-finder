const fs = require('fs').promises;

async function checkProgress() {
  try {
    // Load progress file
    const progress = JSON.parse(await fs.readFile('fetch_progress.json', 'utf-8'));
    
    console.log('Fetch Progress Status');
    console.log('===================\n');
    
    console.log(`Total lines: ${progress.total_lines}`);
    console.log(`Processed: ${progress.processed_lines.length} (${Math.round(progress.processed_lines.length / progress.total_lines * 100)}%)`);
    console.log(`Failed: ${progress.failed_lines.length}`);
    console.log(`Current index: ${progress.current_index}`);
    console.log(`Remaining: ${progress.total_lines - progress.current_index}`);
    
    // Calculate time estimate
    const startTime = new Date(progress.start_time);
    const currentTime = new Date();
    const elapsedMinutes = (currentTime - startTime) / 1000 / 60;
    const ratePerMinute = progress.current_index / elapsedMinutes;
    const remainingMinutes = (progress.total_lines - progress.current_index) / ratePerMinute;
    
    console.log(`\nTime elapsed: ${Math.round(elapsedMinutes)} minutes`);
    console.log(`Estimated remaining: ${Math.round(remainingMinutes)} minutes`);
    console.log(`Estimated completion: ${new Date(currentTime.getTime() + remainingMinutes * 60000).toLocaleTimeString()}`);
    
    // Check line_data directory
    const lineFiles = await fs.readdir('line_data').catch(() => []);
    console.log(`\nLine data files created: ${lineFiles.length}`);
    
    // Show recent completions
    console.log('\nRecently processed:');
    progress.processed_lines.slice(-5).forEach(lineId => {
      const file = lineFiles.find(f => f.startsWith(lineId));
      if (file) {
        console.log(`  ✓ ${file}`);
      }
    });
    
    if (progress.failed_lines.length > 0) {
      console.log('\nFailed lines:');
      progress.failed_lines.forEach(f => {
        console.log(`  ✗ ${f.line_name} (${f.line_id})`);
      });
    }
    
  } catch (error) {
    console.error('Error reading progress:', error.message);
  }
}

// Auto-refresh every 10 seconds if running in watch mode
if (process.argv.includes('--watch')) {
  setInterval(checkProgress, 10000);
}

checkProgress();