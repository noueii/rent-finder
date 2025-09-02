// Test with correct Wagaya URL format
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function testCorrectWagayaUrl() {
  console.log('\n=== Testing Wagaya with Correct URL Format ===\n');
  
  // Use the correct URL format from the scraper
  const correctUrl = 'https://wagaya-japan.com/en/rent/tokyo/list/?min_price=50000&max_price=300000';
  
  console.log('Fetching:', correctUrl);
  
  try {
    const response = await fetch(correctUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Count apartments
    const apartments = $('.property-item').length;
    console.log(`\nFound ${apartments} apartments on page 1`);
    
    // Check pagination
    const paginationExists = $('.pagination').length > 0;
    console.log('Pagination exists:', paginationExists);
    
    if (paginationExists) {
      // Check total pages
      const pageNumbers = [];
      $('.pagination .page-item a').each((_, el) => {
        const text = $(el).text().trim();
        const num = parseInt(text);
        if (!isNaN(num)) {
          pageNumbers.push(num);
        }
      });
      
      const maxPage = Math.max(...pageNumbers, 1);
      console.log('Page numbers found:', pageNumbers);
      console.log('Max page:', maxPage);
      
      // Check next button
      const nextButton = $('.pagination .page-item.next');
      const isNextDisabled = nextButton.hasClass('disabled');
      console.log('Next button disabled:', isNextDisabled);
    }
    
    // If still no apartments, check for any error indicators
    if (apartments === 0) {
      console.log('\n⚠️  Still no apartments found!');
      
      // Check if there's a "no results" message
      const noResults = $('.no-results, .empty-results, .alert').text();
      if (noResults) {
        console.log('No results message:', noResults.trim());
      }
      
      // Try without price filters
      console.log('\nTrying without price filters...');
      const simpleUrl = 'https://wagaya-japan.com/en/rent/tokyo/list/';
      const simpleResponse = await fetch(simpleUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const simpleHtml = await simpleResponse.text();
      const simple$ = cheerio.load(simpleHtml);
      const simpleApartments = simple$('.property-item').length;
      console.log(`Found ${simpleApartments} apartments without filters`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testCorrectWagayaUrl().catch(console.error);