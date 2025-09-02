#!/usr/bin/env tsx

import { performance } from 'perf_hooks';
import { PrismaClient } from '@prisma/client';
import { transitService } from '../src/services/transit-service';
import { cacheService } from '../src/lib/cache';

const db = new PrismaClient();

interface TestResult {
  name: string;
  duration: number;
  success: boolean;
  error?: string;
}

class PerformanceTester {
  private results: TestResult[] = [];

  async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    console.log(`Running test: ${name}`);
    const start = performance.now();
    
    try {
      await testFn();
      const duration = performance.now() - start;
      this.results.push({
        name,
        duration,
        success: true,
      });
      console.log(`✅ ${name}: ${duration.toFixed(2)}ms`);
    } catch (error) {
      const duration = performance.now() - start;
      this.results.push({
        name,
        duration,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      console.log(`❌ ${name}: ${duration.toFixed(2)}ms - ${error}`);
    }
  }

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting performance tests...\n');

    // Test 1: Database connection
    await this.runTest('Database Connection', async () => {
      await db.$queryRaw`SELECT 1`;
    });

    // Test 2: Station count
    await this.runTest('Station Count Query', async () => {
      const count = await db.station.count();
      if (count === 0) throw new Error('No stations found');
    });

    // Test 3: Transit service initialization
    await this.runTest('Transit Service Init', async () => {
      await transitService.initialize();
    });

    // Test 4: Station search
    await this.runTest('Station Search', async () => {
      const stations = await transitService.findStations('Tokyo');
      if (stations.length === 0) throw new Error('No stations found');
    });

    // Test 5: Reachable stations (cold cache)
    await this.runTest('Reachable Stations (Cold)', async () => {
      const stations = await transitService.findReachableStations('00006668', 30);
      if (stations.length === 0) throw new Error('No reachable stations found');
    });

    // Test 6: Reachable stations (warm cache)
    await this.runTest('Reachable Stations (Warm)', async () => {
      const stations = await transitService.findReachableStations('00006668', 30);
      if (stations.length === 0) throw new Error('No reachable stations found');
    });

    // Test 7: Cache operations
    await this.runTest('Cache Set/Get', async () => {
      await cacheService.set('test_key', { data: 'test_value' }, 60);
      const value = await cacheService.get('test_key');
      if (!value) throw new Error('Cache value not found');
    });

    // Test 8: Apartment search query
    await this.runTest('Apartment Search Query', async () => {
      const apartments = await db.apartment.findMany({
        where: { isAvailable: true },
        take: 10,
        include: {
          station: {
            select: { id: true, name: true, nameJa: true }
          }
        }
      });
      // Don't fail if no apartments - this is test data
    });

    // Test 9: Complex search with filters
    await this.runTest('Complex Search Query', async () => {
      const apartments = await db.apartment.findMany({
        where: {
          isAvailable: true,
          rentMonthly: { lte: 150000 },
          size: { gte: 20 },
        },
        orderBy: { rentMonthly: 'asc' },
        take: 10,
        include: {
          station: {
            select: { id: true, name: true, nameJa: true }
          }
        }
      });
    });

    // Test 10: Aggregation query
    await this.runTest('Aggregation Query', async () => {
      const stats = await db.apartment.aggregate({
        where: { isAvailable: true },
        _count: true,
        _avg: { rentMonthly: true },
        _min: { rentMonthly: true },
        _max: { rentMonthly: true },
      });
    });

    // Test 11: Batch operations
    await this.runTest('Batch Station Query', async () => {
      const stationIds = ['00006668', '00004464', '00002296'];
      const stations = await db.station.findMany({
        where: { id: { in: stationIds } },
        include: {
          _count: { select: { apartments: true } }
        }
      });
    });

    // Test 12: Search analytics
    await this.runTest('Search Analytics', async () => {
      const searches = await db.search.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          targetStationName: true,
          totalResults: true,
          searchDurationMs: true,
          createdAt: true,
        }
      });
    });

    console.log('\n📊 Performance Test Results:');
    console.log('=' + '='.repeat(60));
    
    const successfulTests = this.results.filter(r => r.success);
    const failedTests = this.results.filter(r => !r.success);
    
    console.log(`✅ Successful: ${successfulTests.length}`);
    console.log(`❌ Failed: ${failedTests.length}`);
    console.log(`⏱️  Average Duration: ${this.getAverageDuration().toFixed(2)}ms`);
    console.log(`🚀 Fastest: ${this.getFastest().name} (${this.getFastest().duration.toFixed(2)}ms)`);
    console.log(`🐌 Slowest: ${this.getSlowest().name} (${this.getSlowest().duration.toFixed(2)}ms)`);
    
    if (failedTests.length > 0) {
      console.log('\n❌ Failed Tests:');
      failedTests.forEach(test => {
        console.log(`  - ${test.name}: ${test.error}`);
      });
    }

    console.log('\n📋 Detailed Results:');
    this.results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const duration = result.duration.toFixed(2).padStart(8);
      console.log(`${status} ${duration}ms - ${result.name}`);
    });

    // Performance benchmarks
    console.log('\n🎯 Performance Benchmarks:');
    this.checkBenchmarks();
  }

  private getAverageDuration(): number {
    const successful = this.results.filter(r => r.success);
    return successful.reduce((sum, r) => sum + r.duration, 0) / successful.length;
  }

  private getFastest(): TestResult {
    const successful = this.results.filter(r => r.success);
    return successful.reduce((min, r) => r.duration < min.duration ? r : min);
  }

  private getSlowest(): TestResult {
    const successful = this.results.filter(r => r.success);
    return successful.reduce((max, r) => r.duration > max.duration ? r : max);
  }

  private checkBenchmarks(): void {
    const benchmarks = [
      { name: 'Database Connection', target: 50, test: 'Database Connection' },
      { name: 'Station Search', target: 100, test: 'Station Search' },
      { name: 'Reachable Stations (Cold)', target: 1000, test: 'Reachable Stations (Cold)' },
      { name: 'Reachable Stations (Warm)', target: 100, test: 'Reachable Stations (Warm)' },
      { name: 'Cache Operations', target: 10, test: 'Cache Set/Get' },
      { name: 'Apartment Search', target: 200, test: 'Apartment Search Query' },
    ];

    benchmarks.forEach(benchmark => {
      const result = this.results.find(r => r.name === benchmark.test && r.success);
      if (result) {
        const status = result.duration <= benchmark.target ? '✅' : '⚠️';
        console.log(`${status} ${benchmark.name}: ${result.duration.toFixed(2)}ms (target: ${benchmark.target}ms)`);
      }
    });
  }
}

// Load test runner
class LoadTester {
  private concurrency: number;
  private duration: number;
  private results: { duration: number; success: boolean }[] = [];

  constructor(concurrency: number = 10, duration: number = 10000) {
    this.concurrency = concurrency;
    this.duration = duration;
  }

  async runLoadTest(): Promise<void> {
    console.log(`\n🔥 Running load test (${this.concurrency} concurrent, ${this.duration}ms duration)...`);
    
    const startTime = Date.now();
    const workers: Promise<void>[] = [];

    for (let i = 0; i < this.concurrency; i++) {
      workers.push(this.worker(startTime));
    }

    await Promise.all(workers);

    const successful = this.results.filter(r => r.success);
    const failed = this.results.filter(r => !r.success);
    const avgDuration = successful.reduce((sum, r) => sum + r.duration, 0) / successful.length;
    const throughput = (successful.length / (this.duration / 1000)).toFixed(2);

    console.log('\n📊 Load Test Results:');
    console.log(`✅ Successful requests: ${successful.length}`);
    console.log(`❌ Failed requests: ${failed.length}`);
    console.log(`⏱️  Average response time: ${avgDuration.toFixed(2)}ms`);
    console.log(`🚀 Throughput: ${throughput} req/sec`);
  }

  private async worker(startTime: number): Promise<void> {
    while (Date.now() - startTime < this.duration) {
      const requestStart = Date.now();
      
      try {
        // Simulate a typical search request
        await transitService.findReachableStations('00006668', 30);
        
        const requestDuration = Date.now() - requestStart;
        this.results.push({
          duration: requestDuration,
          success: true,
        });
      } catch (error) {
        const requestDuration = Date.now() - requestStart;
        this.results.push({
          duration: requestDuration,
          success: false,
        });
      }

      // Small delay to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
}

// Main execution
async function main() {
  const tester = new PerformanceTester();
  await tester.runAllTests();

  if (process.argv.includes('--load-test')) {
    const loadTester = new LoadTester(5, 5000); // 5 concurrent, 5 seconds
    await loadTester.runLoadTest();
  }

  await db.$disconnect();
  process.exit(0);
}

if (require.main === module) {
  main().catch(console.error);
}