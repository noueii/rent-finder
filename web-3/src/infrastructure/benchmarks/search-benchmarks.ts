/**
 * Search Performance Benchmarks
 * Measures the performance of various search operations
 */

import { benchmark, formatResults, saveBenchmarkResults } from './utils';
import type { BenchmarkResult } from './utils';
import { prisma } from '~/server/db';
import { fuzzySearchStations } from '~/lib/fuzzy-search';

interface SearchBenchmarkConfig {
  name: string;
  search: () => Promise<any>;
}

/**
 * Generate random search filters
 */
function generateRandomFilters() {
  const layouts = ['1K', '1DK', '1LDK', '2K', '2DK', '2LDK', '3K', '3LDK'];
  const amenities = ['Elevator', 'Parking', 'Pet Friendly', 'Balcony', 'Air Conditioning'];
  
  return {
    priceMin: Math.floor(Math.random() * 50000) + 30000,
    priceMax: Math.floor(Math.random() * 150000) + 100000,
    sizeMin: Math.floor(Math.random() * 20) + 10,
    layout: layouts.slice(0, Math.floor(Math.random() * 3) + 1),
    amenities: amenities.slice(0, Math.floor(Math.random() * 2)),
  };
}

/**
 * Run all search benchmarks
 */
export async function runSearchBenchmarks(): Promise<void> {
  console.log('🔍 Running search benchmarks...\n');
  
  // Get sample data for benchmarks
  const stations = await prisma.station.findMany({ take: 100 });
  const stationIds = stations.map(s => s.id);
  
  const benchmarks: SearchBenchmarkConfig[] = [
    // Basic apartment search
    {
      name: 'Empty Search (Default Page)',
      search: () => prisma.apartment.findMany({
        where: { removed: false },
        take: 20,
        include: {
          images: { take: 1 },
          nearestStations: { take: 3, include: { station: true } },
        },
      }),
    },
    
    // Filtered searches
    {
      name: 'Price Range Search',
      search: () => prisma.apartment.findMany({
        where: {
          removed: false,
          price: { gte: 50000, lte: 120000 },
        },
        take: 20,
        include: {
          images: { take: 1 },
          nearestStations: { take: 3, include: { station: true } },
        },
      }),
    },
    
    {
      name: 'Multi-Filter Search',
      search: () => {
        const filters = generateRandomFilters();
        return prisma.apartment.findMany({
          where: {
            removed: false,
            price: { gte: filters.priceMin, lte: filters.priceMax },
            size: { gte: filters.sizeMin },
            layout: { in: filters.layout },
          },
          take: 20,
          include: {
            images: { take: 1 },
            nearestStations: { take: 3, include: { station: true } },
          },
        });
      },
    },
    
    // Station-based searches
    {
      name: 'Near Single Station',
      search: () => prisma.apartment.findMany({
        where: {
          removed: false,
          nearestStations: {
            some: {
              stationId: stationIds[0],
              walkingMinutes: { lte: 15 },
            },
          },
        },
        take: 20,
        include: {
          images: { take: 1 },
          nearestStations: { take: 3, include: { station: true } },
        },
      }),
    },
    
    {
      name: 'Near Multiple Stations',
      search: () => prisma.apartment.findMany({
        where: {
          removed: false,
          nearestStations: {
            some: {
              stationId: { in: stationIds.slice(0, 5) },
              walkingMinutes: { lte: 10 },
            },
          },
        },
        take: 20,
        include: {
          images: { take: 1 },
          nearestStations: { take: 3, include: { station: true } },
        },
      }),
    },
    
    // Fuzzy search
    {
      name: 'Fuzzy Station Search (Shibuya)',
      search: async () => fuzzySearchStations(stations, 'shibuya', 10),
    },
    
    {
      name: 'Fuzzy Station Search (Partial)',
      search: async () => fuzzySearchStations(stations, 'shin', 10),
    },
    
    // Sorting variations
    {
      name: 'Sort by Price ASC',
      search: () => prisma.apartment.findMany({
        where: { removed: false },
        take: 20,
        orderBy: { price: 'asc' },
        include: {
          images: { take: 1 },
          nearestStations: { take: 3, include: { station: true } },
        },
      }),
    },
    
    {
      name: 'Sort by Size DESC',
      search: () => prisma.apartment.findMany({
        where: { removed: false },
        take: 20,
        orderBy: { size: 'desc' },
        include: {
          images: { take: 1 },
          nearestStations: { take: 3, include: { station: true } },
        },
      }),
    },
    
    {
      name: 'Sort by Creation Date',
      search: () => prisma.apartment.findMany({
        where: { removed: false },
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: {
          images: { take: 1 },
          nearestStations: { take: 3, include: { station: true } },
        },
      }),
    },
    
    // Pagination
    {
      name: 'Paginated Search (Page 1)',
      search: () => prisma.apartment.findMany({
        where: { removed: false },
        take: 20,
        skip: 0,
        include: {
          images: { take: 1 },
          nearestStations: { take: 3, include: { station: true } },
        },
      }),
    },
    
    {
      name: 'Paginated Search (Page 5)',
      search: () => prisma.apartment.findMany({
        where: { removed: false },
        take: 20,
        skip: 80,
        include: {
          images: { take: 1 },
          nearestStations: { take: 3, include: { station: true } },
        },
      }),
    },
    
    // Complex aggregated search
    {
      name: 'Search with Count',
      search: async () => {
        const where = {
          removed: false,
          price: { gte: 50000, lte: 150000 },
        };
        
        const [apartments, count] = await Promise.all([
          prisma.apartment.findMany({
            where,
            take: 20,
            include: {
              images: { take: 1 },
              nearestStations: { take: 3, include: { station: true } },
            },
          }),
          prisma.apartment.count({ where }),
        ]);
        
        return { apartments, count };
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
        config.search,
        {
          name: config.name,
          runs: 20,
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
  console.log('\n📊 Search Benchmark Results:\n');
  console.log(formatResults(results));
  
  // Save results
  await saveBenchmarkResults(results, 'search-benchmarks');
  
  // Display baseline recommendations
  console.log('\n📈 Recommended Performance Baselines:');
  console.log('- Basic search (20 results): < 50ms');
  console.log('- Filtered search: < 100ms');
  console.log('- Multi-station search: < 150ms');
  console.log('- Fuzzy search: < 20ms');
  console.log('- Search with count: < 100ms');
  console.log('- Complex multi-filter search: < 200ms');
  
  // Cleanup
  await prisma.$disconnect();
}

// Run benchmarks if this file is executed directly
if (require.main === module) {
  runSearchBenchmarks().catch(console.error);
}