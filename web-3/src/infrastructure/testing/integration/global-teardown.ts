import { PrismaClient } from '@prisma/client';

export default async function globalTeardown() {
  console.log('🧹 Cleaning up integration test environment...');

  try {
    const prisma = new PrismaClient();
    
    // Clear all test data
    await prisma.$transaction([
      prisma.searchHistory.deleteMany(),
      prisma.favorite.deleteMany(),
      prisma.searchPreset.deleteMany(),
      prisma.apartmentNearbyStation.deleteMany(),
      prisma.apartment.deleteMany(),
      prisma.stationLine.deleteMany(),
      prisma.station.deleteMany(),
      prisma.line.deleteMany(),
      prisma.session.deleteMany(),
      prisma.account.deleteMany(),
      prisma.user.deleteMany(),
    ]);

    await prisma.$disconnect();

    console.log('✅ Integration test cleanup complete!');
  } catch (error) {
    console.error('❌ Failed to cleanup test environment:', error);
    // Don't throw - cleanup errors shouldn't fail the test run
  }
}