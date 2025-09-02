#!/usr/bin/env ts-node

/**
 * Performance Validation Runner
 * Executes performance benchmarks and generates report
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

console.log('🚀 Starting Performance Validation...\n');

// Check if we're in the right directory
const projectRoot = process.cwd();
if (!fs.existsSync(path.join(projectRoot, 'package.json'))) {
  console.error('❌ Error: Must be run from project root directory');
  process.exit(1);
}

try {
  // Run Jest performance tests
  console.log('📊 Running performance test suite...\n');
  execSync('npm test -- --testPathPattern=performance-validation.test.ts --verbose', {
    stdio: 'inherit',
    cwd: projectRoot
  });

  // Run detailed benchmark if tests pass
  console.log('\n📈 Running detailed benchmarks...\n');
  execSync('npx ts-node src/lib/scrapers/performance-validation/performance-benchmark.ts', {
    stdio: 'inherit',
    cwd: projectRoot
  });

  // Check if report was generated
  const reportPath = path.join(projectRoot, 'docs/refactoring/scraper-performance-report.md');
  if (fs.existsSync(reportPath)) {
    console.log('\n✅ Performance validation complete!');
    console.log(`📄 Report available at: ${reportPath}`);
    
    // Show summary
    const report = fs.readFileSync(reportPath, 'utf-8');
    const summaryMatch = report.match(/📈 SUMMARY[\s\S]*?(?=\n\n)/);
    if (summaryMatch) {
      console.log('\n' + summaryMatch[0]);
    }
  } else {
    console.log('\n⚠️  Performance validation completed but no report was generated');
  }
} catch (error) {
  console.error('\n❌ Performance validation failed:', error);
  process.exit(1);
}

console.log('\n🎉 All done!');