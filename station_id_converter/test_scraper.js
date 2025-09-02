#!/usr/bin/env node

/**
 * Test the apartment scraper with a small sample
 */

const { scrapeAllApartments } = require('./scrape_apartments_enhanced');

async function testScraper() {
    // Test URL with typical search parameters
    const testUrl = 'https://realestate.co.jp/en/rent?prefecture=JP-13&city=13000&max_price=160000&min_meter=25&page=1';
    
    console.log('🧪 Testing apartment scraper...\n');
    
    try {
        // Scrape only first 2 pages for testing
        const results = await scrapeAllApartments(testUrl, {
            maxPages: 2,
            saveEveryNPages: 1
        });
        
        console.log('\n✅ Test completed successfully!');
        console.log(`Found ${results.apartments.length} apartments`);
        
        // Display first apartment as sample
        if (results.apartments.length > 0) {
            console.log('\nSample apartment:');
            console.log(JSON.stringify(results.apartments[0], null, 2));
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// Run test
testScraper();