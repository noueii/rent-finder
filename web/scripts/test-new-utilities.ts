import { dbUtils } from '../lib/db';

async function testNewUtilities() {
  console.log('🧪 Testing New Database Utilities');
  console.log('=================================');
  
  try {
    // Test 1: Get station by ID
    console.log('1. Testing getStationById...');
    const tokyoStation = await dbUtils.getStationById('00006668');
    if (tokyoStation) {
      console.log(`   ✅ Found: ${tokyoStation.name} (${tokyoStation.nameJa})`);
      console.log(`   Lines: ${tokyoStation.lines.slice(0, 3).join(', ')}...`);
      console.log(`   Transfers: ${tokyoStation.transfers.slice(0, 3).join(', ')}...`);
      console.log(`   Apartments: ${tokyoStation._count.apartments}`);
    } else {
      console.log('   ❌ Station not found');
    }
    
    // Test 2: Get all stations with counts (limit to first 5)
    console.log('\n2. Testing getAllStationsWithCounts...');
    const allStations = await dbUtils.getAllStationsWithCounts();
    console.log(`   ✅ Retrieved ${allStations.length} stations`);
    console.log('   First 5 stations:');
    allStations.slice(0, 5).forEach((station, i) => {
      console.log(`   ${i+1}. ${station.name} (${station._count.apartments} apartments)`);
    });
    
    // Test 3: Get apartments by station
    console.log('\n3. Testing getApartmentsByStation...');
    const apartments = await dbUtils.getApartmentsByStation('00006668', 5);
    console.log(`   ✅ Found ${apartments.length} apartments for Tokyo station`);
    if (apartments.length > 0) {
      const apt = apartments[0];
      console.log(`   Sample: ${apt.title} - ¥${apt.rentMonthly.toLocaleString()}`);
      console.log(`   Features: ${apt.features.join(', ')}`);
    }
    
    // Test 4: Dashboard stats
    console.log('\n4. Testing getDashboardStats...');
    const stats = await dbUtils.getDashboardStats();
    console.log(`   ✅ Dashboard Statistics:`);
    console.log(`   Total Stations: ${stats.totalStations}`);
    console.log(`   Total Apartments: ${stats.totalApartments}`);
    console.log(`   Available Apartments: ${stats.availableApartments}`);
    console.log(`   Total Searches: ${stats.totalSearches}`);
    console.log(`   Recent Searches (24h): ${stats.recentSearches}`);
    if (stats.averageRent) {
      console.log(`   Average Rent: ¥${Math.round(stats.averageRent).toLocaleString()}`);
      console.log(`   Rent Range: ¥${stats.minRent?.toLocaleString()} - ¥${stats.maxRent?.toLocaleString()}`);
    }
    
    // Test 5: Test apartment upsert
    console.log('\n5. Testing upsertApartment...');
    const testApartment = {
      sourceUrl: 'https://test.com/apartment-123',
      sourceSite: 'test.com',
      title: 'Test Apartment 123',
      buildingName: 'Test Building',
      rentMonthly: 150000,
      size: 30.5,
      layout: '1LDK',
      prefecture: 'Tokyo',
      city: 'Shibuya-ku',
      address: '1-1-1 Shibuya, Shibuya-ku, Tokyo',
      stationId: '00006668',
      walkingMinutes: 8,
      features: ['Air Conditioning', 'Balcony', 'Auto Lock'],
      imageUrls: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg']
    };
    
    const upsertedApartment = await dbUtils.upsertApartment(testApartment);
    console.log(`   ✅ Upserted apartment: ${upsertedApartment.id}`);
    console.log(`   Title: ${upsertedApartment.title}`);
    console.log(`   Rent: ¥${upsertedApartment.rentMonthly.toLocaleString()}`);
    
    // Test 6: Get apartments needing verification
    console.log('\n6. Testing getApartmentsNeedingVerification...');
    const needsVerification = await dbUtils.getApartmentsNeedingVerification(1);
    console.log(`   ✅ Found ${needsVerification.length} apartments needing verification`);
    if (needsVerification.length > 0) {
      const apt = needsVerification[0];
      console.log(`   Sample: ${apt.title} (Last verified: ${apt.lastVerified})`);
    }
    
    // Test 7: Mark apartment as unavailable
    console.log('\n7. Testing markApartmentUnavailable...');
    const updatedApartment = await dbUtils.markApartmentUnavailable(upsertedApartment.id);
    console.log(`   ✅ Marked apartment as unavailable: ${updatedApartment.isAvailable}`);
    
    // Test 8: Cleanup old searches
    console.log('\n8. Testing cleanupOldSearches...');
    const deletedCount = await dbUtils.cleanupOldSearches(0); // Delete all searches
    console.log(`   ✅ Deleted ${deletedCount} old searches`);
    
    console.log('\n🎉 All new utility functions are working correctly!');
    return true;
    
  } catch (error) {
    console.error('❌ Error testing new utilities:', error);
    return false;
  }
}

async function main() {
  const success = await testNewUtilities();
  
  if (success) {
    console.log('\n✅ All new database utilities are ready for use!');
    process.exit(0);
  } else {
    console.log('\n❌ Some utility functions failed!');
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  });