const { PrismaClient } = require('@prisma/client');

async function checkDatabase() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Checking database tables...\n');
    
    // Try to query each model to see if the table exists
    const checks = [
      { name: 'Station', query: () => prisma.station.count() },
      { name: 'Apartment', query: () => prisma.apartment.count() },
      { name: 'Search', query: () => prisma.search.count() },
      { name: 'User', query: () => prisma.user.count() },
      { name: 'StationMapping', query: () => prisma.stationMapping.count() },
      { name: 'ImportMetadata', query: () => prisma.importMetadata.count() },
    ];
    
    for (const check of checks) {
      try {
        const count = await check.query();
        console.log(`✅ ${check.name} table exists (${count} records)`);
      } catch (error) {
        console.log(`❌ ${check.name} table does NOT exist`);
      }
    }
    
  } catch (error) {
    console.error('Database connection error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();