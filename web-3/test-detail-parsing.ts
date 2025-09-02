/**
 * Test Detail Page Parsing
 * Debug script to test parsing apartment details from specific URLs
 */

// Set environment for fast scrapers
process.env.USE_FAST_SCRAPERS = 'true';
process.env.PROXY_FILE = 'src/lib/scrapers/data/fast-socks-proxies.txt';
process.env.PROXY_ROTATION_STRATEGY = 'performance';

import { FastWagayaJapanScraper } from './src/lib/scrapers/sources/fast-wagaya-scraper';
import { load } from 'cheerio';
import axios from 'axios';

async function testDetailParsing() {
  console.log('🔍 Testing Detail Page Parsing');
  console.log('==============================\n');

  const testUrl = 'https://wagaya-japan.com/en/chintai_detail.php?id=3475292';
  
  try {
    // First, let's fetch the page directly to see the HTML structure
    console.log('Fetching page directly...');
    const response = await axios.get(testUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = load(response.data);
    
    console.log('\n📄 Page Analysis:');
    console.log('Title tag:', $('title').text());
    console.log('H1 tags:', $('h1').map((_, el) => $(el).text().trim()).get());
    console.log('H2 tags:', $('h2').map((_, el) => $(el).text().trim()).get().slice(0, 5));
    
    // Look for price
    console.log('\n💰 Price search:');
    const priceSelectors = [
      '.price', '.property-price', '.detail-price', 
      'td:contains("賃料")', 'td:contains("Rent")', 
      'span:contains("¥")', 'div:contains("¥")'
    ];
    
    priceSelectors.forEach(selector => {
      const elements = $(selector);
      if (elements.length > 0) {
        console.log(`${selector}: ${elements.first().text().trim().substring(0, 50)}`);
      }
    });
    
    // Look for size
    console.log('\n📏 Size search:');
    const sizeSelectors = [
      'td:contains("面積")', 'td:contains("Area")', 
      'td:contains("Size")', '.property-size', '.area'
    ];
    
    sizeSelectors.forEach(selector => {
      const elements = $(selector);
      if (elements.length > 0) {
        console.log(`${selector}: ${elements.first().text().trim()}`);
        // Check next td
        const nextTd = elements.first().next('td');
        if (nextTd.length) {
          console.log(`  -> next td: ${nextTd.text().trim()}`);
        }
      }
    });
    
    // Look for station info
    console.log('\n🚉 Station search:');
    const stationSelectors = [
      'td:contains("交通")', 'td:contains("Station")', 
      'td:contains("Access")', '.station-info', '.access'
    ];
    
    stationSelectors.forEach(selector => {
      const elements = $(selector);
      if (elements.length > 0) {
        console.log(`${selector}: ${elements.first().text().trim()}`);
        // Check next td
        const nextTd = elements.first().next('td');
        if (nextTd.length) {
          console.log(`  -> next td: ${nextTd.text().trim()}`);
        }
      }
    });
    
    // Now test with the scraper
    console.log('\n\n🤖 Testing with FastWagayaJapanScraper:');
    const scraper = new FastWagayaJapanScraper({
      enableProxyRotation: false // Disable proxy for this test
    });
    
    // Test the fetchApartmentsByUrlsConcurrent method
    const result = await scraper.fetchApartmentsByUrlsConcurrent([testUrl]);
    
    if (result.success && result.data.length > 0) {
      console.log('\n✅ Successfully parsed apartment:');
      const apt = result.data[0];
      console.log(JSON.stringify(apt, null, 2));
    } else {
      console.log('\n❌ Failed to parse apartment');
      console.log('Result:', result);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testDetailParsing().catch(console.error);