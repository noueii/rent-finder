const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function testConnection() {
  try {
    console.log('Testing database connection...');
    const count = await prisma.station.count();
    console.log(`Current station count: ${count}`);
    
    // Test creating a dummy station
    const testStation = await prisma.station.create({
      data: {
        id: 'test-station-' + Date.now(),
        name: 'Test Station',
        nameJa: 'テスト駅',
        lines: '[]',
        transfers: '[]',
      }
    });
    
    console.log('Created test station:', testStation.id);
    
    // Clean up
    await prisma.station.delete({
      where: { id: testStation.id }
    });
    
    console.log('Database connection successful!');
  } catch (error) {
    console.error('Database connection failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();