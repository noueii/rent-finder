/**
 * Performance Benchmark Script
 * Compares old vs new unified scrapers
 */

import { performance } from 'perf_hooks';
import { v4 as uuidv4 } from 'uuid';

// Old scrapers
import { RealEstateScraper } from '../sources/realestate-scraper';
import { FastRealEstateScraper } from '../sources/fast-realestate-scraper';
import { YoloJapanScraper } from '../sources/yolo-japan-scraper';
import { FastYoloScraper } from '../sources/fast-yolo-scraper';
import { WagayaJapanScraper } from '../sources/wagaya-japan-scraper';
import { FastWagayaScraper } from '../sources/fast-wagaya-scraper';
import { MetroResidencesScraper } from '../sources/metro-residences-scraper';

// New unified scrapers
import { UnifiedScraperFactory } from '../unified-scraper-factory';

// Types
interface BenchmarkResult {
  scraper: string;
  mode: string;
  avgTime: number;
  minTime: number;
  maxTime: number;
  memoryUsed: number;
  errorRate: number;
  resultsCount: number;
}

interface ComparisonResult {
  old: BenchmarkResult;
  new: BenchmarkResult;
  speedImprovement: number;
  memoryImprovement: number;
  errorRateImprovement: number;
}

class PerformanceBenchmark {
  private results: ComparisonResult[] = [];
  private mockResponseTimes: Map<string, number> = new Map();

  constructor() {
    // Setup mock response times for consistent testing
    this.setupMockResponseTimes();
  }

  private setupMockResponseTimes() {
    // Simulate network latency
    this.mockResponseTimes.set('realestate', 150);
    this.mockResponseTimes.set('yolo-japan', 200);
    this.mockResponseTimes.set('wagaya-japan', 180);
    this.mockResponseTimes.set('metro-residences', 220);
  }

  async runBenchmarks() {
    console.log('🚀 Starting Performance Benchmarks...\n');

    // Test configurations
    const testCases = [
      { site: 'realestate', pages: 5, concurrent: false },
      { site: 'realestate', pages: 5, concurrent: true },
      { site: 'yolo-japan', pages: 3, concurrent: false },
      { site: 'wagaya-japan', pages: 4, concurrent: false },
      { site: 'metro-residences', pages: 2, concurrent: false },
    ];

    for (const testCase of testCases) {
      await this.compareScraper(testCase.site, testCase.pages, testCase.concurrent);
    }

    this.generateReport();
  }

  private async compareScraper(site: string, pages: number, concurrent: boolean) {
    console.log(`\n📊 Testing ${site} (${pages} pages, ${concurrent ? 'concurrent' : 'sequential'})...`);

    // Test old scraper (normal mode)
    const oldNormalResult = await this.benchmarkOldScraper(site, false, pages, concurrent);
    
    // Test old scraper (fast mode if available)
    let oldFastResult: BenchmarkResult | null = null;
    if (this.hasFastVariant(site)) {
      oldFastResult = await this.benchmarkOldScraper(site, true, pages, concurrent);
    }

    // Test new unified scraper (normal mode)
    const newNormalResult = await this.benchmarkUnifiedScraper(site, 'normal', pages, concurrent);
    
    // Test new unified scraper (fast mode)
    const newFastResult = await this.benchmarkUnifiedScraper(site, 'fast', pages, concurrent);

    // Compare results
    this.results.push({
      old: oldNormalResult,
      new: newNormalResult,
      speedImprovement: this.calculateImprovement(oldNormalResult.avgTime, newNormalResult.avgTime),
      memoryImprovement: this.calculateImprovement(oldNormalResult.memoryUsed, newNormalResult.memoryUsed),
      errorRateImprovement: this.calculateImprovement(oldNormalResult.errorRate, newNormalResult.errorRate),
    });

    if (oldFastResult) {
      this.results.push({
        old: oldFastResult,
        new: newFastResult,
        speedImprovement: this.calculateImprovement(oldFastResult.avgTime, newFastResult.avgTime),
        memoryImprovement: this.calculateImprovement(oldFastResult.memoryUsed, newFastResult.memoryUsed),
        errorRateImprovement: this.calculateImprovement(oldFastResult.errorRate, newFastResult.errorRate),
      });
    }
  }

  private async benchmarkOldScraper(
    site: string, 
    fast: boolean, 
    pages: number,
    concurrent: boolean
  ): Promise<BenchmarkResult> {
    const scraper = this.getOldScraper(site, fast);
    const times: number[] = [];
    const memoryUsages: number[] = [];
    let errors = 0;
    let totalResults = 0;

    // Mock the fetch method
    this.mockScraperFetch(scraper, site);

    for (let run = 0; run < 3; run++) {
      const memBefore = process.memoryUsage().heapUsed;
      const startTime = performance.now();

      try {
        if (concurrent && pages > 1) {
          const promises = Array.from({ length: pages }, (_, i) => 
            scraper.scrapePage(i + 1, 1000)
          );
          const results = await Promise.all(promises);
          totalResults += results.reduce((sum, r) => sum + r.length, 0);
        } else {
          for (let page = 1; page <= pages; page++) {
            const results = await scraper.scrapePage(page, 1000);
            totalResults += results.length;
          }
        }
      } catch (error) {
        errors++;
      }

      const endTime = performance.now();
      const memAfter = process.memoryUsage().heapUsed;

      times.push(endTime - startTime);
      memoryUsages.push((memAfter - memBefore) / 1024 / 1024); // MB
    }

    return {
      scraper: `${site}-old`,
      mode: fast ? 'fast' : 'normal',
      avgTime: times.reduce((a, b) => a + b, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      memoryUsed: memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length,
      errorRate: errors / 3,
      resultsCount: totalResults / 3,
    };
  }

  private async benchmarkUnifiedScraper(
    site: string, 
    mode: 'fast' | 'normal', 
    pages: number,
    concurrent: boolean
  ): Promise<BenchmarkResult> {
    const scraper = UnifiedScraperFactory.create(site as any, {}, mode);
    const times: number[] = [];
    const memoryUsages: number[] = [];
    let errors = 0;
    let totalResults = 0;

    // Mock the fetch method
    this.mockUnifiedScraperFetch(scraper, site);

    for (let run = 0; run < 3; run++) {
      const memBefore = process.memoryUsage().heapUsed;
      const startTime = performance.now();

      try {
        if (concurrent && pages > 1) {
          const promises = Array.from({ length: pages }, (_, i) => 
            scraper.scrape({ page: i + 1, limit: 20 })
          );
          const results = await Promise.all(promises);
          totalResults += results.reduce((sum, r) => sum + r.apartments.length, 0);
        } else {
          for (let page = 1; page <= pages; page++) {
            const result = await scraper.scrape({ page, limit: 20 });
            totalResults += result.apartments.length;
          }
        }
      } catch (error) {
        errors++;
      }

      const endTime = performance.now();
      const memAfter = process.memoryUsage().heapUsed;

      times.push(endTime - startTime);
      memoryUsages.push((memAfter - memBefore) / 1024 / 1024); // MB
    }

    return {
      scraper: `${site}-unified`,
      mode,
      avgTime: times.reduce((a, b) => a + b, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      memoryUsed: memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length,
      errorRate: errors / 3,
      resultsCount: totalResults / 3,
    };
  }

  private getOldScraper(site: string, fast: boolean): any {
    const scrapers: Record<string, any> = {
      'realestate': fast ? new FastRealEstateScraper() : new RealEstateScraper(),
      'yolo-japan': fast ? new FastYoloScraper() : new YoloJapanScraper(),
      'wagaya-japan': fast ? new FastWagayaScraper() : new WagayaJapanScraper(),
      'metro-residences': new MetroResidencesScraper(),
    };

    return scrapers[site];
  }

  private hasFastVariant(site: string): boolean {
    return ['realestate', 'yolo-japan', 'wagaya-japan'].includes(site);
  }

  private mockScraperFetch(scraper: any, site: string) {
    // Mock the HTTP fetch to return consistent test data
    const responseTime = this.mockResponseTimes.get(site) || 150;
    
    scraper.fetchPage = async () => {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, responseTime));
      
      // Return mock HTML
      return this.generateMockHtml(site, 20);
    };
  }

  private mockUnifiedScraperFetch(scraper: any, site: string) {
    // Mock the HTTP fetch for unified scrapers
    const responseTime = this.mockResponseTimes.get(site) || 150;
    
    scraper.fetchWithRetry = async () => {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, responseTime));
      
      // Return mock response
      return {
        data: this.generateMockHtml(site, 20),
        status: 200,
        headers: {},
      };
    };
  }

  private generateMockHtml(site: string, count: number): string {
    const apartments = Array.from({ length: count }, (_, i) => ({
      id: uuidv4(),
      title: `Apartment ${i + 1}`,
      price: 80000 + (i * 5000),
      area: 25 + (i % 20),
      station: `Station ${i % 10}`,
      walkTime: 5 + (i % 15),
    }));

    // Generate site-specific HTML structure
    switch (site) {
      case 'realestate':
        return this.generateRealEstateHtml(apartments);
      case 'yolo-japan':
        return this.generateYoloHtml(apartments);
      case 'wagaya-japan':
        return this.generateWagayaHtml(apartments);
      case 'metro-residences':
        return this.generateMetroHtml(apartments);
      default:
        return '';
    }
  }

  private generateRealEstateHtml(apartments: any[]): string {
    return `
      <div class="cassetteitem_content">
        ${apartments.map(apt => `
          <div class="cassetteitem">
            <div class="cassetteitem_detail">
              <div class="cassetteitem_detail-title">${apt.title}</div>
              <div class="cassetteitem_detail-col3">
                <div>${apt.price}円</div>
                <div>${apt.area}m²</div>
              </div>
              <div class="cassetteitem_detail-text">${apt.station} ${apt.walkTime}分</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  private generateYoloHtml(apartments: any[]): string {
    return `
      <div class="property-list">
        ${apartments.map(apt => `
          <div class="property-item" data-id="${apt.id}">
            <h3 class="property-title">${apt.title}</h3>
            <div class="property-price">¥${apt.price}</div>
            <div class="property-area">${apt.area} m²</div>
            <div class="property-station">${apt.station} - ${apt.walkTime} min walk</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  private generateWagayaHtml(apartments: any[]): string {
    return `
      <div class="result-list">
        ${apartments.map(apt => `
          <article class="result-item">
            <h2 class="result-title">${apt.title}</h2>
            <div class="result-price">月額: ${apt.price}円</div>
            <div class="result-specs">
              <span class="result-area">${apt.area}㎡</span>
              <span class="result-access">${apt.station}駅 徒歩${apt.walkTime}分</span>
            </div>
          </article>
        `).join('')}
      </div>
    `;
  }

  private generateMetroHtml(apartments: any[]): string {
    return `
      <div class="properties-grid">
        ${apartments.map(apt => `
          <div class="property-card" id="${apt.id}">
            <div class="property-header">
              <h4>${apt.title}</h4>
            </div>
            <div class="property-details">
              <p class="rent">Rent: ¥${apt.price}/month</p>
              <p class="size">Size: ${apt.area}m²</p>
              <p class="location">${apt.station} Station (${apt.walkTime} min walk)</p>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  private calculateImprovement(oldValue: number, newValue: number): number {
    if (oldValue === 0) return 0;
    return ((oldValue - newValue) / oldValue) * 100;
  }

  private generateReport() {
    const report: string[] = [
      '\n' + '='.repeat(80),
      '📊 PERFORMANCE BENCHMARK REPORT',
      '='.repeat(80),
      '',
      `Generated: ${new Date().toISOString()}`,
      '',
    ];

    // Summary statistics
    const avgSpeedImprovement = this.results.reduce((sum, r) => sum + r.speedImprovement, 0) / this.results.length;
    const avgMemoryImprovement = this.results.reduce((sum, r) => sum + r.memoryImprovement, 0) / this.results.length;
    const avgErrorImprovement = this.results.reduce((sum, r) => sum + r.errorRateImprovement, 0) / this.results.length;

    report.push('📈 SUMMARY');
    report.push('-'.repeat(40));
    report.push(`Average Speed Improvement: ${avgSpeedImprovement.toFixed(1)}%`);
    report.push(`Average Memory Improvement: ${avgMemoryImprovement.toFixed(1)}%`);
    report.push(`Average Error Rate Improvement: ${avgErrorImprovement.toFixed(1)}%`);
    report.push('');

    // Detailed results
    report.push('📋 DETAILED RESULTS');
    report.push('-'.repeat(40));

    for (const result of this.results) {
      report.push(`\n${result.old.scraper} (${result.old.mode} mode):`);
      report.push(`  Old Implementation:`);
      report.push(`    - Avg Time: ${result.old.avgTime.toFixed(2)}ms`);
      report.push(`    - Memory: ${result.old.memoryUsed.toFixed(2)}MB`);
      report.push(`    - Error Rate: ${(result.old.errorRate * 100).toFixed(1)}%`);
      report.push(`    - Results: ${result.old.resultsCount}`);
      
      report.push(`  New Implementation:`);
      report.push(`    - Avg Time: ${result.new.avgTime.toFixed(2)}ms`);
      report.push(`    - Memory: ${result.new.memoryUsed.toFixed(2)}MB`);
      report.push(`    - Error Rate: ${(result.new.errorRate * 100).toFixed(1)}%`);
      report.push(`    - Results: ${result.new.resultsCount}`);
      
      report.push(`  Improvements:`);
      report.push(`    - Speed: ${result.speedImprovement > 0 ? '+' : ''}${result.speedImprovement.toFixed(1)}%`);
      report.push(`    - Memory: ${result.memoryImprovement > 0 ? '+' : ''}${result.memoryImprovement.toFixed(1)}%`);
      report.push(`    - Error Rate: ${result.errorRateImprovement > 0 ? '+' : ''}${result.errorRateImprovement.toFixed(1)}%`);
    }

    report.push('');
    report.push('✅ CONCLUSIONS');
    report.push('-'.repeat(40));
    
    if (avgSpeedImprovement > 0) {
      report.push(`✓ Unified scrapers are ${avgSpeedImprovement.toFixed(1)}% faster on average`);
    } else if (avgSpeedImprovement < -10) {
      report.push(`⚠️  Unified scrapers are ${Math.abs(avgSpeedImprovement).toFixed(1)}% slower - optimization needed`);
    } else {
      report.push(`✓ Unified scrapers maintain comparable performance (within 10%)`);
    }

    if (avgMemoryImprovement > 0) {
      report.push(`✓ Memory usage reduced by ${avgMemoryImprovement.toFixed(1)}%`);
    }

    if (avgErrorImprovement >= 0) {
      report.push(`✓ Error rates maintained or improved`);
    }

    report.push('');
    report.push('='.repeat(80));

    // Write report to file
    this.saveReport(report.join('\n'));
    
    // Also output to console
    console.log(report.join('\n'));
  }

  private saveReport(content: string) {
    const fs = require('fs');
    const path = require('path');
    
    const reportPath = path.join(
      process.cwd(),
      'docs/refactoring/scraper-performance-report.md'
    );
    
    fs.writeFileSync(reportPath, content);
    console.log(`\n📄 Report saved to: ${reportPath}`);
  }
}

// Run benchmarks if executed directly
if (require.main === module) {
  const benchmark = new PerformanceBenchmark();
  benchmark.runBenchmarks().catch(console.error);
}

export { PerformanceBenchmark };