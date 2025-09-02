// Debug Wagaya scraper
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugWagaya() {
  console.log('\n=== Debugging Wagaya Scraper ===\n');
  
  const url = 'https://wagaya-japan.com/en/rent/tokyo/list/?min_price=50000&max_price=300000';
  
  console.log('Fetching:', url);
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Check for JavaScript data
    const scriptContent = $('script').text();
    const estateDataMatch = scriptContent.match(/var\s+estateDataFromPHP\s*=\s*(\[[\s\S]*?\]);/);
    
    if (estateDataMatch) {
      console.log('\n✅ Found estateDataFromPHP variable');
      
      try {
        const estateData = JSON.parse(estateDataMatch[1]);
        console.log(`Contains ${estateData.length} apartments`);
        
        // Check first apartment
        if (estateData.length > 0) {
          console.log('\nFirst apartment:');
          const first = estateData[0];
          console.log('- ID:', first.icd);
          console.log('- Name:', first.name);
          console.log('- Price:', first.price);
          console.log('- Size:', first.heibei);
          console.log('- Type:', first.type);
          console.log('- Address:', first.address);
          
          // Check if they match our price range
          const priceMatch = first.price?.match(/[0-9,]+/);
          if (priceMatch) {
            const priceNum = parseInt(priceMatch[0].replace(/,/g, ''));
            console.log('- Parsed price:', priceNum);
            console.log('- In range 50k-300k?', priceNum >= 50000 && priceNum <= 300000);
          }
        }
        
        // Count how many are in our price range
        let inRange = 0;
        estateData.forEach(item => {
          const priceMatch = item.price?.match(/[0-9,]+/);
          if (priceMatch) {
            const priceNum = parseInt(priceMatch[0].replace(/,/g, ''));
            if (priceNum >= 50000 && priceNum <= 300000) {
              inRange++;
            }
          }
        });
        
        console.log(`\n${inRange} apartments are in the 50k-300k price range`);
        
      } catch (error) {
        console.error('Failed to parse JavaScript data:', error.message);
      }
    } else {
      console.log('\n❌ No estateDataFromPHP found');
    }
    
    // Check HTML selectors as fallback
    console.log('\n--- HTML Selectors Check ---');
    console.log('li.pro-search-item:', $('li.pro-search-item').length);
    console.log('li.lists-fluid-item:', $('li.lists-fluid-item').length);
    console.log('.property-item:', $('.property-item').length);
    
    // Check pagination
    console.log('\n--- Pagination Check ---');
    const paginationExists = $('.pagination').length > 0;
    console.log('Pagination exists:', paginationExists);
    
    if (paginationExists) {
      const pageLinks = $('.pagination .page-item a');
      const pageNumbers = [];
      pageLinks.each((_, el) => {
        const text = $(el).text().trim();
        if (/^\d+$/.test(text)) {
          pageNumbers.push(parseInt(text));
        }
      });
      console.log('Page numbers:', pageNumbers);
      
      // Check next button
      const nextButton = $('.pagination .page-item.next');
      console.log('Next button exists:', nextButton.length > 0);
      console.log('Next button disabled:', nextButton.hasClass('disabled'));
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugWagaya().catch(console.error);