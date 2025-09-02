/**
 * Scraper Performance Benchmarks
 * Measures the performance of web scraping operations
 */

import { benchmark, formatResults, saveBenchmarkResults, getMemoryUsage } from './utils';
import type { BenchmarkResult } from './utils';

interface ScraperBenchmarkConfig {
  name: string;
  scrape: () => Promise<any>;
}

/**
 * Mock HTML response for testing parsing performance
 */
function generateMockHtml(numListings: number): string {
  let html = '<html><body><div class="listings">';
  
  for (let i = 0; i < numListings; i++) {
    html += `
      <div class="listing" data-id="${i}">
        <h3 class="title">Apartment ${i} in Shibuya</h3>
        <div class="price">¥${80000 + i * 1000}</div>
        <div class="size">${20 + i}m²</div>
        <div class="layout">1LDK</div>
        <div class="station">Shibuya Station - ${5 + i % 10} min walk</div>
        <div class="address">Shibuya-ku, Tokyo ${i}</div>
        <img src="https://example.com/image${i}.jpg" alt="Apartment ${i}">
      </div>
    `;
  }
  
  html += '</div></body></html>';
  return html;
}

/**
 * Simulate HTML parsing
 */
async function parseHtml(html: string): Promise<any[]> {
  const cheerio = await import('cheerio');
  const $ = cheerio.load(html);
  
  const listings: any[] = [];
  
  $('.listing').each((_, el) => {
    const $el = $(el);
    listings.push({
      id: $el.attr('data-id'),
      title: $el.find('.title').text().trim(),
      price: parseInt($el.find('.price').text().replace(/[^0-9]/g, ''), 10),
      size: parseFloat($el.find('.size').text().replace(/[^0-9.]/g, '')),
      layout: $el.find('.layout').text().trim(),
      station: $el.find('.station').text().trim(),
      address: $el.find('.address').text().trim(),
      image: $el.find('img').attr('src'),
    });
  });
  
  return listings;
}

/**
 * Simulate data validation and transformation
 */
function validateAndTransform(listings: any[]): any[] {
  return listings.map(listing => {
    // Validate required fields
    if (!listing.price || !listing.size || !listing.title) {
      throw new Error('Invalid listing data');
    }
    
    // Transform data
    return {
      ...listing,
      pricePerSqm: listing.price / listing.size,
      walkingMinutes: parseInt(listing.station.match(/(\d+) min/)?.[1] || '0', 10),
      ward: listing.address.split(',')[0],
      amenities: [], // Would be extracted from description
      scrapedAt: new Date(),
    };
  });
}

/**
 * Run all scraper benchmarks
 */
export async function runScraperBenchmarks(): Promise<void> {
  console.log('🕷️  Running scraper benchmarks...\n');
  
  // Generate test data
  const smallHtml = generateMockHtml(20);
  const mediumHtml = generateMockHtml(100);
  const largeHtml = generateMockHtml(500);
  
  const benchmarks: ScraperBenchmarkConfig[] = [
    // HTML parsing benchmarks
    {
      name: 'Parse Small Page (20 listings)',
      scrape: () => parseHtml(smallHtml),
    },
    
    {
      name: 'Parse Medium Page (100 listings)',
      scrape: () => parseHtml(mediumHtml),
    },
    
    {
      name: 'Parse Large Page (500 listings)',
      scrape: () => parseHtml(largeHtml),
    },
    
    // Data processing benchmarks
    {
      name: 'Validate & Transform (20 items)',
      scrape: async () => {
        const listings = await parseHtml(smallHtml);
        return validateAndTransform(listings);
      },
    },
    
    {
      name: 'Validate & Transform (100 items)',
      scrape: async () => {
        const listings = await parseHtml(mediumHtml);
        return validateAndTransform(listings);
      },
    },
    
    // Full pipeline benchmarks
    {
      name: 'Full Pipeline (Small)',
      scrape: async () => {
        const listings = await parseHtml(smallHtml);
        const validated = validateAndTransform(listings);
        // Simulate deduplication
        const unique = new Map();
        validated.forEach(item => unique.set(item.id, item));
        return Array.from(unique.values());
      },
    },
    
    {
      name: 'Full Pipeline (Medium)',
      scrape: async () => {
        const listings = await parseHtml(mediumHtml);
        const validated = validateAndTransform(listings);
        const unique = new Map();
        validated.forEach(item => unique.set(item.id, item));
        return Array.from(unique.values());
      },
    },
    
    // Concurrent parsing simulation
    {
      name: 'Concurrent Parse (5 pages)',
      scrape: async () => {
        const pages = Array(5).fill(smallHtml);
        const results = await Promise.all(
          pages.map(html => parseHtml(html))
        );
        return results.flat();
      },
    },
    
    {
      name: 'Concurrent Parse (10 pages)',
      scrape: async () => {
        const pages = Array(10).fill(smallHtml);
        const results = await Promise.all(
          pages.map(html => parseHtml(html))
        );
        return results.flat();
      },
    },
    
    // Rate limiting simulation
    {
      name: 'Rate Limited Scrape (1req/100ms)',
      scrape: async () => {
        const results = [];
        for (let i = 0; i < 5; i++) {
          results.push(await parseHtml(smallHtml));
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        return results.flat();
      },
    },
    
    // Memory-intensive operations
    {
      name: 'Large Batch Processing',
      scrape: async () => {
        const batches = Array(20).fill(mediumHtml);
        const allListings = [];
        
        for (const html of batches) {
          const listings = await parseHtml(html);
          allListings.push(...listings);
        }
        
        return validateAndTransform(allListings);
      },
    },
  ];
  
  const results: BenchmarkResult[] = [];
  
  console.log('Initial memory usage:', getMemoryUsage());
  console.log();
  
  for (const config of benchmarks) {
    try {
      console.log(`Running benchmark: ${config.name}...`);
      const result = await benchmark(
        config.scrape,
        {
          name: config.name,
          runs: 20,
          warmup: 2,
        }
      );
      results.push(result);
      console.log(`✓ Completed: Avg ${result.avgTime.toFixed(2)}ms`);
      console.log(`  Memory: ${getMemoryUsage().heapUsed}\n`);
    } catch (error) {
      console.error(`✗ Failed: ${config.name}`);
      console.error(error);
      console.log();
    }
  }
  
  // Display results
  console.log('\n📊 Scraper Benchmark Results:\n');
  console.log(formatResults(results));
  
  // Save results
  await saveBenchmarkResults(results, 'scraper-benchmarks');
  
  // Display baseline recommendations
  console.log('\n📈 Recommended Performance Baselines:');
  console.log('- HTML parsing (20 items): < 5ms');
  console.log('- HTML parsing (100 items): < 20ms');
  console.log('- HTML parsing (500 items): < 100ms');
  console.log('- Data validation/transform: < 2ms per 100 items');
  console.log('- Full pipeline (medium): < 50ms');
  console.log('- Concurrent parsing: Linear scaling with concurrency');
  console.log('- Rate-limited operations: Respect rate limits + processing time');
  
  console.log('\nFinal memory usage:', getMemoryUsage());
}

// Run benchmarks if this file is executed directly
if (require.main === module) {
  runScraperBenchmarks().catch(console.error);
}