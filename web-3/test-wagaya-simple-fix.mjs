// Simple test to verify Wagaya pagination fix
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function testWagayaPaginationFix() {
  console.log('\n=== Testing Wagaya Pagination Fix ===\n');
  console.log('This simulates what the scraper does with the new getNextPageUrl logic\n');
  
  const apartments = [];
  const seenIds = new Set();
  let currentPage = 1;
  let hasMorePages = true;
  
  while (hasMorePages && currentPage <= 15) { // Safety limit
    const url = `https://wagaya-japan.com/en/rent/tokyo/list/?min_price=50000&max_price=300000&page=${currentPage}`;
    console.log(`\nFetching page ${currentPage}...`);
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Extract JavaScript data (what scrapeSearchPage does)
      const scriptContent = $('script').text();
      const estateDataMatch = scriptContent.match(/var\s+estateDataFromPHP\s*=\s*(\[[\s\S]*?\]);/);
      
      let pageApartments = 0;
      
      if (estateDataMatch) {
        const estateData = JSON.parse(estateDataMatch[1]);
        pageApartments = estateData.length;
        
        // Add unique apartments
        estateData.forEach(apt => {
          if (apt.icd && !seenIds.has(apt.icd)) {
            seenIds.add(apt.icd);
            apartments.push({
              id: apt.icd,
              name: apt.name,
              price: apt.price,
              page: currentPage
            });
          }
        });
        
        console.log(`  Found ${pageApartments} apartments (${apartments.length} total unique)`);
      }
      
      // Simulate getNextPageUrl logic
      let hasListings = false;
      
      // Check JavaScript data
      if (estateDataMatch) {
        try {
          const estateData = JSON.parse(estateDataMatch[1]);
          hasListings = estateData.length > 0;
          console.log(`  [getNextPageUrl] Page ${currentPage} has ${estateData.length} apartments in JavaScript data`);
        } catch (error) {
          console.error('  [getNextPageUrl] Failed to parse estate data:', error.message);
        }
      }
      
      // If no JavaScript data, check HTML listings as fallback
      if (!hasListings) {
        const htmlListings = $('li.pro-search-item, li.lists-fluid-item').length;
        hasListings = htmlListings > 0;
        if (hasListings) {
          console.log(`  [getNextPageUrl] Page ${currentPage} has ${htmlListings} apartments in HTML`);
        }
      }
      
      // Decision: continue to next page?
      if (hasListings) {
        console.log(`  [getNextPageUrl] Found listings, will check page ${currentPage + 1}`);
        hasMorePages = true;
      } else {
        console.log(`  [getNextPageUrl] No listings found on page ${currentPage}, stopping pagination`);
        hasMorePages = false;
      }
      
      currentPage++;
      
    } catch (error) {
      console.error(`Error on page ${currentPage}:`, error.message);
      hasMorePages = false;
    }
  }
  
  console.log('\n=== Results ===');
  console.log(`Total pages processed: ${currentPage - 1}`);
  console.log(`Total unique apartments found: ${apartments.length}`);
  
  // Show apartment distribution by page
  const pageDistribution = {};
  apartments.forEach(apt => {
    pageDistribution[apt.page] = (pageDistribution[apt.page] || 0) + 1;
  });
  
  console.log('\nApartments per page:');
  Object.entries(pageDistribution)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .forEach(([page, count]) => {
      console.log(`  Page ${page}: ${count} apartments`);
    });
  
  // Success check
  if (apartments.length >= 700) {
    console.log('\n✅ SUCCESS: Pagination fix is working!');
    console.log(`   The scraper will now get all ${apartments.length} apartments instead of just 127`);
  } else if (apartments.length > 127) {
    console.log('\n⚠️  PARTIAL SUCCESS: Got more than first page but not all');
  } else {
    console.log('\n❌ FAILURE: Still only getting first page');
  }
}

testWagayaPaginationFix().catch(console.error);