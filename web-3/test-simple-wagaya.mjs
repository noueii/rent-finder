// Simple test to check Wagaya pagination issue
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function testWagayaPagination() {
  console.log('\n=== Testing Wagaya Pagination ===\n');
  
  // First, let's manually check the first page
  const firstPageUrl = 'https://wagaya-japan.com/en/rent?prefectures=tokyo&min_price=50000&max_price=300000&page=1';
  
  console.log('Fetching first page:', firstPageUrl);
  
  try {
    const response = await fetch(firstPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Count apartments on first page
    const apartments = $('.property-item').length;
    console.log(`Found ${apartments} apartments on page 1`);
    
    // Check pagination structure
    console.log('\nPagination structure:');
    const paginationHtml = $('.pagination').html();
    console.log(paginationHtml ? paginationHtml.substring(0, 500) + '...' : 'No pagination found');
    
    // Check if next button is available
    const nextButton = $('.pagination .page-item.next');
    const isNextDisabled = nextButton.hasClass('disabled');
    const nextLink = nextButton.find('a').attr('href');
    
    console.log('\nNext button status:');
    console.log('- Is disabled:', isNextDisabled);
    console.log('- Next link:', nextLink);
    
    // Try to extract total pages
    const pageNumbers = [];
    $('.pagination .page-item').each((_, el) => {
      const text = $(el).text().trim();
      const num = parseInt(text);
      if (!isNaN(num)) {
        pageNumbers.push(num);
      }
    });
    
    console.log('\nPage numbers found:', pageNumbers);
    const maxPage = Math.max(...pageNumbers, 1);
    console.log('Max page number:', maxPage);
    
    // Check if we're actually getting results
    if (apartments === 0) {
      console.log('\n⚠️  No apartments found on first page!');
      console.log('This might be why fetchAll stops early.');
      
      // Let's check the response status and content
      console.log('\nResponse status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      // Check for error messages
      const errorMessages = $('.error, .alert, .warning').text();
      if (errorMessages) {
        console.log('\nError messages found:', errorMessages);
      }
    }
    
  } catch (error) {
    console.error('\nError fetching page:', error.message);
  }
}

// Test Metro Residences local data
async function testMetroData() {
  console.log('\n\n=== Testing Metro Residences Local Data ===\n');
  
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    // Check if the data file exists
    const dataPath = path.join(process.cwd(), 'src', 'lib', 'scrapers', 'data', 'metro.json');
    console.log('Checking for data file at:', dataPath);
    
    const exists = await fs.access(dataPath).then(() => true).catch(() => false);
    console.log('File exists:', exists);
    
    if (exists) {
      const data = JSON.parse(await fs.readFile(dataPath, 'utf-8'));
      console.log('Total units in local data:', data.units?.length || 0);
      
      // Check price range
      if (data.units && data.units.length > 0) {
        const pricesInRange = data.units.filter(u => u.price >= 50000 && u.price <= 300000);
        console.log(`Units in price range 50k-300k: ${pricesInRange.length}`);
      }
    }
  } catch (error) {
    console.error('Error checking Metro data:', error.message);
  }
}

// Run tests
console.log('Running tests...');
testWagayaPagination()
  .then(() => testMetroData())
  .catch(console.error);