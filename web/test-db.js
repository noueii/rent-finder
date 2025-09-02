const { PrismaClient } = require('@prisma/client');

async function testDb() {
  const prisma = new PrismaClient();
  
  try {
    // Test connection
    const stationCount = await prisma.station.count();
    console.log(`Connected! Found ${stationCount} stations`);
    
    // Test if we can read apartment data
    const apartmentCount = await prisma.apartment.count();
    console.log(`Found ${apartmentCount} apartments`);
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDb();