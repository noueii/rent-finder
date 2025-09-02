/**
 * API Response Time Benchmarks
 * Measures the performance of various API endpoints
 */

import { benchmark, formatResults, saveBenchmarkResults } from './utils';
import type { BenchmarkResult } from './utils';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

interface ApiBenchmarkConfig {
  name: string;
  endpoint: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}

/**
 * Benchmark an API endpoint
 */
async function benchmarkApiEndpoint(config: ApiBenchmarkConfig): Promise<BenchmarkResult> {
  const { name, endpoint, method = 'GET', body, headers = {} } = config;
  
  const requestOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };
  
  if (body && method !== 'GET') {
    requestOptions.body = JSON.stringify(body);
  }
  
  return benchmark(
    async () => {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, requestOptions);
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      
      // Consume the response to ensure complete processing
      await response.json();
    },
    {
      name,
      runs: 50,
      warmup: 5,
    }
  );
}

/**
 * Run all API benchmarks
 */
export async function runApiBenchmarks(): Promise<void> {
  console.log('🚀 Running API benchmarks...\n');
  
  const benchmarks: ApiBenchmarkConfig[] = [
    // Health check endpoint
    {
      name: 'Health Check',
      endpoint: '/health',
    },
    
    // tRPC endpoints (via HTTP)
    {
      name: 'Apartment Search (Empty)',
      endpoint: '/trpc/apartment.search',
      method: 'POST',
      body: {
        json: {
          filters: {},
          pagination: { page: 1, limit: 20 },
        },
      },
    },
    
    {
      name: 'Apartment Search (Filtered)',
      endpoint: '/trpc/apartment.search',
      method: 'POST',
      body: {
        json: {
          filters: {
            priceMin: 50000,
            priceMax: 150000,
            sizeMin: 20,
            layout: ['1K', '1DK', '1LDK'],
          },
          pagination: { page: 1, limit: 20 },
        },
      },
    },
    
    {
      name: 'Station List',
      endpoint: '/trpc/station.list',
      method: 'POST',
      body: {
        json: {
          limit: 100,
        },
      },
    },
    
    {
      name: 'Search Suggestions',
      endpoint: '/trpc/search.getSuggestions',
      method: 'POST',
      body: {
        json: {
          query: 'shibuya',
          type: 'station',
        },
      },
    },
    
    {
      name: 'Popular Searches',
      endpoint: '/trpc/search.getPopularSearches',
      method: 'POST',
      body: {
        json: {},
      },
    },
  ];
  
  const results: BenchmarkResult[] = [];
  
  for (const config of benchmarks) {
    try {
      console.log(`Running benchmark: ${config.name}...`);
      const result = await benchmarkApiEndpoint(config);
      results.push(result);
      console.log(`✓ Completed: Avg ${result.avgTime.toFixed(2)}ms\n`);
    } catch (error) {
      console.error(`✗ Failed: ${config.name}`);
      console.error(error);
      console.log();
    }
  }
  
  // Display results
  console.log('\n📊 API Benchmark Results:\n');
  console.log(formatResults(results));
  
  // Save results
  await saveBenchmarkResults(results, 'api-benchmarks');
  
  // Display baseline recommendations
  console.log('\n📈 Recommended Performance Baselines:');
  console.log('- Health Check: < 10ms');
  console.log('- Simple Queries: < 50ms');
  console.log('- Complex Queries: < 200ms');
  console.log('- Search Operations: < 500ms');
}

// Run benchmarks if this file is executed directly
if (require.main === module) {
  runApiBenchmarks().catch(console.error);
}