// Test the exact same database connection that tRPC uses
const { PrismaClient } = require('@prisma/client');

// Create the same db instance as in src/lib/db.ts
const globalForPrisma = globalThis;
const db = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

async function testDbContext() {
  console.log('Testing database context used by tRPC...\n');
  
  try {
    // Test the exact same query that's failing
    console.log('Testing apartment.findFirst (the failing query)...');
    const result = await db.apartment.findFirst({
      where: { id: 'test' }
    });
    console.log('✅ apartment.findFirst works');
    
    // Test count
    const count = await db.apartment.count();
    console.log(`✅ Found ${count} apartments`);
    
    // Test raw query to see tables
    const tables = await db.$queryRaw`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name;
    `;
    
    console.log('\nTables in database:');
    tables.forEach(t => console.log('-', t.name));
    
    // Test the exact transaction pattern used in admin router
    console.log('\nTesting transaction...');
    await db.$transaction(async (tx) => {
      const apartments = await tx.apartment.findMany({ take: 1 });
      console.log(`✅ Transaction works, found ${apartments.length} apartments`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Error code:', error.code);
    
    // Check if it's specifically the table not found error
    if (error.code === 'P2021') {
      console.error('This is the exact same error from the admin router!');
    }
  } finally {
    await db.$disconnect();
  }
}

testDbContext();