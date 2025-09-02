#!/usr/bin/env node
/**
 * Import Optimization Checker
 * Identifies potential import optimizations in the codebase
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

// Patterns to check for optimization opportunities
const importPatterns = {
  // Barrel imports that could be optimized
  barrelImports: [
    { pattern: /import\s+\*\s+as\s+\w+\s+from\s+['"]lodash['"]/, name: 'lodash', suggestion: 'Use lodash-es or specific imports' },
    { pattern: /import\s+\{[^}]+\}\s+from\s+['"]lodash['"]/, name: 'lodash', suggestion: 'Use lodash/[method] imports' },
    { pattern: /import\s+moment\s+from\s+['"]moment['"]/, name: 'moment', suggestion: 'Use date-fns instead' },
    { pattern: /import\s+\*\s+as\s+React\s+from\s+['"]react['"]/, name: 'React namespace', suggestion: 'Use named imports for better tree shaking' },
  ],
  
  // Large library imports
  largeLibraries: [
    { pattern: /import\s+.+\s+from\s+['"]recharts['"]/, name: 'recharts', suggestion: 'Consider dynamic import for charts' },
    { pattern: /import\s+.+\s+from\s+['"]leaflet['"]/, name: 'leaflet', suggestion: 'Consider dynamic import for maps' },
    { pattern: /import\s+.+\s+from\s+['"]@sentry\//, name: 'sentry', suggestion: 'Ensure Sentry is tree-shaken in production' },
  ],
  
  // Side-effect imports
  sideEffects: [
    { pattern: /import\s+['"].*\.css['"]/, name: 'CSS imports', note: 'CSS imports are side-effects, ensure they are necessary' },
    { pattern: /import\s+['"][^'"]+['"];?\s*$/, name: 'Side-effect imports', note: 'Check if these imports have side-effects' },
  ],
};

async function checkImports() {
  console.log('🔍 Checking import statements for optimization opportunities...\n');
  
  const issues = {
    barrelImports: [],
    largeLibraries: [],
    sideEffects: [],
    dynamicImportCandidates: [],
  };
  
  // Get all TypeScript/JavaScript files
  const files = await getAllFiles(path.join(rootDir, 'src'), ['.ts', '.tsx', '.js', '.jsx']);
  
  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8');
    const relativePath = path.relative(rootDir, file);
    
    // Check barrel imports
    for (const { pattern, name, suggestion } of importPatterns.barrelImports) {
      if (pattern.test(content)) {
        issues.barrelImports.push({
          file: relativePath,
          import: name,
          suggestion,
          line: getLineNumber(content, pattern),
        });
      }
    }
    
    // Check large libraries
    for (const { pattern, name, suggestion } of importPatterns.largeLibraries) {
      if (pattern.test(content)) {
        // Check if it's already dynamically imported
        const isDynamic = /dynamic\(|import\(/.test(content);
        if (!isDynamic && shouldBeDynamic(file, name)) {
          issues.dynamicImportCandidates.push({
            file: relativePath,
            library: name,
            suggestion,
            line: getLineNumber(content, pattern),
          });
        }
      }
    }
    
    // Check side effects
    for (const { pattern, name, note } of importPatterns.sideEffects) {
      const matches = content.match(new RegExp(pattern, 'g'));
      if (matches) {
        for (const match of matches) {
          // Skip necessary side-effects
          if (!isNecessarySideEffect(match)) {
            issues.sideEffects.push({
              file: relativePath,
              import: match.trim(),
              type: name,
              note,
              line: getLineNumber(content, match),
            });
          }
        }
      }
    }
  }
  
  // Generate report
  generateImportReport(issues);
}

async function getAllFiles(dir, extensions) {
  const files = [];
  
  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      // Skip node_modules and build directories
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'dist') {
        continue;
      }
      
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (extensions.some(ext => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }
  
  await walk(dir);
  return files;
}

function getLineNumber(content, pattern) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (typeof pattern === 'string' ? lines[i].includes(pattern) : pattern.test(lines[i])) {
      return i + 1;
    }
  }
  return 0;
}

function shouldBeDynamic(file, library) {
  // Components that should use dynamic imports for heavy libraries
  const dynamicCandidates = {
    'recharts': ['Chart', 'Graph', 'Analytics'],
    'leaflet': ['Map', 'MapView', 'PropertyMap'],
    '@sentry': ['ErrorBoundary'],
  };
  
  const fileName = path.basename(file);
  const candidates = dynamicCandidates[library] || [];
  
  return candidates.some(candidate => fileName.includes(candidate));
}

function isNecessarySideEffect(importStatement) {
  // List of necessary side-effects
  const necessary = [
    'globals.css',
    'tailwind.css',
    'leaflet/dist/leaflet.css',
    'server-only',
  ];
  
  return necessary.some(n => importStatement.includes(n));
}

function generateImportReport(issues) {
  const totalIssues = 
    issues.barrelImports.length +
    issues.dynamicImportCandidates.length +
    issues.sideEffects.length;
  
  console.log(`📊 Import Analysis Summary`);
  console.log(`${'='.repeat(50)}\n`);
  
  console.log(`Total optimization opportunities found: ${totalIssues}\n`);
  
  // Barrel imports
  if (issues.barrelImports.length > 0) {
    console.log(`\n🔴 Barrel Imports (${issues.barrelImports.length})`);
    console.log('These imports could be optimized for better tree shaking:\n');
    issues.barrelImports.forEach(issue => {
      console.log(`  📁 ${issue.file}:${issue.line}`);
      console.log(`     Library: ${issue.import}`);
      console.log(`     💡 ${issue.suggestion}\n`);
    });
  }
  
  // Dynamic import candidates
  if (issues.dynamicImportCandidates.length > 0) {
    console.log(`\n🟡 Dynamic Import Candidates (${issues.dynamicImportCandidates.length})`);
    console.log('These large libraries could be dynamically imported:\n');
    issues.dynamicImportCandidates.forEach(issue => {
      console.log(`  📁 ${issue.file}:${issue.line}`);
      console.log(`     Library: ${issue.library}`);
      console.log(`     💡 ${issue.suggestion}\n`);
    });
  }
  
  // Side effects
  if (issues.sideEffects.length > 0) {
    console.log(`\n🟠 Side Effect Imports (${issues.sideEffects.length})`);
    console.log('Review these side-effect imports:\n');
    const grouped = issues.sideEffects.reduce((acc, issue) => {
      if (!acc[issue.file]) acc[issue.file] = [];
      acc[issue.file].push(issue);
      return acc;
    }, {});
    
    Object.entries(grouped).forEach(([file, fileIssues]) => {
      console.log(`  📁 ${file}`);
      fileIssues.forEach(issue => {
        console.log(`     Line ${issue.line}: ${issue.import}`);
      });
      console.log('');
    });
  }
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  console.log('1. Replace barrel imports with specific imports');
  console.log('2. Use dynamic imports for heavy components (maps, charts)');
  console.log('3. Review and remove unnecessary side-effect imports');
  console.log('4. Consider using import aliases for cleaner imports');
  console.log('5. Run "npm run analyze" to see bundle impact\n');
  
  // Save detailed report
  const reportPath = path.join(rootDir, 'import-optimization-report.json');
  fs.writeFile(reportPath, JSON.stringify(issues, null, 2))
    .then(() => console.log(`\n📄 Detailed report saved to: ${reportPath}`))
    .catch(console.error);
}

// Run the checker
checkImports().catch(console.error);