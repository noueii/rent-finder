#!/usr/bin/env ts-node

/**
 * Migration script to update all imports and usages from old scrapers to unified scrapers
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

// Old scraper imports to replace
const OLD_IMPORTS = [
  // Factory imports
  { 
    old: /from\s+['"].*scraper-factory['"]/g,
    new: "from '~/lib/scrapers/unified-scraper-factory'"
  },
  { 
    old: /import\s+\{\s*ScraperFactory\s*\}\s+from/g,
    new: "import { UnifiedScraperFactory } from"
  },
  
  // Individual scraper imports
  {
    old: /from\s+['"].*\/scrapers\/sources\/realestate-scraper['"]/g,
    new: "from '~/infrastructure/scrapers/implementations/realestate-unified-scraper'"
  },
  {
    old: /from\s+['"].*\/scrapers\/sources\/fast-realestate-scraper['"]/g,
    new: "from '~/infrastructure/scrapers/implementations/realestate-unified-scraper'"
  },
  {
    old: /from\s+['"].*\/scrapers\/sources\/yolo-japan-scraper['"]/g,
    new: "from '~/infrastructure/scrapers/implementations/yolo-unified-scraper'"
  },
  {
    old: /from\s+['"].*\/scrapers\/sources\/fast-yolo-scraper['"]/g,
    new: "from '~/infrastructure/scrapers/implementations/yolo-unified-scraper'"
  },
  {
    old: /from\s+['"].*\/scrapers\/sources\/wagaya-japan-scraper['"]/g,
    new: "from '~/infrastructure/scrapers/implementations/wagaya-unified-scraper'"
  },
  {
    old: /from\s+['"].*\/scrapers\/sources\/fast-wagaya-scraper['"]/g,
    new: "from '~/infrastructure/scrapers/implementations/wagaya-unified-scraper'"
  },
  {
    old: /from\s+['"].*\/scrapers\/sources\/metro-residences-scraper['"]/g,
    new: "from '~/infrastructure/scrapers/implementations/metro-residences-unified-scraper'"
  },
  
  // Class name replacements
  {
    old: /\bRealEstateScraper\b/g,
    new: 'UnifiedRealEstateScraper'
  },
  {
    old: /\bFastRealEstateScraper\b/g,
    new: 'UnifiedRealEstateScraper'
  },
  {
    old: /\bYoloJapanScraper\b/g,
    new: 'UnifiedYoloJapanScraper'
  },
  {
    old: /\bFastYoloJapanScraper\b/g,
    new: 'UnifiedYoloJapanScraper'
  },
  {
    old: /\bWagayaJapanScraper\b/g,
    new: 'UnifiedWagayaJapanScraper'
  },
  {
    old: /\bFastWagayaScraper\b/g,
    new: 'UnifiedWagayaJapanScraper'
  },
  {
    old: /\bMetroResidencesScraper\b/g,
    new: 'UnifiedMetroResidencesScraper'
  },
  
  // Factory usage replacements
  {
    old: /\bScraperFactory\b/g,
    new: 'UnifiedScraperFactory'
  }
];

// Code pattern replacements
const CODE_PATTERNS = [
  // Factory method calls with mode parameter
  {
    old: /ScraperFactory\.(create|getScraper)\s*\(\s*['"]([^'"]+)['"]\s*,\s*([^,)]+)\s*,\s*['"]fast['"]\s*\)/g,
    new: 'UnifiedScraperFactory.$1(\'$2\', { ...$3, mode: \'fast\' })'
  },
  {
    old: /ScraperFactory\.(create|getScraper)\s*\(\s*['"]([^'"]+)['"]\s*,\s*([^,)]+)\s*,\s*['"]normal['"]\s*\)/g,
    new: 'UnifiedScraperFactory.$1(\'$2\', { ...$3, mode: \'normal\' })'
  },
  
  // Direct instantiation patterns
  {
    old: /new\s+FastRealEstateScraper\s*\(/g,
    new: 'new UnifiedRealEstateScraper({ mode: \'fast\' }'
  },
  {
    old: /new\s+FastYoloJapanScraper\s*\(/g,
    new: 'new UnifiedYoloJapanScraper({ mode: \'fast\' }'
  },
  {
    old: /new\s+FastWagayaScraper\s*\(/g,
    new: 'new UnifiedWagayaJapanScraper({ mode: \'fast\' }'
  }
];

// Files to skip
const SKIP_FILES = [
  'migrate-to-unified-scrapers.ts',
  'unified-scraper-factory.ts',
  'realestate-unified-scraper.ts',
  'yolo-unified-scraper.ts',
  'wagaya-unified-scraper.ts',
  'metro-residences-unified-scraper.ts',
  'unified-scraper.ts'
];

// Directories to process
const DIRECTORIES_TO_PROCESS = [
  'src',
  'scripts',
  'test'
];

function shouldProcessFile(filePath: string): boolean {
  const fileName = filePath.split('/').pop() || '';
  
  // Skip if in skip list
  if (SKIP_FILES.includes(fileName)) {
    return false;
  }
  
  // Only process TypeScript and JavaScript files
  const ext = extname(filePath);
  if (!['.ts', '.tsx', '.js', '.jsx', '.mjs'].includes(ext)) {
    return false;
  }
  
  // Skip node_modules and other build directories
  if (filePath.includes('node_modules') || 
      filePath.includes('.next') || 
      filePath.includes('dist') ||
      filePath.includes('build')) {
    return false;
  }
  
  return true;
}

function processFile(filePath: string): boolean {
  if (!shouldProcessFile(filePath)) {
    return false;
  }
  
  try {
    let content = readFileSync(filePath, 'utf-8');
    let modified = false;
    
    // Apply import replacements
    for (const { old, new: replacement } of OLD_IMPORTS) {
      const newContent = content.replace(old, replacement);
      if (newContent !== content) {
        content = newContent;
        modified = true;
      }
    }
    
    // Apply code pattern replacements
    for (const { old, new: replacement } of CODE_PATTERNS) {
      const newContent = content.replace(old, replacement);
      if (newContent !== content) {
        content = newContent;
        modified = true;
      }
    }
    
    if (modified) {
      writeFileSync(filePath, content);
      console.log(`✅ Updated: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error);
    return false;
  }
}

function processDirectory(dirPath: string): { processed: number; updated: number } {
  let processed = 0;
  let updated = 0;
  
  try {
    const entries = readdirSync(dirPath);
    
    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        const result = processDirectory(fullPath);
        processed += result.processed;
        updated += result.updated;
      } else if (stat.isFile()) {
        processed++;
        if (processFile(fullPath)) {
          updated++;
        }
      }
    }
  } catch (error) {
    console.error(`Error processing directory ${dirPath}:`, error);
  }
  
  return { processed, updated };
}

// Main execution
console.log('🔄 Starting migration to unified scrapers...\n');

let totalProcessed = 0;
let totalUpdated = 0;

for (const dir of DIRECTORIES_TO_PROCESS) {
  const dirPath = join(process.cwd(), dir);
  
  try {
    if (statSync(dirPath).isDirectory()) {
      console.log(`📁 Processing directory: ${dir}`);
      const result = processDirectory(dirPath);
      totalProcessed += result.processed;
      totalUpdated += result.updated;
      console.log(`   Processed: ${result.processed} files, Updated: ${result.updated} files\n`);
    }
  } catch (error) {
    console.log(`   Directory ${dir} not found, skipping...\n`);
  }
}

console.log('✨ Migration complete!');
console.log(`   Total files processed: ${totalProcessed}`);
console.log(`   Total files updated: ${totalUpdated}`);

// Generate summary report
const reportPath = join(process.cwd(), 'migration-report.md');
const report = `# Unified Scraper Migration Report

## Summary
- **Date**: ${new Date().toISOString()}
- **Files Processed**: ${totalProcessed}
- **Files Updated**: ${totalUpdated}

## Changes Applied

### Import Updates
- Replaced ScraperFactory with UnifiedScraperFactory
- Updated all scraper imports to use unified implementations
- Removed fast scraper variant imports

### Code Updates
- Updated class names to unified versions
- Modified factory method calls to use new configuration pattern
- Added mode parameter to configuration objects

## Next Steps

1. Run tests to ensure everything works correctly
2. Remove old scraper files:
   - src/lib/scrapers/sources/realestate-scraper.ts
   - src/lib/scrapers/sources/fast-realestate-scraper.ts
   - src/lib/scrapers/sources/yolo-japan-scraper.ts
   - src/lib/scrapers/sources/fast-yolo-scraper.ts
   - src/lib/scrapers/sources/wagaya-japan-scraper.ts
   - src/lib/scrapers/sources/fast-wagaya-scraper.ts
   - src/lib/scrapers/sources/metro-residences-scraper.ts
   
3. Remove old scraper factory:
   - src/lib/scrapers/scraper-factory.ts

4. Update any remaining references in configuration files
`;

writeFileSync(reportPath, report);
console.log(`\n📄 Migration report saved to: ${reportPath}`);