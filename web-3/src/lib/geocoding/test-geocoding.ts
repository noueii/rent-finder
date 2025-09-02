/**
 * Test script for geocoding functionality
 * 
 * Run with: npx tsx src/lib/geocoding/test-geocoding.ts
 */

import { geocodingService, JapaneseAddressNormalizer } from './index';

async function testGeocoding() {
  console.log('🗾 Testing Geocoding Service\n');

  // Test addresses
  const testAddresses = [
    '東京都渋谷区道玄坂1-12-1',
    '東京都新宿区西新宿２－８－１',
    '東京都港区六本木6-10-1',
    '東京都千代田区丸の内1-9-1', // Tokyo Station
    '東京都台東区浅草2-3-1', // Sensoji Temple area
  ];

  console.log('1️⃣ Testing Japanese Address Normalization\n');
  for (const address of testAddresses) {
    const normalized = JapaneseAddressNormalizer.normalize(address);
    console.log(`Original: ${address}`);
    console.log(`Normalized: ${normalized}`);
    
    const components = JapaneseAddressNormalizer.extractComponents(address);
    console.log('Components:', components);
    console.log('---');
  }

  console.log('\n2️⃣ Testing Single Address Geocoding\n');
  const singleResult = await geocodingService.geocode(testAddresses[0]!);
  
  if (singleResult) {
    console.log(`Address: ${testAddresses[0]}`);
    console.log(`Coordinates: ${singleResult.latitude}, ${singleResult.longitude}`);
    console.log(`Display Name: ${singleResult.displayName}`);
    console.log(`Confidence: ${singleResult.confidence}`);
    console.log(`Provider: ${singleResult.provider}`);
  } else {
    console.log('❌ Failed to geocode address');
  }

  console.log('\n3️⃣ Testing Batch Geocoding with Progress\n');
  const batchResults = await geocodingService.batchGeocode(
    testAddresses.slice(0, 3),
    {},
    (completed, total) => {
      console.log(`Progress: ${completed}/${total}`);
    }
  );

  for (const [address, result] of batchResults) {
    if (result) {
      console.log(`✅ ${address} -> ${result.latitude}, ${result.longitude}`);
    } else {
      console.log(`❌ ${address} -> Failed`);
    }
  }

  console.log('\n4️⃣ Testing Cache\n');
  console.log('Cache stats before:', geocodingService.getCacheStats());
  
  // Try geocoding the same address again (should hit cache)
  const cachedResult = await geocodingService.geocode(testAddresses[0]!);
  if (cachedResult) {
    console.log(`Cache hit: ${cachedResult.provider === 'cache' ? 'Yes' : 'No'}`);
  }
  
  console.log('Cache stats after:', geocodingService.getCacheStats());

  console.log('\n5️⃣ Testing Reverse Geocoding\n');
  if (singleResult) {
    const reverseAddress = await geocodingService.reverseGeocode(
      singleResult.latitude,
      singleResult.longitude
    );
    console.log(`Coordinates: ${singleResult.latitude}, ${singleResult.longitude}`);
    console.log(`Reverse geocoded address: ${reverseAddress}`);
  }

  console.log('\n6️⃣ Testing Distance Calculation\n');
  // Tokyo Station to Shibuya Station
  const tokyoStation = { lat: 35.6812, lon: 139.7671 };
  const shibuyaStation = { lat: 35.6580, lon: 139.7016 };
  
  const distance = geocodingService.constructor.calculateDistance(
    tokyoStation.lat,
    tokyoStation.lon,
    shibuyaStation.lat,
    shibuyaStation.lon
  );
  
  console.log(`Distance from Tokyo Station to Shibuya Station: ${(distance / 1000).toFixed(2)} km`);

  console.log('\n✨ Geocoding tests completed!');
}

// Run tests
testGeocoding().catch(console.error);