import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

// Simple test to see how many apartments are available
async function testRealEstate() {
  console.log('\n=== Testing RealEstate.co.jp ===\n');
  
  const pages = [];
  let currentPage = 1;
  let hasMore = true;
  
  while (hasMore && currentPage <= 5) { // Test first 5 pages
    const url = `https://realestate.co.jp/en/rent?prefecture=JP-13&city=13000&max_rent=300000&search=Search&page=${currentPage}`;
    console.log(`Fetching page ${currentPage}...`);
    
    try {
      const response = await fetch(url);
      const html = await response.text();
      const $ = cheerio.load(html);
      
      const apartments = $('.property-listing').length;
      pages.push({ page: currentPage, apartments });
      
      // Check for next page
      const nextLink = $('.paginator .pagination-next a').attr('href');
      const isNextInvisible = $('.paginator .pagination-next').hasClass('invisible');
      
      hasMore = !isNextInvisible && !!nextLink;
      currentPage++;
      
    } catch (error) {
      console.error(`Error on page ${currentPage}:`, error.message);
      hasMore = false;
    }
  }
  
  console.log('\nResults:');
  let total = 0;
  pages.forEach(p => {
    console.log(`Page ${p.page}: ${p.apartments} apartments`);
    total += p.apartments;
  });
  console.log(`Total apartments found: ${total}`);
}

testRealEstate();