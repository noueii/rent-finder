#!/usr/bin/env node

import { YoloJapanScraper } from './src/lib/scrapers/sources/yolo-japan-scraper.ts';

const testUrl = 'https://home.yolo-japan.com/en/property/1467713';

async function testYoloApartment() {
  console.log('🔍 Testing Yolo Japan scraper with specific apartment');
  console.log(`URL: ${testUrl}\n`);

  const scraper = new YoloJapanScraper({
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en,ja;q=0.9',
    }
  });

  try {
    // Test fetching the apartment details
    console.log('📥 Fetching apartment details...\n');
    
    const result = await scraper.scrapeApartmentDetails(testUrl);
    
    if (!result) {
      console.error('❌ Failed to fetch apartment details');
      return;
    }

    console.log('✅ Successfully fetched apartment data:\n');
    console.log('📋 Basic Info:');
    console.log(`- External ID: ${result.externalId}`);
    console.log(`- Title: ${result.title}`);
    console.log(`- Price: ¥${result.price?.toLocaleString() || 'N/A'}`);
    console.log(`- Size: ${result.size}m²`);
    console.log(`- Layout: ${result.layout || 'N/A'}`);
    console.log(`- Floor: ${result.floor || 'N/A'}`);
    
    console.log('\n📍 Location:');
    console.log(`- Address: ${result.address || 'N/A'}`);
    console.log(`- Ward: ${result.ward || 'N/A'}`);
    console.log(`- City: ${result.city || 'N/A'}`);
    console.log(`- Coordinates: ${result.latitude || 'N/A'}, ${result.longitude || 'N/A'}`);
    
    console.log('\n💰 Fees:');
    console.log(`- Total Fees: ¥${result.feesTotal?.toLocaleString() || 'N/A'}`);
    if (result.feesJson) {
      console.log(`- Rent: ¥${result.feesJson.rent?.toLocaleString() || 0}`);
      console.log(`- Management: ¥${result.feesJson.management?.toLocaleString() || 0}`);
      console.log(`- Deposit: ¥${result.feesJson.deposit?.toLocaleString() || 0}`);
      console.log(`- Key Money: ¥${result.feesJson.keyMoney?.toLocaleString() || 0}`);
    }
    
    console.log('\n🚉 Nearest Stations:');
    if (result.nearestStations && result.nearestStations.length > 0) {
      result.nearestStations.forEach(station => {
        console.log(`- ${station.name}: ${station.walkingMinutes} min walk (${station.lines?.join(', ') || 'N/A'})`);
      });
    } else {
      console.log('- No station information available');
    }
    
    console.log('\n🖼️ Images:');
    console.log(`- Main image: ${result.image || 'N/A'}`);
    console.log(`- Total images: ${result.images?.length || 0}`);
    
    // Debug the images array structure
    if (result.images && result.images.length > 0) {
      console.log('\n🐛 Debug - Image array structure:');
      console.log(`- Type of images: ${typeof result.images}`);
      console.log(`- Is Array: ${Array.isArray(result.images)}`);
      console.log(`- First image type: ${typeof result.images[0]}`);
      console.log(`- First 3 images:`, result.images.slice(0, 3));
    }
    
    console.log('\n✨ Other Details:');
    console.log(`- Amenities: ${result.amenities?.join(', ') || 'None'}`);
    console.log(`- Availability: ${result.availability || 'Unknown'}`);
    console.log(`- Fetched Details: ${result.fetchedDetails || false}`);
    
    // Full JSON output for debugging
    console.log('\n📄 Full JSON output:');
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ Error during scraping:', error);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
  }
}

// Run the test
testYoloApartment().catch(console.error);