#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('🔍 Checking current database state...');

try {
  // Check if tables exist
  const checkTablesQuery = `
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name IN ('UserList', 'GlobalList', 'ApartmentList')
    ORDER BY name;
  `;
  
  const result = execSync(`sqlite3 prisma/rent-finder.db "${checkTablesQuery}"`, { encoding: 'utf8' });
  const tables = result.trim().split('\n').filter(t => t);
  
  console.log('📊 Existing tables:', tables.join(', '));
  
  // Check UserList structure if it exists
  if (tables.includes('UserList')) {
    console.log('\n📋 UserList types:');
    const userListQuery = `SELECT type, COUNT(*) as count FROM UserList GROUP BY type;`;
    const userListResult = execSync(`sqlite3 prisma/rent-finder.db "${userListQuery}"`, { encoding: 'utf8' });
    console.log(userListResult.trim());
  }
  
  // Check GlobalList structure if it exists
  if (tables.includes('GlobalList')) {
    console.log('\n📋 GlobalList types:');
    const globalListQuery = `SELECT type, COUNT(*) as count FROM GlobalList GROUP BY type;`;
    const globalListResult = execSync(`sqlite3 prisma/rent-finder.db "${globalListQuery}"`, { encoding: 'utf8' });
    console.log(globalListResult.trim());
  }
  
  // Check ApartmentList count if it exists
  if (tables.includes('ApartmentList')) {
    console.log('\n📋 ApartmentList entries:');
    const apartmentListQuery = `SELECT COUNT(*) FROM ApartmentList;`;
    const apartmentListResult = execSync(`sqlite3 prisma/rent-finder.db "${apartmentListQuery}"`, { encoding: 'utf8' });
    console.log(`Total entries: ${apartmentListResult.trim()}`);
  }
  
  // Migration recommendations
  console.log('\n💡 Migration recommendations:');
  
  if (tables.includes('UserList') && !tables.includes('GlobalList')) {
    console.log('  ✨ Ready for migration: UserList exists, GlobalList doesn\'t');
    console.log('  ➡️  Run: ./migrate-to-global-lists.js');
  } else if (tables.includes('GlobalList') && !tables.includes('UserList')) {
    console.log('  ✅ Already migrated: GlobalList exists, UserList doesn\'t');
    console.log('  ➡️  No migration needed');
  } else if (tables.includes('UserList') && tables.includes('GlobalList')) {
    console.log('  ⚠️  Both tables exist: Partial migration state');
    console.log('  ➡️  Run: ./migrate-to-global-lists.js (safe to run)');
  } else {
    console.log('  🆕 Fresh database: No user lists found');
    console.log('  ➡️  Run: ./migrate-to-global-lists.js to create default lists');
  }
  
} catch (error) {
  console.error('❌ Error checking database:', error.message);
  process.exit(1);
}