#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🚀 Completing migration setup...');

try {
  // Step 1: Ensure GlobalList has the correct data
  console.log('📝 Ensuring GlobalList has correct entries...');
  
  const seedQuery = `
    INSERT OR IGNORE INTO "GlobalList" ("id", "name", "type", "description", "createdAt", "updatedAt")
    VALUES 
        ('gl_share_default', 'Shared Apartments', 'share', 'Apartments shared by the community', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('gl_like_default', 'Liked Apartments', 'like', 'Apartments liked by the community', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('gl_hide_default', 'Hidden Apartments', 'hide', 'Apartments hidden from view', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('gl_star_default', 'Starred Apartments', 'star', 'Apartments starred by the community', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  `;
  
  execSync(`sqlite3 prisma/rent-finder.db "${seedQuery}"`, { stdio: 'inherit' });
  
  // Step 2: Verify the current structure
  console.log('📊 Verifying current database structure...');
  
  const checkQuery = `
    SELECT 
        type, 
        name, 
        description,
        (SELECT COUNT(*) FROM ApartmentList WHERE listId = GlobalList.id) as apartment_count
    FROM GlobalList 
    ORDER BY type;
  `;
  
  const result = execSync(`sqlite3 prisma/rent-finder.db "${checkQuery}"`, { encoding: 'utf8' });
  console.log('Current GlobalList status:');
  console.log(result);
  
  // Step 3: Generate Prisma client
  console.log('🔄 Generating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit' });
  
  // Step 4: Push schema changes
  console.log('📤 Pushing schema to database...');
  execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
  
  console.log('✅ Migration completed successfully!');
  console.log('');
  console.log('🎉 Your database is now ready with global lists:');
  console.log('  - share: Shared Apartments');
  console.log('  - like: Liked Apartments');
  console.log('  - hide: Hidden Apartments');
  console.log('  - star: Starred Apartments');
  console.log('');
  console.log('🚀 You can now start the application!');
  
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
}