/**
 * Main Benchmark Runner
 * Executes all performance benchmarks and generates a comprehensive report
 */

import { runApiBenchmarks } from './api-benchmarks';
import { runDatabaseBenchmarks } from './database-benchmarks';
import { runSearchBenchmarks } from './search-benchmarks';
import { runScraperBenchmarks } from './scraper-benchmarks';
import { getMemoryUsage } from './utils';

export * from './utils';
export { runApiBenchmarks } from './api-benchmarks';
export { runDatabaseBenchmarks } from './database-benchmarks';
export { runSearchBenchmarks } from './search-benchmarks';
export { runScraperBenchmarks } from './scraper-benchmarks';

interface BenchmarkOptions {
  api?: boolean;
  database?: boolean;
  search?: boolean;
  scraper?: boolean;
}

/**
 * Run all or selected benchmarks
 */
export async function runBenchmarks(options?: BenchmarkOptions): Promise<void> {
  const {
    api = true,
    database = true,
    search = true,
    scraper = true,
  } = options || {};
  
  console.log('🚀 Tokyo Apartment Finder - Performance Benchmarks\n');
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('Node version:', process.version);
  console.log('Platform:', process.platform);
  console.log('Memory:', getMemoryUsage());
  console.log('Timestamp:', new Date().toISOString());
  console.log('\n' + '='.repeat(60) + '\n');
  
  const startTime = Date.now();
  
  try {
    // Run API benchmarks
    if (api) {
      await runApiBenchmarks();
      console.log('\n' + '-'.repeat(60) + '\n');
    }
    
    // Run database benchmarks
    if (database) {
      await runDatabaseBenchmarks();
      console.log('\n' + '-'.repeat(60) + '\n');
    }
    
    // Run search benchmarks
    if (search) {
      await runSearchBenchmarks();
      console.log('\n' + '-'.repeat(60) + '\n');
    }
    
    // Run scraper benchmarks
    if (scraper) {
      await runScraperBenchmarks();
      console.log('\n' + '-'.repeat(60) + '\n');
    }
    
    const totalTime = Date.now() - startTime;
    
    console.log('\n✅ All benchmarks completed successfully!');
    console.log(`Total execution time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log('Final memory usage:', getMemoryUsage());
    
  } catch (error) {
    console.error('\n❌ Benchmark execution failed:');
    console.error(error);
    process.exit(1);
  }
}

// Command-line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: tsx src/infrastructure/benchmarks/index.ts [options]

Options:
  --all        Run all benchmarks (default)
  --api        Run only API benchmarks
  --database   Run only database benchmarks
  --search     Run only search benchmarks
  --scraper    Run only scraper benchmarks
  --help, -h   Show this help message

Examples:
  # Run all benchmarks
  tsx src/infrastructure/benchmarks/index.ts

  # Run only API and database benchmarks
  tsx src/infrastructure/benchmarks/index.ts --api --database

  # Run a single benchmark type
  tsx src/infrastructure/benchmarks/index.ts --search
    `);
    process.exit(0);
  }
  
  const options: BenchmarkOptions = {};
  
  if (args.length === 0 || args.includes('--all')) {
    // Run all benchmarks by default
  } else {
    // Only run specified benchmarks
    options.api = args.includes('--api');
    options.database = args.includes('--database');
    options.search = args.includes('--search');
    options.scraper = args.includes('--scraper');
  }
  
  runBenchmarks(options).catch(error => {
    console.error('Benchmark runner failed:', error);
    process.exit(1);
  });
}