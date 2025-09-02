#!/usr/bin/env tsx

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';

interface ProxyTestResult {
  proxy: string;
  status: 'working' | 'failed' | 'timeout';
  responseTime?: number;
  statusCode?: number;
  error?: string;
}

class WagayaProxyTester {
  private inputFile: string;
  private outputFile: string;
  private testUrl: string = 'https://wagaya-japan.com/en/chintai_detail.php?id=2600102';
  private timeout: number = 10000; // 10 seconds
  
  constructor(inputFile: string) {
    this.inputFile = inputFile;
    this.outputFile = inputFile.replace('proxytest.txt', 'wagaya-working-proxies.txt');
  }
  
  /**
   * Load proxies from input file
   */
  private loadProxies(): string[] {
    try {
      const content = fs.readFileSync(this.inputFile, 'utf-8');
      return content
        .split('\n')
        .map(line => line.trim())
        .filter(line => {
          return line && 
                 !line.startsWith('#') && 
                 line.includes(':') &&
                 !line.toLowerCase().includes('free proxies') &&
                 !line.toLowerCase().includes('updated at');
        });
    } catch (error) {
      console.error(`❌ Failed to load proxies from ${this.inputFile}`);
      return [];
    }
  }
  
  /**
   * Test a single proxy with Wagaya Japan
   */
  private async testProxy(proxyString: string): Promise<ProxyTestResult> {
    const [host, port] = proxyString.split(':');
    const startTime = performance.now();
    
    try {
      const response = await axios.get(this.testUrl, {
        timeout: this.timeout,
        proxy: {
          host,
          port: parseInt(port),
          protocol: 'http'
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,ja;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Referer': 'https://wagaya-japan.com/en/',
        },
        maxRedirects: 5,
        validateStatus: (status) => status < 500,
      });
      
      const responseTime = Math.round(performance.now() - startTime);
      
      // Check if we got valid Wagaya content
      if (response.status === 200 && response.data.includes('wagaya')) {
        return {
          proxy: proxyString,
          status: 'working',
          responseTime,
          statusCode: response.status
        };
      } else {
        return {
          proxy: proxyString,
          status: 'failed',
          statusCode: response.status,
          error: `Invalid response (${response.status})`
        };
      }
    } catch (error: any) {
      const responseTime = Math.round(performance.now() - startTime);
      
      return {
        proxy: proxyString,
        status: error.code === 'ECONNABORTED' ? 'timeout' : 'failed',
        responseTime,
        error: error.message
      };
    }
  }
  
  /**
   * Test proxies in parallel batches
   */
  private async testBatch(proxies: string[], batchSize: number = 5): Promise<ProxyTestResult[]> {
    const results: ProxyTestResult[] = [];
    
    for (let i = 0; i < proxies.length; i += batchSize) {
      const batch = proxies.slice(i, Math.min(i + batchSize, proxies.length));
      const batchPromises = batch.map(proxy => this.testProxy(proxy));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Show progress
      const progress = Math.min(i + batchSize, proxies.length);
      console.log(`Progress: ${progress}/${proxies.length} tested`);
    }
    
    return results;
  }
  
  /**
   * Run the proxy test
   */
  async run() {
    console.log('🔍 Wagaya Japan Proxy Tester');
    console.log('============================\n');
    
    // Load proxies
    const proxies = this.loadProxies();
    if (proxies.length === 0) {
      console.log(`⚠️  No proxies found in ${this.inputFile}`);
      console.log('\nPlease add proxies to the file in the format:');
      console.log('host:port');
      console.log('Example: 123.456.789.0:8080');
      return;
    }
    
    console.log(`📋 Loaded ${proxies.length} proxies from ${this.inputFile}`);
    console.log(`🧪 Testing against: ${this.testUrl}`);
    console.log(`⏱️  Timeout: ${this.timeout}ms per proxy\n`);
    
    console.log('Testing proxies...\n');
    const startTime = performance.now();
    
    // Test all proxies
    const results = await this.testBatch(proxies);
    
    const totalTime = Math.round((performance.now() - startTime) / 1000);
    
    // Analyze results
    const working = results.filter(r => r.status === 'working');
    const failed = results.filter(r => r.status === 'failed');
    const timeout = results.filter(r => r.status === 'timeout');
    
    // Display results
    console.log('\n📊 Test Results');
    console.log('===============');
    console.log(`✅ Working: ${working.length}/${proxies.length} (${((working.length/proxies.length)*100).toFixed(1)}%)`);
    console.log(`❌ Failed: ${failed.length}/${proxies.length}`);
    console.log(`⏱️  Timeout: ${timeout.length}/${proxies.length}`);
    console.log(`⏰ Total test time: ${totalTime}s\n`);
    
    if (working.length > 0) {
      console.log('✅ Working Proxies:');
      console.log('==================');
      working
        .sort((a, b) => (a.responseTime || 9999) - (b.responseTime || 9999))
        .forEach((result, index) => {
          console.log(`${index + 1}. ${result.proxy}`);
          console.log(`   Response time: ${result.responseTime}ms`);
          console.log(`   Status code: ${result.statusCode}`);
        });
      
      // Save working proxies
      const workingProxiesContent = [
        '# Working proxies for Wagaya Japan',
        `# Tested: ${new Date().toISOString()}`,
        `# Success rate: ${working.length}/${proxies.length} (${((working.length/proxies.length)*100).toFixed(1)}%)`,
        '',
        ...working.map(r => r.proxy)
      ].join('\n');
      
      fs.writeFileSync(this.outputFile, workingProxiesContent);
      console.log(`\n💾 Saved ${working.length} working proxies to: ${this.outputFile}`);
    } else {
      console.log('⚠️  No working proxies found!\n');
      console.log('Common reasons:');
      console.log('1. Proxies may be offline or blocked');
      console.log('2. Wagaya Japan may be blocking proxy IPs');
      console.log('3. Proxies may not support HTTPS');
      console.log('\nRecommendations:');
      console.log('1. Try fresh proxies from a reliable source');
      console.log('2. Use residential or datacenter proxies from Japan');
      console.log('3. Consider premium proxy services');
    }
    
    // Show sample failures for debugging
    if (failed.length > 0) {
      console.log('\n🔍 Sample Failure Reasons (first 5):');
      failed.slice(0, 5).forEach(result => {
        console.log(`- ${result.proxy}: ${result.error}`);
      });
    }
  }
}

// Run the tester
async function main() {
  const inputFile = path.join(process.cwd(), 'src/lib/scrapers/data/proxytest.txt');
  const tester = new WagayaProxyTester(inputFile);
  
  try {
    await tester.run();
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

main();