const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('Starting apartment images migration...');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../migrations/add_apartment_images.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by statements and filter out comments and empty lines
    const statements = migrationSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt && !stmt.startsWith('--') && stmt !== '');
    
    console.log(`Executing ${statements.length} migration statements...`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        await prisma.$executeRawUnsafe(statement);
        console.log(`✓ Statement ${i + 1} completed`);
      } catch (error) {
        // Some statements might fail if columns already exist - that's OK
        if (error.message.includes('duplicate column name') || 
            error.message.includes('already exists')) {
          console.log(`! Statement ${i + 1} skipped (already exists)`);
        } else {
          console.error(`✗ Statement ${i + 1} failed:`, error.message);
          // Continue with other statements
        }
      }
    }
    
    // Verify the migration
    console.log('\nVerifying migration...');
    
    // Check if new table exists
    const imageCount = await prisma.apartmentImage.count();
    console.log(`✓ ApartmentImage table exists with ${imageCount} records`);
    
    // Check apartments with mainImageUrl
    const apartmentsWithMainImage = await prisma.apartment.count({
      where: { mainImageUrl: { not: null } }
    });
    console.log(`✓ ${apartmentsWithMainImage} apartments have main images`);
    
    console.log('\n🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
runMigration();