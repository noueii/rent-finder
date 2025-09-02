import { YoloJapanScraper } from './src/lib/scrapers/sources/yolo-japan-scraper';

// Enable debug mode
process.env.SCRAPER_DEBUG = 'true';

async function testYoloJapanScraper() {
  const scraper = new YoloJapanScraper();
  
  console.log('Testing YOLO Japan scraper with debug mode enabled...');
  
  const params = {
    minPrice: 50000,
    maxPrice: 150000,
    limit: 5, // Just test with a few apartments
  };
  
  try {
    const result = await scraper.search(params);
    
    if (result.success && result.data) {
      console.log(`\nSuccessfully scraped ${result.data.length} apartments`);
      if (result.data.length > 0) {
        console.log('\nFirst apartment:', JSON.stringify(result.data[0], null, 2));
      }
    } else {
      console.error('Scraping failed:', result.error);
    }
  } catch (error) {
    console.error('Error running scraper:', error);
  }
}

testYoloJapanScraper();