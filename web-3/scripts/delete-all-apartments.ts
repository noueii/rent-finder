#!/usr/bin/env tsx
/**
 * Script to delete all apartments from the database
 * Run with: npx tsx scripts/delete-all-apartments.ts
 * 
 * WARNING: This will permanently delete ALL apartments and related data!
 */

import { db } from '../src/server/db';
import readline from 'readline';

// Create readline interface for user confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function deleteAllApartments() {
  try {
    console.log('\n🚨 WARNING: This will delete ALL apartments from the database! 🚨\n');
    
    // Get current counts
    const apartmentCount = await prisma.apartment.count();
    const imageCount = await prisma.apartmentImage.count();
    const stationCount = await prisma.apartmentStation.count();
    const listItemCount = await prisma.listItem.count();
    
    console.log('Current database state:');
    console.log(`- Apartments: ${apartmentCount}`);
    console.log(`- Apartment Images: ${imageCount}`);
    console.log(`- Apartment Stations: ${stationCount}`);
    console.log(`- List Items: ${listItemCount}`);
    console.log('');
    
    if (apartmentCount === 0) {
      console.log('✅ No apartments to delete.');
      return;
    }
    
    // Ask for confirmation
    const answer = await askQuestion(`Are you sure you want to delete ${apartmentCount} apartments? Type 'yes' to confirm: `);
    
    if (answer.toLowerCase() !== 'yes') {
      console.log('\n❌ Deletion cancelled.');
      return;
    }
    
    // Double confirmation for safety
    const confirm = await askQuestion(`\nThis action cannot be undone. Type 'DELETE ALL' to confirm: `);
    
    if (confirm !== 'DELETE ALL') {
      console.log('\n❌ Deletion cancelled.');
      return;
    }
    
    console.log('\n🗑️  Starting deletion process...\n');
    
    // Delete in order to respect foreign key constraints
    // These will cascade delete due to the schema, but we'll be explicit
    
    // 1. Delete list items
    console.log('Deleting list items...');
    const deletedListItems = await prisma.listItem.deleteMany({});
    console.log(`✅ Deleted ${deletedListItems.count} list items`);
    
    // 2. Delete apartment stations
    console.log('Deleting apartment stations...');
    const deletedStations = await prisma.apartmentStation.deleteMany({});
    console.log(`✅ Deleted ${deletedStations.count} apartment stations`);
    
    // 3. Delete apartment images
    console.log('Deleting apartment images...');
    const deletedImages = await prisma.apartmentImage.deleteMany({});
    console.log(`✅ Deleted ${deletedImages.count} apartment images`);
    
    // 4. Delete all apartments
    console.log('Deleting apartments...');
    const deletedApartments = await prisma.apartment.deleteMany({});
    console.log(`✅ Deleted ${deletedApartments.count} apartments`);
    
    // Verify deletion
    const remainingCount = await prisma.apartment.count();
    if (remainingCount === 0) {
      console.log('\n✅ All apartments successfully deleted!');
    } else {
      console.log(`\n⚠️  Warning: ${remainingCount} apartments still remain in the database.`);
    }
    
    // Optional: Reset scraping source timestamps
    const resetTimestamps = await askQuestion('\nDo you want to reset scraping source timestamps? (y/n): ');
    
    if (resetTimestamps.toLowerCase() === 'y') {
      await prisma.scrapingSource.updateMany({
        data: {
          lastScrapedAt: null
        }
      });
      console.log('✅ Reset all scraping source timestamps');
    }
    
  } catch (error) {
    console.error('\n❌ Error deleting apartments:', error);
    process.exit(1);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

// Run the script
deleteAllApartments()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });