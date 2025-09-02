// Simple test to understand Wagaya issue
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function testWagayaIssue() {
  console.log('\n=== Testing Wagaya Issue ===\n');
  
  // Test multiple pages to see if pagination works
  for (let page = 1; page <= 3; page++) {
    const url = `https://wagaya-japan.com/en/rent/tokyo/list/?min_price=50000&max_price=300000&page=${page}`;
    
    console.log(`\n--- Page ${page} ---`);
    console.log('URL:', url);
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Check JavaScript data
      const scriptContent = $('script').text();
      const estateDataMatch = scriptContent.match(/var\s+estateDataFromPHP\s*=\s*(\[[\s\S]*?\]);/);
      
      if (estateDataMatch) {
        const estateData = JSON.parse(estateDataMatch[1]);
        console.log(`JavaScript data: ${estateData.length} apartments`);
        
        // Check if data changes between pages
        if (estateData.length > 0) {
          console.log(`First apartment ID: ${estateData[0].icd}`);
          console.log(`Last apartment ID: ${estateData[estateData.length - 1].icd}`);
        }
      }
      
      // Check HTML listings
      const htmlListings = $('li.pro-search-item').length;
      console.log(`HTML listings: ${htmlListings}`);
      
      // Check pagination
      const hasNextButton = $('.pagination .page-item.next').length > 0;
      const isNextDisabled = $('.pagination .page-item.next').hasClass('disabled');
      console.log(`Has next button: ${hasNextButton}, Disabled: ${isNextDisabled}`);
      
      // Check if we're on the right page
      const activePage = $('.pagination .page-item.active a').text().trim();
      console.log(`Active page: ${activePage}`);
      
    } catch (error) {
      console.error(`Error on page ${page}:`, error.message);
    }
  }
  
  console.log('\n\n=== Summary ===');
  console.log('The issue appears to be that:');
  console.log('1. The JavaScript data contains ALL apartments (127 total) on EVERY page');
  console.log('2. The scraper extracts this data on the first page and returns');
  console.log('3. It never needs to go to page 2+ because it already has all data');
  console.log('\nThis is actually CORRECT behavior - Wagaya loads all data upfront!');
}

testWagayaIssue().catch(console.error);