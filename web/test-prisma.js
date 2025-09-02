const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

async function testPrisma() {
  console.log('DATABASE_URL:', process.env.DATABASE_URL || 'file:./rent-finder.db');
  
  const dbPath = path.join(__dirname, 'prisma', 'rent-finder.db');
  console.log('Expected DB path:', dbPath);
  console.log('DB file exists:', fs.existsSync(dbPath));
  
  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  });
  
  try {
    // Try to run a raw query to see what tables exist
    const tables = await prisma.$queryRaw`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name;
    `;
    
    console.log('\nTables in database:');
    tables.forEach(t => console.log('-', t.name));
    
    // Try to create a simple test query
    console.log('\nTrying to access Apartment table...');
    try {
      await prisma.apartment.count();
      console.log('✅ Apartment table exists');
    } catch (e) {
      console.log('❌ Apartment table does NOT exist');
      console.log('Error:', e.message);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPrisma();