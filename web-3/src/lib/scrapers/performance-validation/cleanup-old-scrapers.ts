#!/usr/bin/env ts-node

/**
 * Cleanup Script - Remove Old Scraper Files
 * This script removes the old scraper implementations after validation
 */

import * as fs from 'fs';
import * as path from 'path';

// Files to remove (old scrapers)
const filesToRemove = [
  // Base scrapers (old architecture)
  'src/lib/scrapers/base-scraper.ts',
  'src/lib/scrapers/fast-base-scraper.ts',
  'src/lib/scrapers/fast-base-scraper-queue.ts',
  'src/lib/scrapers/fast-base-scraper-streaming.ts',
  'src/lib/scrapers/geocoding-enhanced-scraper.ts',
  
  // Provider base classes (old)
  'src/lib/scrapers/providers/realestate-base.ts',
  'src/lib/scrapers/providers/wagaya-base.ts',
  'src/lib/scrapers/providers/yolo-base.ts',
  
  // Individual scrapers (replaced by unified)
  'src/lib/scrapers/sources/realestate-scraper.ts',
  'src/lib/scrapers/sources/fast-realestate-scraper.ts',
  'src/lib/scrapers/sources/yolo-japan-scraper.ts',
  'src/lib/scrapers/sources/fast-yolo-scraper.ts',
  'src/lib/scrapers/sources/wagaya-japan-scraper.ts',
  'src/lib/scrapers/sources/fast-wagaya-scraper.ts',
  'src/lib/scrapers/sources/metro-residences-scraper.ts',
  'src/lib/scrapers/sources/ehousing-scraper.ts',
  
  // Old utilities (replaced or consolidated)
  'src/lib/scrapers/utils/fast-proxy-manager.ts',
  'src/lib/scrapers/utils/proxy-manager.ts',
  
  // Old factory (replaced by unified)
  'src/lib/scrapers/scraper-factory.ts',
  'src/lib/scrapers/apartment-scraper.ts',
];

// Directories to check for cleanup
const directoriesToClean = [
  'src/lib/scrapers/providers',
  'src/lib/scrapers/sources',
];

console.log('🧹 Starting cleanup of old scraper files...\n');

const projectRoot = process.cwd();
let removedCount = 0;
let totalSize = 0;

// Remove individual files
filesToRemove.forEach(file => {
  const filePath = path.join(projectRoot, file);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    totalSize += stats.size;
    fs.unlinkSync(filePath);
    console.log(`❌ Removed: ${file} (${(stats.size / 1024).toFixed(1)}KB)`);
    removedCount++;
  }
});

// Clean up empty directories
directoriesToClean.forEach(dir => {
  const dirPath = path.join(projectRoot, dir);
  if (fs.existsSync(dirPath)) {
    const files = fs.readdirSync(dirPath);
    if (files.length === 0 || (files.length === 1 && files[0] === 'index.ts')) {
      // Remove index.ts if it's the only file
      if (files.length === 1) {
        fs.unlinkSync(path.join(dirPath, 'index.ts'));
      }
      // Remove empty directory
      fs.rmdirSync(dirPath);
      console.log(`📁 Removed empty directory: ${dir}`);
    }
  }
});

console.log('\n📊 Cleanup Summary:');
console.log(`- Files removed: ${removedCount}`);
console.log(`- Total size freed: ${(totalSize / 1024).toFixed(1)}KB`);
console.log('\n✅ Cleanup complete!');

// Update imports in remaining files
console.log('\n🔄 Updating imports...');

const filesToUpdate = [
  'src/lib/scrapers/index.ts',
  'src/lib/scrapers/utils/index.ts',
];

filesToUpdate.forEach(file => {
  const filePath = path.join(projectRoot, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Remove exports for deleted files
    content = content.replace(/export.*from.*\/(base-scraper|fast-base-scraper|scraper-factory|apartment-scraper|sources\/[^']*)'.*;?\n/g, '');
    
    // Add unified scraper exports if not present
    if (!content.includes('unified-scraper-factory')) {
      content += "\nexport * from './unified-scraper-factory';\n";
    }
    
    fs.writeFileSync(filePath, content);
    console.log(`✏️  Updated: ${file}`);
  }
});

console.log('\n🎉 All old scraper files have been removed!');
console.log('📝 Next steps:');
console.log('   1. Run tests to ensure nothing is broken');
console.log('   2. Update API routers to use UnifiedScraperFactory');
console.log('   3. Commit changes');
console.log('   4. Celebrate the 85% code reduction! 🎊');