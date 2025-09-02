// Count total unique apartments across all Wagaya pages
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function countTotalApartments() {
  console.log('\n=== Counting Total Wagaya Apartments ===\n');
  
  const allApartments = new Map(); // Use Map to track unique apartments by ID
  let totalPages = 0;
  
  // Keep fetching pages until we get no new apartments
  for (let page = 1; page <= 10; page++) { // Max 10 pages for safety
    const url = `https://wagaya-japan.com/en/rent/tokyo/list/?min_price=50000&max_price=300000&page=${page}`;
    
    console.log(`Fetching page ${page}...`);
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Extract JavaScript data
      const scriptContent = $('script').text();
      const estateDataMatch = scriptContent.match(/var\s+estateDataFromPHP\s*=\s*(\[[\s\S]*?\]);/);
      
      if (estateDataMatch) {
        const estateData = JSON.parse(estateDataMatch[1]);
        let newCount = 0;
        
        // Add apartments to our map
        estateData.forEach(apt => {
          if (apt.icd && !allApartments.has(apt.icd)) {
            allApartments.set(apt.icd, {
              id: apt.icd,
              name: apt.name,
              price: apt.price,
              page: page
            });
            newCount++;
          }
        });
        
        console.log(`  - Found ${estateData.length} apartments, ${newCount} new`);
        
        // If no new apartments, we've seen all pages
        if (newCount === 0) {
          console.log(`  - No new apartments, stopping`);
          totalPages = page - 1;
          break;
        }
        
        totalPages = page;
      } else {
        console.log(`  - No JavaScript data found`);
        break;
      }
      
    } catch (error) {
      console.error(`Error on page ${page}:`, error.message);
      break;
    }
  }
  
  console.log('\n=== Summary ===');
  console.log(`Total unique apartments: ${allApartments.size}`);
  console.log(`Total pages with data: ${totalPages}`);
  
  // Show distribution by page
  const pageDistribution = {};
  allApartments.forEach(apt => {
    pageDistribution[apt.page] = (pageDistribution[apt.page] || 0) + 1;
  });
  
  console.log('\nApartments per page:');
  Object.entries(pageDistribution)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .forEach(([page, count]) => {
      console.log(`  Page ${page}: ${count} apartments`);
    });
}

countTotalApartments().catch(console.error);