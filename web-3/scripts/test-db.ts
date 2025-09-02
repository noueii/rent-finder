import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testConnection() {
  console.log('🔍 Testing database connection...');
  
  try {
    // Test the connection
    await prisma.$connect();
    console.log('✅ Successfully connected to the database!');
    
    // Try a simple query
    const userCount = await prisma.user.count();
    console.log(`📊 Current user count: ${userCount}`);
    
    const stationCount = await prisma.station.count();
    console.log(`🚉 Current station count: ${stationCount}`);
    
    const apartmentCount = await prisma.apartment.count();
    console.log(`🏠 Current apartment count: ${apartmentCount}`);
    
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();