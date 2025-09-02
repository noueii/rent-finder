import { db, dbUtils } from '../lib/db';

async function testDatabaseOperations() {
  console.log('🧪 Testing Database Operations');
  console.log('==============================');
  
  try {
    // Test 1: Health check
    console.log('1. Testing health check...');
    const health = await dbUtils.healthCheck();
    console.log(`   Status: ${health.status}`);
    if (health.status !== 'healthy') {
      console.error('   ❌ Health check failed:', health.error);
      return false;
    }
    console.log('   ✅ Health check passed');
    
    // Test 2: Station search by name
    console.log('\n2. Testing station search by name...');
    const tokyoStations = await dbUtils.findStations('Tokyo');
    console.log(`   Found ${tokyoStations.length} stations matching 'Tokyo'`);
    if (tokyoStations.length > 0) {
      console.log(`   First result: ${tokyoStations[0].name} (${tokyoStations[0].nameJa})`);
      console.log('   ✅ Station search passed');
    } else {
      console.error('   ❌ No stations found for Tokyo');
      return false;
    }
    
    // Test 3: Station search by Japanese name
    console.log('\n3. Testing station search by Japanese name...');
    const japaneseStations = await dbUtils.findStations('東京');
    console.log(`   Found ${japaneseStations.length} stations matching '東京'`);
    if (japaneseStations.length > 0) {
      console.log(`   First result: ${japaneseStations[0].name} (${japaneseStations[0].nameJa})`);
      console.log('   ✅ Japanese name search passed');
    } else {
      console.error('   ❌ No stations found for 東京');
      return false;
    }
    
    // Test 4: Get stations by IDs
    console.log('\n4. Testing get stations by IDs...');
    const testStationIds = ['00006668', '00004464']; // Tokyo, Kanda
    const stationsByIds = await dbUtils.getStationsByIds(testStationIds);
    console.log(`   Retrieved ${stationsByIds.length} stations by IDs`);
    if (stationsByIds.length === testStationIds.length) {
      stationsByIds.forEach(station => {
        console.log(`   ${station.name} (${station.nameJa}): ${station._count.apartments} apartments`);
      });
      console.log('   ✅ Get stations by IDs passed');
    } else {
      console.error('   ❌ Not all stations found by IDs');
      return false;
    }
    
    // Test 5: Search apartments (should have limited results since we don't have many)
    console.log('\n5. Testing apartment search...');
    const apartmentResults = await dbUtils.searchApartments({
      stationIds: testStationIds,
      limit: 10
    });
    console.log(`   Found ${apartmentResults.total} apartments, returning ${apartmentResults.apartments.length}`);
    if (apartmentResults.apartments.length > 0) {
      const apt = apartmentResults.apartments[0];
      console.log(`   Sample apartment: ${apt.title} - ¥${apt.rentMonthly.toLocaleString()}`);
    }
    console.log('   ✅ Apartment search passed');
    
    // Test 6: Get station statistics
    console.log('\n6. Testing station statistics...');
    const tokyoStationId = '00006668';
    const stats = await dbUtils.getStationStats(tokyoStationId);
    console.log(`   Tokyo station stats: ${stats._count} apartments`);
    if (stats._avg.rentMonthly) {
      console.log(`   Average rent: ¥${Math.round(stats._avg.rentMonthly).toLocaleString()}`);
    }
    console.log('   ✅ Station statistics passed');
    
    // Test 7: Record a search
    console.log('\n7. Testing search recording...');
    const searchRecord = await dbUtils.recordSearch({
      targetStationId: tokyoStationId,
      targetStationName: 'Tokyo',
      maxCommuteMinutes: 30,
      filters: { maxPrice: 200000 },
      stationsSearched: 50,
      totalResults: 25,
      resultsReturned: 20,
      searchDurationMs: 1250,
      sessionId: 'test-session-' + Date.now()
    });
    console.log(`   Recorded search with ID: ${searchRecord.id}`);
    console.log('   ✅ Search recording passed');
    
    // Test 8: Get search analytics
    console.log('\n8. Testing search analytics...');
    const analytics = await dbUtils.getSearchAnalytics(7);
    console.log(`   Found ${analytics.length} searches in the last 7 days`);
    if (analytics.length > 0) {
      console.log(`   Latest search: ${analytics[0].targetStationName} (${analytics[0].maxCommuteMinutes}min)`);
    }
    console.log('   ✅ Search analytics passed');
    
    // Test 9: Direct database queries
    console.log('\n9. Testing direct database queries...');
    const stationCount = await db.station.count();
    const apartmentCount = await db.apartment.count();
    const searchCount = await db.search.count();
    
    console.log(`   Stations: ${stationCount}`);
    console.log(`   Apartments: ${apartmentCount}`);
    console.log(`   Searches: ${searchCount}`);
    console.log('   ✅ Direct queries passed');
    
    // Test 10: JSON parsing for SQLite
    console.log('\n10. Testing JSON data parsing...');
    const sampleStation = await db.station.findFirst({
      where: { name: 'Tokyo' }
    });
    
    if (sampleStation) {
      const lines = JSON.parse(sampleStation.lines);
      const transfers = JSON.parse(sampleStation.transfers || '[]');
      console.log(`   Tokyo station has ${lines.length} lines and ${transfers.length} transfers`);
      console.log(`   First line: ${lines[0]}`);
      console.log('   ✅ JSON parsing passed');
    } else {
      console.error('   ❌ Could not find Tokyo station for JSON test');
      return false;
    }
    
    console.log('\n🎉 All database operations tests passed!');
    return true;
    
  } catch (error) {
    console.error('❌ Error during database operations test:', error);
    return false;
  }
}

async function main() {
  const success = await testDatabaseOperations();
  
  if (success) {
    console.log('\n✅ Database is ready for use!');
    process.exit(0);
  } else {
    console.log('\n❌ Database operations test failed!');
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  });