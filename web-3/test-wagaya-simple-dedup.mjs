// Simple test to verify deduplication logic
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function testWagayaDeduplication() {
  console.log('\n=== Testing Wagaya Deduplication ===\n');
  
  const allApartments = [];
  const seenIds = new Set();
  const duplicates = [];
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
      
      // Extract JavaScript data
      const scriptContent = $('script').text();
      const estateDataMatch = scriptContent.match(/var\s+estateDataFromPHP\s*=\s*(\[[\s\S]*?\]);/);
      
      if (estateDataMatch) {
        const estateData = JSON.parse(estateDataMatch[1]);
        console.log(`  Found ${estateData.length} apartments on page ${currentPage}`);
        
        // Process each apartment
        let pageDuplicates = 0;
        estateData.forEach(apt => {
          if (apt.icd) {
            if (seenIds.has(apt.icd)) {
              pageDuplicates++;
              duplicates.push({
                id: apt.icd,
                name: apt.name,
                foundOnPage: currentPage,
                previouslySeenOn: allApartments.find(a => a.id === apt.icd)?.page
              });
            } else {
              seenIds.add(apt.icd);
              allApartments.push({
                id: apt.icd,
                name: apt.name,
                price: apt.price,
                page: currentPage
              });
            }
          }
        });
        
        console.log(`  Page ${currentPage}: ${pageDuplicates} duplicates found`);
        
        // Check if we should continue
        hasMorePages = estateData.length > 0;
      } else {
        console.log(`  No data found on page ${currentPage}`);
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
  console.log(`Total apartments (including duplicates): ${allApartments.length + duplicates.length}`);
  console.log(`Unique apartments: ${seenIds.size}`);
  console.log(`Total duplicates found: ${duplicates.length}`);
  
  if (duplicates.length > 0) {
    console.log('\n=== Duplicate Details (first 10) ===');
    duplicates.slice(0, 10).forEach(dup => {
      console.log(`- ID ${dup.id}: first seen on page ${dup.previouslySeenOn}, duplicate on page ${dup.foundOnPage}`);
    });
  }
  
  // Show distribution
  const pageDistribution = {};
  allApartments.forEach(apt => {
    pageDistribution[apt.page] = (pageDistribution[apt.page] || 0) + 1;
  });
  
  console.log('\n=== Unique Apartments Per Page ===');
  Object.entries(pageDistribution)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .forEach(([page, count]) => {
      console.log(`  Page ${page}: ${count} unique apartments`);
    });
  
  console.log('\n=== Summary ===');
  if (duplicates.length === 0) {
    console.log('✅ No duplicates found across pages - each apartment appears only once');
  } else {
    console.log(`⚠️  Found ${duplicates.length} duplicate apartment listings across pages`);
    console.log('This is why we need deduplication in the scraper!');
  }
}

testWagayaDeduplication().catch(console.error);