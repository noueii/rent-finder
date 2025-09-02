#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');

async function fixImportPaths() {
  console.log('🔧 Fixing import paths from @/ to ~/...\n');

  // Find all TypeScript and TSX files
  const files = await glob('src/**/*.{ts,tsx}', {
    cwd: ROOT_DIR,
    absolute: true,
    ignore: ['**/node_modules/**'],
  });

  let totalFixed = 0;
  const fixedFiles: string[] = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Check if file contains @/ imports
    if (!content.includes('@/')) {
      continue;
    }

    // Replace @/ with ~/
    const newContent = content.replace(/@\//g, '~/');
    
    // Count replacements
    const replacements = (content.match(/@\//g) || []).length;
    
    if (replacements > 0) {
      fs.writeFileSync(filePath, newContent, 'utf-8');
      const relativePath = path.relative(ROOT_DIR, filePath);
      console.log(`✅ Fixed ${replacements} import(s) in: ${relativePath}`);
      totalFixed += replacements;
      fixedFiles.push(relativePath);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Total files checked: ${files.length}`);
  console.log(`   Files modified: ${fixedFiles.length}`);
  console.log(`   Total imports fixed: ${totalFixed}`);
  
  if (fixedFiles.length > 0) {
    console.log('\n📝 Modified files:');
    fixedFiles.forEach(file => console.log(`   - ${file}`));
  }
}

// Run the script
fixImportPaths().catch(console.error);