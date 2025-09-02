/**
 * Database Query Benchmarks
 * Measures the performance of various database operations
 */

import { benchmark, formatResults, saveBenchmarkResults } from './utils';
import type { BenchmarkResult } from './utils';
import { prisma } from '~/server/db';

interface DbBenchmarkConfig {
  name: string;
  query: () => Promise<any>;
}

/**
 * Run all database benchmarks
 */
export async function runDatabaseBenchmarks(): Promise<void> {
  console.log('🗄️  Running database benchmarks...\n');
  
  const benchmarks: DbBenchmarkConfig[] = [
    // Basic queries
    {
      name: 'Count All Apartments',
      query: () => prisma.apartment.count({ where: { removed: false } }),
    },
    
    {
      name: 'Find First Apartment',
      query: () => prisma.apartment.findFirst({ where: { removed: false } }),
    },
    
    {
      name: 'Find 20 Apartments (Simple)',
      query: () => prisma.apartment.findMany({
        where: { removed: false },
        take: 20,
      }),
    },
    
    {
      name: 'Find 20 Apartments (With Relations)',
      query: () => prisma.apartment.findMany({
        where: { removed: false },
        take: 20,
        include: {
          images: { take: 1 },
          nearestStations: {
            include: { station: true },
            take: 3,
          },
        },
      }),
    },
    
    // Filtered queries
    {
      name: 'Search by Price Range',
      query: () => prisma.apartment.findMany({
        where: {
          removed: false,
          price: { gte: 50000, lte: 150000 },
        },
        take: 20,
      }),
    },
    
    {
      name: 'Search by Multiple Filters',
      query: () => prisma.apartment.findMany({
        where: {
          removed: false,
          price: { gte: 50000, lte: 150000 },
          size: { gte: 20 },
          layout: { in: ['1K', '1DK', '1LDK'] },
        },
        take: 20,
      }),
    },
    
    // Station queries
    {
      name: 'Find All Stations',
      query: () => prisma.station.findMany({ take: 100 }),
    },
    
    {
      name: 'Find Station by Name',
      query: () => prisma.station.findFirst({
        where: {
          OR: [
            { name: { contains: 'Shibuya' } },
            { nameEn: { contains: 'Shibuya' } },
          ],
        },
      }),
    },
    
    {
      name: 'Stations with Apartment Count',
      query: () => prisma.station.findMany({
        take: 10,
        include: {
          _count: {
            select: { apartments: true },
          },
        },
        orderBy: {
          apartments: { _count: 'desc' },
        },
      }),
    },
    
    // Complex queries
    {
      name: 'Apartments Near Station',
      query: () => prisma.apartment.findMany({
        where: {
          removed: false,
          nearestStations: {
            some: {
              walkingMinutes: { lte: 10 },
            },
          },
        },
        take: 20,
        include: {
          nearestStations: {
            include: { station: true },
          },
        },
      }),
    },
    
    // Aggregation queries
    {
      name: 'Average Price by Layout',
      query: () => prisma.apartment.groupBy({
        by: ['layout'],
        where: { removed: false },
        _avg: { price: true },
        _count: true,
      }),
    },
    
    {
      name: 'Price Range Statistics',
      query: () => prisma.apartment.aggregate({
        where: { removed: false },
        _avg: { price: true },
        _min: { price: true },
        _max: { price: true },
        _count: true,
      }),
    },
    
    // User/List queries
    {
      name: 'User Lists with Count',
      query: async () => {
        const user = await prisma.user.findFirst();
        if (!user) return null;
        
        return prisma.list.findMany({
          where: { userId: user.id },
          include: {
            _count: {
              select: { apartments: true },
            },
          },
        });
      },
    },
  ];
  
  const results: BenchmarkResult[] = [];
  
  // Ensure database connection
  await prisma.$connect();
  
  for (const config of benchmarks) {
    try {
      console.log(`Running benchmark: ${config.name}...`);
      const result = await benchmark(
        config.query,
        {
          name: config.name,
          runs: 30,
          warmup: 3,
        }
      );
      results.push(result);
      console.log(`✓ Completed: Avg ${result.avgTime.toFixed(2)}ms\n`);
    } catch (error) {
      console.error(`✗ Failed: ${config.name}`);
      console.error(error);
      console.log();
    }
  }
  
  // Display results
  console.log('\n📊 Database Benchmark Results:\n');
  console.log(formatResults(results));
  
  // Save results
  await saveBenchmarkResults(results, 'database-benchmarks');
  
  // Display baseline recommendations
  console.log('\n📈 Recommended Performance Baselines:');
  console.log('- Simple queries (count, findFirst): < 5ms');
  console.log('- Basic findMany (20 records): < 10ms');
  console.log('- Queries with relations: < 20ms');
  console.log('- Complex filtered queries: < 30ms');
  console.log('- Aggregation queries: < 50ms');
  
  // Cleanup
  await prisma.$disconnect();
}

// Run benchmarks if this file is executed directly
if (require.main === module) {
  runDatabaseBenchmarks().catch(console.error);
}