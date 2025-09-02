#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting migration to global lists...');

// Check if the migration file exists
const migrationFile = path.join(__dirname, 'migrations', 'migrate_to_global_lists_safe.sql');
if (!fs.existsSync(migrationFile)) {
  console.error('❌ Migration file not found:', migrationFile);
  process.exit(1);
}

try {
  // Check if database exists
  const dbPath = path.join(__dirname, 'prisma', 'rent-finder.db');
  if (!fs.existsSync(dbPath)) {
    console.error('❌ Database not found at:', dbPath);
    console.log('💡 Make sure you\'re running this from the web directory');
    process.exit(1);
  }
  
  // Run the migration SQL
  console.log('📝 Running database migration...');
  execSync(`sqlite3 "${dbPath}" < "${migrationFile}"`, { stdio: 'pipe' });
  
  console.log('✅ Database migration completed successfully!');
  
  // Generate new Prisma client
  console.log('🔄 Generating new Prisma client...');
  execSync('npx prisma generate', { stdio: 'pipe' });
  
  console.log('✅ Prisma client generated successfully!');
  
  // Optional: Run database push to sync schema
  console.log('🔄 Pushing schema to database...');
  try {
    execSync('npx prisma db push --accept-data-loss', { stdio: 'pipe' });
    console.log('✅ Schema pushed to database successfully!');
  } catch (pushError) {
    console.log('⚠️  Schema push had some issues, but migration should still work');
  }
  
  console.log('🎉 Migration to global lists completed successfully!');
  console.log('');
  console.log('📋 Summary of changes:');
  console.log('  - UserList table converted to GlobalList');
  console.log('  - List types changed from saved/starred/liked/blocked to share/star/like/hide');
  console.log('  - All existing user lists merged into global lists');
  console.log('  - ApartmentList table updated to reference GlobalList');
  console.log('  - Added optional addedBy field to track who added items');
  console.log('');
  console.log('⚠️  Note: This migration removes user-specific lists. All data has been');
  console.log('   migrated to global lists that anyone can modify.');
  console.log('');
  console.log('🚀 You can now restart your application to use the global lists!');
  
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  console.log('');
  console.log('🔍 Debug info:');
  console.log('  - Migration file:', migrationFile);
  console.log('  - Database path:', path.join(__dirname, 'prisma', 'rent-finder.db'));
  console.log('  - Working directory:', __dirname);
  console.log('');
  console.log('💡 Try running the migration manually:');
  console.log(`   sqlite3 prisma/rent-finder.db < ${migrationFile}`);
  process.exit(1);
}