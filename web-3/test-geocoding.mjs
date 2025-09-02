import { geocodingService } from './src/lib/geocoding/geocoding-service.ts';

const testAddresses = [
  "Tokyo Ota Ku西蒲田7丁目",
  "Tokyo Shinjuku Ku新宿3丁目",
  "3-5-5 Shimo Ochiai, Shinjuku-ku, Tokyo"
];

for (const address of testAddresses) {
  console.log('\n=== Testing address:', address);
  const result = await geocodingService.geocodeAddress(address);
  console.log('Result:', result);
}

process.exit(0);
