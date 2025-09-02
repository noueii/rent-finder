// Test if Wagaya scraper now gets all pages
import dotenv from 'dotenv';
dotenv.config();

// Simple test using fetch to simulate what the scraper does
async function simulateWagayaScraper() {
  console.log('\n=== Simulating Wagaya Scraper with Dynamic Pagination ===\n');
  
  const apartments = [];
  let currentPage = 1;
  let hasMorePages = true;
  
  while (hasMorePages && currentPage <= 15) { // Safety limit
    const url = `https://wagaya-japan.com/en/rent/tokyo/list/?min_price=50000&max_price=300000&page=${currentPage}`;
    console.log(`\nProcessing page ${currentPage}...`);
    
    try {
      // This simulates what scrapeSearchPage does
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const html = await response.text();
      const { load } = await import('cheerio');
      const $ = load(html);
      
      // Extract JavaScript data (what the scraper does)
      const scriptContent = $('script').text();
      const estateDataMatch = scriptContent.match(/var\s+estateDataFromPHP\s*=\s*(\[[\s\S]*?\]);/);
      
      if (estateDataMatch) {
        const estateData = JSON.parse(estateDataMatch[1]);
        console.log(`  Found ${estateData.length} apartments from JavaScript data`);
        apartments.push(...estateData);
      }
      
      // Check for next page (what getNextPageUrl does)
      const nextLink = $('.pagination .page-item.next a').attr('href');
      const isNextDisabled = $('.pagination .page-item.next').hasClass('disabled');
      
      console.log(`  Next page link: ${nextLink || 'none'}`);
      console.log(`  Next button disabled: ${isNextDisabled}`);
      
      // The actual scraper checks if there's a valid next page
      hasMorePages = !isNextDisabled && nextLink && nextLink !== '#';
      
      if (!hasMorePages) {
        console.log('  No more pages available');
      }
      
      currentPage++;
      
    } catch (error) {
      console.error(`Error on page ${currentPage}:`, error.message);
      hasMorePages = false;
    }
  }
  
  // Count unique apartments
  const uniqueApartments = new Map();
  apartments.forEach(apt => {
    if (apt.icd) {
      uniqueApartments.set(apt.icd, apt);
    }
  });
  
  console.log('\n=== Results ===');
  console.log(`Total apartments found: ${apartments.length}`);
  console.log(`Unique apartments: ${uniqueApartments.size}`);
  console.log(`Pages processed: ${currentPage - 1}`);
  
  if (uniqueApartments.size >= 700) {
    console.log('\n✅ SUCCESS: Scraper would get all apartments with dynamic pagination!');
  } else {
    console.log('\n❌ Still not getting all apartments');
  }
}

simulateWagayaScraper().catch(console.error);