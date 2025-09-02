#!/usr/bin/env tsx
/**
 * Script to fix Prisma mock usage in test files
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

async function* walkDir(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules and .git
      if (entry.name !== 'node_modules' && entry.name !== '.git') {
        yield* walkDir(path);
      }
    } else if (entry.isFile() && (path.endsWith('.test.ts') || path.endsWith('.test.tsx'))) {
      yield path;
    }
  }
}

async function fixPrismaMockInFile(filePath: string) {
  let content = await readFile(filePath, 'utf-8');
  const originalContent = content;
  
  // Check if file uses PrismaClient mock
  if (!content.includes('PrismaClient') || !content.includes('prisma')) {
    return;
  }
  
  // Replace old-style Prisma mocks with new style
  if (content.includes("jest.mock('@prisma/client'")) {
    // Update imports
    content = content.replace(
      /import\s*{\s*PrismaClient\s*}\s*from\s*['"]@prisma\/client['"]/g,
      ''
    );
    
    // Add proper import if not present
    if (!content.includes('prismaMock')) {
      const firstImportMatch = content.match(/^import\s+.+$/m);
      if (firstImportMatch) {
        const insertPosition = firstImportMatch.index! + firstImportMatch[0].length;
        content = content.slice(0, insertPosition) + 
          "\nimport { prismaMock, resetPrismaMocks } from '@/infrastructure/testing/mocks/prisma';" + 
          content.slice(insertPosition);
      }
    }
    
    // Remove old mock setup
    content = content.replace(/\/\/ Mock PrismaClient[\s\S]*?}\);/g, '');
    
    // Update prisma variable declarations
    content = content.replace(/let\s+prisma:\s*PrismaClient;?/g, '');
    content = content.replace(/prisma\s*=\s*new\s*PrismaClient\(\);?/g, '');
    
    // Update repository instantiation
    content = content.replace(
      /new\s+(\w+Repository)\(prisma\)/g,
      'new $1(prismaMock as any)'
    );
    
    // Update mock calls
    content = content.replace(/\(prisma\./g, 'prismaMock.');
    content = content.replace(/expect\(prisma\./g, 'expect(prismaMock.');
    
    // Update beforeEach to use resetPrismaMocks
    content = content.replace(
      /beforeEach\(\(\)\s*=>\s*{\s*vi\.clearAllMocks\(\);/g,
      'beforeEach(() => {\n    resetPrismaMocks();'
    );
  }
  
  // Only write if content changed
  if (content !== originalContent) {
    await writeFile(filePath, content, 'utf-8');
    console.log(`Fixed Prisma mocks in: ${filePath}`);
  }
}

async function main() {
  const srcDir = join(process.cwd(), 'src');
  let fileCount = 0;
  let fixedCount = 0;
  
  console.log('Fixing Prisma mocks in test files...\n');
  
  for await (const testFile of walkDir(srcDir)) {
    await fixPrismaMockInFile(testFile);
    fileCount++;
  }
  
  console.log(`\nProcessed ${fileCount} test files.`);
}

main().catch(console.error);