import { ApartmentUpdater } from './src/lib/scrapers/utils/apartment-updater';
import { db } from './src/server/db';
import type { ScrapedApartmentData } from './src/types/scraper';

async function testDirectUpdate() {
  try {
    // Create test data that matches what the scraper returns
    const testApartmentData: ScrapedApartmentData = {
      externalId: '742',
      sourceUrl: 'https://realestate.co.jp/en/rent/view/742',
      sourceSite: 'realestate.co.jp',
      title: '1DK Apartment Nakano-ku',
      price: 78000,
      size: 25,
      address: 'Minamidai, Nakano-ku, Tokyo',
      amenities: [],
      availability: 'available',
      images: [],
      nearestStations: [{
        name: 'Hatagaya Station',
        walkingMinutes: 12
      }],
      latitude: 35.6838016,
      longitude: 139.6738164,
      layout: '1DK',
      buildingAge: 36,
      feesJson: {
        deposit: 0,
        keyMoney: 0,
        agencyFee: 0,
        guarantorFee: 0,
        insurance: 0,
        other: {}
      },
      feesTotal: 0
    };
    
    console.log('🔄 Testing direct update of apartment 742...\n');
    
    // Call ApartmentUpdater directly
    const updateResults = await ApartmentUpdater.updateApartments([testApartmentData]);
    
    console.log('\n📊 Update results:', updateResults);
    
    // Check the updated apartment
    if (updateResults[0]?.updated) {
      const updated = await db.apartment.findFirst({
        where: { id: updateResults[0].apartmentId },
        include: { images: true }
      });
      
      console.log('\n✅ Updated apartment:', {
        id: updated?.id,
        fetchedDetails: updated?.fetchedDetails,
        latitude: updated?.latitude,
        longitude: updated?.longitude,
        feesTotal: updated?.feesTotal,
        imageCount: updated?.images.length
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.$disconnect();
  }
}

testDirectUpdate();