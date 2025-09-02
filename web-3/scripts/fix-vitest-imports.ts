#!/usr/bin/env tsx
/**
 * Script to fix vitest imports and replace with Jest equivalents
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

async function fixTestFile(filePath: string) {
  let content = await readFile(filePath, 'utf-8');
  const originalContent = content;
  
  // Replace vitest imports with jest imports
  content = content.replace(
    /import\s*{\s*([^}]+)\s*}\s*from\s*['"]vitest['"]/g,
    (match, imports) => {
      // Check which imports are used
      const importList = imports.split(',').map((s: string) => s.trim());
      const jestImports: string[] = [];
      const customImports: string[] = [];
      
      importList.forEach((imp: string) => {
        if (['describe', 'it', 'expect', 'beforeAll', 'afterAll', 'beforeEach', 'afterEach', 'test'].includes(imp)) {
          jestImports.push(imp);
        } else if (imp === 'vi') {
          customImports.push('vi');
        }
      });
      
      let result = '';
      if (jestImports.length > 0) {
        result += `import { ${jestImports.join(', ')}, jest } from '@jest/globals'`;
      }
      if (customImports.includes('vi')) {
        if (result) result += ';\n';
        result += `import { vi } from '@/core/testing'`;
      }
      
      return result;
    }
  );
  
  // If file still has vi imports but no import statement, add it
  if (content.includes('vi.') && !content.includes("import { vi }") && !content.includes("from '@/core/testing'")) {
    // Add import at the top after other imports
    const firstImportMatch = content.match(/^import\s+.+$/m);
    if (firstImportMatch) {
      const insertPosition = firstImportMatch.index! + firstImportMatch[0].length;
      content = content.slice(0, insertPosition) + "\nimport { vi } from '@/core/testing';" + content.slice(insertPosition);
    }
  }
  
  // Fix jest.mock calls if any
  content = content.replace(/vi\.mock\(/g, 'jest.mock(');
  
  // Only write if content changed
  if (content !== originalContent) {
    await writeFile(filePath, content, 'utf-8');
    console.log(`Fixed: ${filePath}`);
  }
}

async function main() {
  const srcDir = join(process.cwd(), 'src');
  let fileCount = 0;
  
  console.log('Fixing vitest imports in test files...\n');
  
  for await (const testFile of walkDir(srcDir)) {
    await fixTestFile(testFile);
    fileCount++;
  }
  
  console.log(`\nProcessed ${fileCount} test files.`);
}

main().catch(console.error);