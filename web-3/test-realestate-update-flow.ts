import { FastRealEstateScraper } from './src/lib/scrapers/sources/fast-realestate-scraper';
import { ApartmentUpdater } from './src/lib/scrapers/utils/apartment-updater';
import { db } from './src/server/db';
import type { ScrapedApartmentData } from './src/types/scraper';

async function testUpdateFlow() {
  try {
    console.log('\n🔍 Testing RealEstate update flow...\n');
    
    // Test URL - using an actual apartment from the database
    const testUrl = 'https://realestate.co.jp/en/rent/view/742';
    
    // Create scraper
    const scraper = new FastRealEstateScraper();
    
    // Fetch and parse apartment
    console.log('1️⃣  Fetching apartment details...');
    const result = await scraper.fetchApartmentsByUrlsConcurrent([testUrl]);
    
    if (!result.success || !result.data || result.data.length === 0) {
      console.error('❌ Failed to fetch apartment:', result.error);
      return;
    }
    
    const apartmentData = result.data[0] as ScrapedApartmentData;
    console.log('\n2️⃣  Parsed apartment data:', {
      externalId: apartmentData.externalId,
      sourceSite: apartmentData.sourceSite,
      title: apartmentData.title,
      price: apartmentData.price,
      size: apartmentData.size,
      address: apartmentData.address,
      hasImages: apartmentData.images?.length > 0,
      hasStations: apartmentData.nearestStations?.length > 0,
      hasCoordinates: !!(apartmentData.latitude && apartmentData.longitude),
      feesTotal: apartmentData.feesTotal
    });
    
    // Check if apartment exists in database
    console.log('\n3️⃣  Checking if apartment exists in database...');
    const existing = await db.apartment.findFirst({
      where: {
        externalId: apartmentData.externalId,
        sourceSite: apartmentData.sourceSite
      }
    });
    
    if (existing) {
      console.log('✅ Apartment exists in database:', existing.id);
      
      // Try updating it
      console.log('\n4️⃣  Testing update...');
      const updateResults = await ApartmentUpdater.updateApartments([apartmentData]);
      console.log('Update results:', updateResults);
    } else {
      console.log('❌ Apartment not found in database');
      console.log('   You need to run a scrape job first to create the apartment');
      
      // Show what would be created
      console.log('\n📝 Data that would be saved:');
      console.log(JSON.stringify(apartmentData, null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.$disconnect();
  }
}

testUpdateFlow();