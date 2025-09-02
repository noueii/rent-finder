#!/usr/bin/env tsx
// @ts-nocheck

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';
import { UserAgentRotator } from '../src/lib/scrapers/utils/user-agent-rotator';

interface ProxyResult {
  proxy: string;
  status: 'working' | 'partial' | 'failed';
  responseTime?: number;
  error?: string;
  tests: {
    basic: boolean;
    wagayaHome: boolean;
    wagayaDetail: boolean;
  };
}

class BulkProxyTester {
  private userAgentRotator = new UserAgentRotator();
  private concurrency: number;
  private timeout: number;
  private results: ProxyResult[] = [];
  private startTime: number = 0;
  private tested: number = 0;
  private working: string[] = [];
  
  constructor(concurrency: number = 50, timeout: number = 10000) {
    this.concurrency = concurrency;
    this.timeout = timeout;
  }
  
  private async testProxy(proxyString: string): Promise<ProxyResult> {
    const [host, port] = proxyString.split(':');
    const result: ProxyResult = {
      proxy: proxyString,
      status: 'failed',
      tests: {
        basic: false,
        wagayaHome: false,
        wagayaDetail: false
      }
    };
    
    const proxyConfig = {
      host,
      port: parseInt(port),
      protocol: 'http' as const
    };
    
    try {
      // Quick basic test first
      const basicStart = Date.now();
      await axios.get('http://httpbin.org/ip', {
        timeout: 5000,
        proxy: proxyConfig,
        validateStatus: () => true
      });
      result.tests.basic = true;
      
      // If basic test passes, test Wagaya
      const headers = this.userAgentRotator.buildHeaders(undefined, true);
      const wagayaHeaders = {
        ...headers,
        'Referer': 'https://wagaya-japan.com/en/',
      };
      
      // Test detail page directly (most important)
      const detailStart = Date.now();
      const response = await axios.get(
        'https://wagaya-japan.com/en/chintai_detail.php?id=2600102',
        {
          timeout: this.timeout,
          proxy: proxyConfig,
          headers: wagayaHeaders,
          maxRedirects: 5,
          validateStatus: (status) => status < 500,
        }
      );
      
      if (response.status === 200 && response.data.includes('wagaya')) {
        result.tests.wagayaDetail = true;
        result.tests.wagayaHome = true; // If detail works, home likely works too
        result.status = 'working';
        result.responseTime = Date.now() - basicStart;
      } else {
        result.status = 'partial';
      }
      
    } catch (error: any) {
      if (result.tests.basic) {
        result.status = 'partial';
      }
      result.error = error.code || error.message?.substring(0, 30);
    }
    
    return result;
  }
  
  private async processBatch(proxies: string[]): Promise<ProxyResult[]> {
    const promises = proxies.map(proxy => 
      this.testProxy(proxy).catch(error => ({
        proxy,
        status: 'failed' as const,
        error: error.message,
        tests: { basic: false, wagayaHome: false, wagayaDetail: false }
      }))
    );
    
    return Promise.all(promises);
  }
  
  private updateProgress() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const rate = Math.round(this.tested / elapsed);
    const eta = Math.round((this.totalProxies - this.tested) / rate);
    
    process.stdout.write(
      `\r[${this.tested}/${this.totalProxies}] ` +
      `✅ ${this.working.length} working | ` +
      `⚡ ${rate}/s | ` +
      `⏱️  ETA: ${eta}s` +
      '     '
    );
  }
  
  private totalProxies: number = 0;
  
  async testProxies(proxies: string[]): Promise<ProxyResult[]> {
    this.totalProxies = proxies.length;
    this.startTime = Date.now();
    this.tested = 0;
    this.working = [];
    this.results = [];
    
    console.log(`🚀 Testing ${proxies.length} proxies with ${this.concurrency} concurrent workers\n`);
    
    // Process in batches
    for (let i = 0; i < proxies.length; i += this.concurrency) {
      const batch = proxies.slice(i, Math.min(i + this.concurrency, proxies.length));
      const batchResults = await this.processBatch(batch);
      
      this.results.push(...batchResults);
      this.tested += batch.length;
      
      // Track working proxies
      const workingInBatch = batchResults.filter(r => r.status === 'working');
      this.working.push(...workingInBatch.map(r => r.proxy));
      
      this.updateProgress();
      
      // Save progress every 100 proxies
      if (this.tested % 100 === 0 || this.tested === proxies.length) {
        this.saveProgress();
      }
    }
    
    console.log('\n'); // New line after progress
    return this.results;
  }
  
  private saveProgress() {
    if (this.working.length > 0) {
      const progressFile = 'src/lib/scrapers/data/working-proxies-progress.txt';
      const content = [
        `# Working proxies - Progress update`,
        `# Tested: ${this.tested}/${this.totalProxies}`,
        `# Found: ${this.working.length} working`,
        `# Time: ${new Date().toISOString()}`,
        '',
        ...this.working
      ].join('\n');
      
      fs.writeFileSync(progressFile, content);
    }
  }
  
  generateReport(results: ProxyResult[], outputDir: string) {
    const working = results.filter(r => r.status === 'working');
    const partial = results.filter(r => r.status === 'partial');
    const failed = results.filter(r => r.status === 'failed');
    
    const elapsed = (Date.now() - this.startTime) / 1000;
    
    console.log('\n📊 Final Results:');
    console.log('=================');
    console.log(`Total tested: ${results.length}`);
    console.log(`✅ Fully working: ${working.length} (${((working.length/results.length)*100).toFixed(1)}%)`);
    console.log(`⚠️  Partial: ${partial.length} (${((partial.length/results.length)*100).toFixed(1)}%)`);
    console.log(`❌ Failed: ${failed.length} (${((failed.length/results.length)*100).toFixed(1)}%)`);
    console.log(`⏱️  Total time: ${elapsed.toFixed(1)}s`);
    console.log(`⚡ Average rate: ${Math.round(results.length/elapsed)} proxies/s`);
    
    // Save working proxies
    if (working.length > 0) {
      // Sort by response time
      working.sort((a, b) => (a.responseTime || 9999) - (b.responseTime || 9999));
      
      console.log(`\n✅ Top 10 fastest working proxies:`);
      working.slice(0, 10).forEach((r, i) => {
        console.log(`${i + 1}. ${r.proxy} (${r.responseTime}ms)`);
      });
      
      // Save all working proxies
      const workingFile = path.join(outputDir, 'wagaya-working-proxies.txt');
      const workingContent = [
        '# Working proxies for Wagaya Japan',
        `# Tested: ${new Date().toISOString()}`,
        `# Found: ${working.length}/${results.length} working`,
        `# Success rate: ${((working.length/results.length)*100).toFixed(1)}%`,
        '',
        ...working.map(r => `${r.proxy} # ${r.responseTime}ms`)
      ].join('\n');
      
      fs.writeFileSync(workingFile, workingContent);
      console.log(`\n💾 Saved ${working.length} working proxies to: ${workingFile}`);
      
      // Save top performers separately
      const topFile = path.join(outputDir, 'top-proxies.txt');
      const topContent = [
        '# Top performing proxies for Wagaya Japan',
        `# Updated: ${new Date().toISOString()}`,
        '',
        ...working.slice(0, 50).map(r => r.proxy)
      ].join('\n');
      
      fs.writeFileSync(topFile, topContent);
      console.log(`💾 Saved top 50 proxies to: ${topFile}`);
    }
    
    // Save detailed report
    const reportFile = path.join(outputDir, 'proxy-test-report.json');
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: results.length,
        working: working.length,
        partial: partial.length,
        failed: failed.length,
        successRate: ((working.length/results.length)*100).toFixed(1) + '%',
        testDuration: elapsed.toFixed(1) + 's',
        averageRate: Math.round(results.length/elapsed) + ' proxies/s'
      },
      workingProxies: working.map(r => ({
        proxy: r.proxy,
        responseTime: r.responseTime
      })),
      errors: failed.slice(0, 100).map(r => ({
        proxy: r.proxy,
        error: r.error
      }))
    };
    
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`📄 Saved detailed report to: ${reportFile}`);
  }
}

// Main function
async function main() {
  const inputFile = process.argv[2] || 'src/lib/scrapers/data/proxytest.txt';
  const concurrency = parseInt(process.argv[3] || '50');
  
  console.log('🔍 Bulk Proxy Tester for Wagaya Japan');
  console.log('=====================================\n');
  
  // Load proxies
  let proxies: string[];
  try {
    const content = fs.readFileSync(inputFile, 'utf-8');
    proxies = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && line.includes(':'))
      .filter((proxy, index, self) => self.indexOf(proxy) === index); // Remove duplicates
  } catch (error) {
    console.error(`❌ Failed to load proxies from ${inputFile}`);
    process.exit(1);
  }
  
  if (proxies.length === 0) {
    console.log('⚠️  No proxies found in file');
    process.exit(1);
  }
  
  console.log(`📋 Loaded ${proxies.length} unique proxies from ${inputFile}`);
  console.log(`⚡ Concurrency: ${concurrency} parallel tests`);
  console.log(`⏱️  Timeout: 10s per proxy\n`);
  
  // Create output directory
  const outputDir = path.dirname(inputFile);
  
  // Run tests
  const tester = new BulkProxyTester(concurrency);
  const results = await tester.testProxies(proxies);
  
  // Generate report
  tester.generateReport(results, outputDir);
  
  // Update main proxy list if we found good ones
  const working = results.filter(r => r.status === 'working');
  if (working.length >= 5) {
    const mainProxyFile = path.join(outputDir, 'proxilist.txt');
    const mainContent = [
      '# Working proxies for Wagaya Japan',
      `# Last verified: ${new Date().toISOString().split('T')[0]}`,
      '# These proxies have been tested and confirmed to work',
      '',
      ...working.slice(0, 20).map(r => r.proxy)
    ].join('\n');
    
    fs.writeFileSync(mainProxyFile, mainContent);
    console.log(`\n✅ Updated main proxy list with ${Math.min(working.length, 20)} best proxies`);
  }
}

main().catch(console.error);