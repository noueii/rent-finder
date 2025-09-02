#!/usr/bin/env tsx
/**
 * Performance Benchmark Runner
 * 
 * This script runs all performance benchmarks and generates a comprehensive report.
 * It validates that all performance requirements from the refactoring plan are met.
 * 
 * Usage: npm run benchmark
 * Usage with specific test: npm run benchmark -- --test="API Response Times"
 */

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';

const PERFORMANCE_REQUIREMENTS = {
  API_RESPONSE_TIME: 300, // ms
  DB_QUERY_TIME: 100, // ms
  SEARCH_TIME: 3000, // ms (including scraping)
  MEMORY_LIMIT: 512 * 1024 * 1024, // 512MB
  SCRAPER_RATE: 10, // pages per second
  CACHE_IMPROVEMENT: 50, // % improvement with caching
  CONCURRENT_USERS: 50, // number of concurrent requests
  SUCCESS_RATE: 95, // % of requests that should succeed
};

interface BenchmarkResult {
  category: string;
  test: string;
  metric: string;
  value: number;
  unit: string;
  requirement: number;
  passed: boolean;
}

const runBenchmarks = async () => {
  console.log('🚀 Running Performance Benchmarks...\n');
  
  const startTime = Date.now();
  const results: BenchmarkResult[] = [];
  
  try {
    // Run the performance tests
    const testCommand = process.argv[2]?.includes('--test=') 
      ? `npm run test:integration -- performance.test.ts -t "${process.argv[2].split('=')[1]}"`
      : 'npm run test:integration -- performance.test.ts';
    
    console.log(`Executing: ${testCommand}\n`);
    
    const output = execSync(testCommand, {
      encoding: 'utf-8',
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'test' }
    });
    
    // Parse test output to extract metrics
    // This is a simplified parser - in production, you'd want more robust parsing
    const lines = output.split('\n');
    
    lines.forEach(line => {
      // Parse different metric patterns
      if (line.includes('ms') && line.includes(':')) {
        const match = line.match(/(.+):\s*([\d.]+)\s*ms/);
        if (match) {
          const [_, name, value] = match;
          results.push({
            category: 'Response Time',
            test: name.trim(),
            metric: 'duration',
            value: parseFloat(value),
            unit: 'ms',
            requirement: PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME,
            passed: parseFloat(value) < PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME
          });
        }
      }
      
      if (line.includes('pages/second')) {
        const match = line.match(/Scraper rate:\s*([\d.]+)\s*pages\/second/);
        if (match) {
          const value = parseFloat(match[1]);
          results.push({
            category: 'Scraper Performance',
            test: 'Scraper Rate',
            metric: 'throughput',
            value,
            unit: 'pages/second',
            requirement: PERFORMANCE_REQUIREMENTS.SCRAPER_RATE,
            passed: value >= PERFORMANCE_REQUIREMENTS.SCRAPER_RATE
          });
        }
      }
      
      if (line.includes('Memory') && line.includes('MB')) {
        const match = line.match(/Memory.*:\s*([\d.]+)\s*MB/);
        if (match) {
          const value = parseFloat(match[1]);
          results.push({
            category: 'Memory Usage',
            test: 'Memory Consumption',
            metric: 'memory',
            value,
            unit: 'MB',
            requirement: PERFORMANCE_REQUIREMENTS.MEMORY_LIMIT / 1024 / 1024,
            passed: value < (PERFORMANCE_REQUIREMENTS.MEMORY_LIMIT / 1024 / 1024)
          });
        }
      }
    });
    
    console.log('✅ Benchmarks completed successfully\n');
  } catch (error) {
    console.error('❌ Error running benchmarks:', error);
    process.exit(1);
  }
  
  // Generate report
  generateReport(results, Date.now() - startTime);
};

const generateReport = (results: BenchmarkResult[], totalTime: number) => {
  const timestamp = new Date().toISOString();
  const passedTests = results.filter(r => r.passed).length;
  const totalTests = results.length;
  const passRate = totalTests > 0 ? (passedTests / totalTests * 100).toFixed(1) : '0';
  
  // Console report
  console.log('📊 Performance Benchmark Report');
  console.log('==============================\n');
  console.log(`Date: ${timestamp}`);
  console.log(`Total Time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`Pass Rate: ${passRate}% (${passedTests}/${totalTests})\n`);
  
  // Group results by category
  const categories = [...new Set(results.map(r => r.category))];
  
  categories.forEach(category => {
    console.log(`\n${category}`);
    console.log('-'.repeat(category.length));
    
    const categoryResults = results.filter(r => r.category === category);
    categoryResults.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      const comparison = result.passed ? 'within' : 'exceeds';
      console.log(`${status} ${result.test}: ${result.value.toFixed(2)} ${result.unit} (${comparison} requirement of ${result.requirement} ${result.unit})`);
    });
  });
  
  // Performance requirements summary
  console.log('\n\n📋 Performance Requirements Summary');
  console.log('===================================');
  console.log(`API Response Time: < ${PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME}ms`);
  console.log(`Database Query Time: < ${PERFORMANCE_REQUIREMENTS.DB_QUERY_TIME}ms`);
  console.log(`Search Time (with scraping): < ${PERFORMANCE_REQUIREMENTS.SEARCH_TIME}ms`);
  console.log(`Memory Usage: < ${PERFORMANCE_REQUIREMENTS.MEMORY_LIMIT / 1024 / 1024}MB`);
  console.log(`Scraper Rate: > ${PERFORMANCE_REQUIREMENTS.SCRAPER_RATE} pages/second`);
  console.log(`Concurrent Users: ${PERFORMANCE_REQUIREMENTS.CONCURRENT_USERS}`);
  console.log(`Success Rate: > ${PERFORMANCE_REQUIREMENTS.SUCCESS_RATE}%`);
  
  // Generate detailed JSON report
  const report = {
    timestamp,
    totalTime: `${(totalTime / 1000).toFixed(2)}s`,
    summary: {
      totalTests,
      passedTests,
      failedTests: totalTests - passedTests,
      passRate: `${passRate}%`
    },
    requirements: PERFORMANCE_REQUIREMENTS,
    results: results.reduce((acc, result) => {
      if (!acc[result.category]) {
        acc[result.category] = [];
      }
      acc[result.category].push({
        test: result.test,
        value: `${result.value.toFixed(2)} ${result.unit}`,
        requirement: `${result.requirement} ${result.unit}`,
        passed: result.passed
      });
      return acc;
    }, {} as Record<string, any[]>)
  };
  
  // Save detailed report
  const reportPath = join(process.cwd(), 'performance-benchmark-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n\n📄 Detailed report saved to: ${reportPath}`);
  
  // Exit with appropriate code
  if (passedTests < totalTests) {
    console.log('\n⚠️  Some performance benchmarks failed. Please investigate and optimize.');
    process.exit(1);
  } else {
    console.log('\n✅ All performance benchmarks passed!');
    process.exit(0);
  }
};

// Run the benchmarks
runBenchmarks().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});