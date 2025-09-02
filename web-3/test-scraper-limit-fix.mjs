import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

// Test multiple scrapers to verify dynamic pagination works with limit: undefined
async function testScraperPagination() {
  console.log('\n=== Testing Dynamic Pagination with limit: undefined ===\n');
  
  // Test RealEstate.co.jp
  console.log('1. Testing RealEstate.co.jp:');
  await testRealEstate();
  
  console.log('\n2. Testing Wagaya Japan:');
  await testWagaya();
  
  console.log('\n3. Testing Yolo Japan:');
  await testYolo();
}

async function testRealEstate() {
  let total = 0;
  let pageCount = 0;
  let currentPage = 1;
  
  while (pageCount < 3) { // Test first 3 pages
    const url = `https://realestate.co.jp/en/rent?prefecture=JP-13&city=13000&max_rent=300000&search=Search&page=${currentPage}`;
    
    try {
      const response = await fetch(url);
      const html = await response.text();
      const $ = cheerio.load(html);
      
      const apartments = $('.property-listing').length;
      total += apartments;
      pageCount++;
      
      // Check for next page
      const isNextInvisible = $('.paginator .pagination-next').hasClass('invisible');
      
      console.log(`  Page ${currentPage}: ${apartments} apartments found, next page: ${!isNextInvisible ? 'available' : 'not available'}`);
      
      if (isNextInvisible) break;
      currentPage++;
      
    } catch (error) {
      console.error(`  Error on page ${currentPage}:`, error.message);
      break;
    }
  }
  
  console.log(`  Total: ${total} apartments across ${pageCount} pages`);
  if (total > 15) {
    console.log('  ✅ Dynamic pagination is working!');
  } else {
    console.log('  ❌ Still limited to initial page');
  }
}

async function testWagaya() {
  let total = 0;
  let pageCount = 0;
  let currentPage = 1;
  
  while (pageCount < 3) { // Test first 3 pages
    const url = `https://wagaya-japan.com/en/rent?prefectures=tokyo&min_price=0&max_price=300000&page=${currentPage}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      const html = await response.text();
      const $ = cheerio.load(html);
      
      const apartments = $('.property-item').length;
      total += apartments;
      pageCount++;
      
      // Check for next page
      const isNextDisabled = $('.pagination .page-item.next').hasClass('disabled');
      
      console.log(`  Page ${currentPage}: ${apartments} apartments found, next page: ${!isNextDisabled ? 'available' : 'disabled'}`);
      
      if (isNextDisabled || apartments === 0) break;
      currentPage++;
      
    } catch (error) {
      console.error(`  Error on page ${currentPage}:`, error.message);
      break;
    }
  }
  
  console.log(`  Total: ${total} apartments across ${pageCount} pages`);
  if (total > 20) {
    console.log('  ✅ Dynamic pagination is working!');
  } else {
    console.log('  ❌ Still limited to initial results');
  }
}

async function testYolo() {
  // Yolo uses a different API structure
  console.log('  Yolo uses JSON API, checking first page apartment count...');
  
  try {
    const url = 'https://api.yolo-japan.com/v2/apartments/search';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        page: 1,
        limit: 20,
        filters: {
          prefecture: 'tokyo',
          maxRent: 300000
        }
      })
    });
    
    const data = await response.json();
    const total = data.total || 0;
    const pageApartments = data.apartments?.length || 0;
    
    console.log(`  API reports ${total} total apartments`);
    console.log(`  First page has ${pageApartments} apartments`);
    
    if (total > 20) {
      console.log('  ✅ Multiple pages available for fetching');
    } else {
      console.log('  ❌ Limited results available');
    }
  } catch (error) {
    console.error('  Error testing Yolo:', error.message);
  }
}

// Run tests
testScraperPagination().catch(console.error);