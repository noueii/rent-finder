import { geocodingService } from './src/lib/geocoding/geocoding-service.ts';

const testAddresses = [
  "Tokyo Itabashi-ku 本町 41-12",
  "Tokyo Ota Ku西蒲田7丁目",
  "Tokyo Meguro-ku 下目黒4丁目 17-13"
];

for (const address of testAddresses) {
  console.log('\n=== Testing address:', address);
  const result = await geocodingService.geocodeAddress(address);
  console.log('Result:', result ? `${result.latitude}, ${result.longitude}` : 'Failed');
}

process.exit(0);
