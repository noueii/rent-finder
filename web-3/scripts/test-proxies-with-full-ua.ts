#!/usr/bin/env tsx

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';
import { UserAgentRotator } from '../src/lib/scrapers/utils/user-agent-rotator';

interface ProxyTestResult {
  proxy: string;
  status: 'working' | 'failed' | 'timeout';
  responseTime?: number;
  statusCode?: number;
  error?: string;
  userAgent?: string;
}

class WagayaProxyTesterWithUA {
  private inputFile: string;
  private outputFile: string;
  private testUrls: string[] = [
    'https://wagaya-japan.com/en/',
    'https://wagaya-japan.com/en/chintai_detail.php?id=2600102',
  ];
  private timeout: number = 15000; // 15 seconds
  private userAgentRotator: UserAgentRotator;
  
  constructor(inputFile: string) {
    this.inputFile = inputFile;
    this.outputFile = inputFile.replace('proxytest.txt', 'wagaya-verified-proxies.txt');
    this.userAgentRotator = new UserAgentRotator();
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
   * Test a single proxy with full Wagaya headers and UA rotation
   */
  private async testProxy(proxyString: string): Promise<ProxyTestResult> {
    const [host, port] = proxyString.split(':');
    const startTime = performance.now();
    
    // Get rotated user agent and headers
    const headers = this.userAgentRotator.buildHeaders(undefined, true);
    const userAgent = headers['User-Agent'];
    
    // Add Wagaya-specific headers
    const wagayaHeaders = {
      ...headers,
      'Referer': 'https://wagaya-japan.com/en/',
      'Origin': 'https://wagaya-japan.com',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Upgrade-Insecure-Requests': '1',
      'Connection': 'keep-alive',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
    };
    
    try {
      // Test both URLs to ensure the proxy works for different pages
      for (const testUrl of this.testUrls) {
        const response = await axios.get(testUrl, {
          timeout: this.timeout,
          proxy: {
            host,
            port: parseInt(port),
            protocol: 'http'
          },
          headers: wagayaHeaders,
          maxRedirects: 5,
          validateStatus: (status) => status < 500,
          decompress: true,
        });
        
        // Check if we got valid Wagaya content
        if (response.status !== 200 || !response.data.includes('wagaya')) {
          return {
            proxy: proxyString,
            status: 'failed',
            statusCode: response.status,
            error: `Invalid response from ${testUrl} (${response.status})`,
            userAgent
          };
        }
      }
      
      const responseTime = Math.round(performance.now() - startTime);
      
      return {
        proxy: proxyString,
        status: 'working',
        responseTime,
        statusCode: 200,
        userAgent
      };
      
    } catch (error: any) {
      const responseTime = Math.round(performance.now() - startTime);
      
      return {
        proxy: proxyString,
        status: error.code === 'ECONNABORTED' ? 'timeout' : 'failed',
        responseTime,
        error: error.message,
        userAgent
      };
    }
  }
  
  /**
   * Test proxies one by one with detailed output
   */
  private async testProxiesSequentially(proxies: string[]): Promise<ProxyTestResult[]> {
    const results: ProxyTestResult[] = [];
    
    for (let i = 0; i < proxies.length; i++) {
      const proxy = proxies[i];
      process.stdout.write(`[${i + 1}/${proxies.length}] Testing ${proxy}... `);
      
      const result = await this.testProxy(proxy);
      results.push(result);
      
      if (result.status === 'working') {
        console.log(`✅ WORKING! (${result.responseTime}ms)`);
      } else if (result.status === 'timeout') {
        console.log(`⏱️  TIMEOUT (${result.responseTime}ms)`);
      } else {
        console.log(`❌ FAILED: ${result.error}`);
      }
    }
    
    return results;
  }
  
  /**
   * Verify working proxies with additional tests
   */
  private async verifyWorkingProxies(workingProxies: ProxyTestResult[]): Promise<ProxyTestResult[]> {
    console.log('\n🔄 Verifying working proxies with additional tests...\n');
    
    const verified: ProxyTestResult[] = [];
    
    for (const proxyResult of workingProxies) {
      process.stdout.write(`Verifying ${proxyResult.proxy}... `);
      
      // Test 3 times to ensure consistency
      let successCount = 0;
      let totalTime = 0;
      
      for (let i = 0; i < 3; i++) {
        const testResult = await this.testProxy(proxyResult.proxy);
        if (testResult.status === 'working') {
          successCount++;
          totalTime += testResult.responseTime || 0;
        }
      }
      
      if (successCount >= 2) {
        console.log(`✅ Verified (${successCount}/3 successful)`);
        verified.push({
          ...proxyResult,
          responseTime: Math.round(totalTime / successCount)
        });
      } else {
        console.log(`❌ Unreliable (${successCount}/3 successful)`);
      }
    }
    
    return verified;
  }
  
  /**
   * Run the proxy test
   */
  async run() {
    console.log('🔍 Wagaya Japan Proxy Tester with Full User Agent Rotation');
    console.log('==========================================================\n');
    
    // Load proxies
    const proxies = this.loadProxies();
    if (proxies.length === 0) {
      console.log(`⚠️  No proxies found in ${this.inputFile}`);
      return;
    }
    
    console.log(`📋 Loaded ${proxies.length} proxies from ${this.inputFile}`);
    console.log(`🧪 Testing against Wagaya Japan with full headers`);
    console.log(`🔄 Using 288 user agent combinations (24 browsers × 12 languages)`);
    console.log(`⏱️  Timeout: ${this.timeout}ms per proxy\n`);
    
    const startTime = performance.now();
    
    // Test all proxies
    const results = await this.testProxiesSequentially(proxies);
    
    // Get working proxies
    const working = results.filter(r => r.status === 'working');
    
    // Verify working proxies
    let verified: ProxyTestResult[] = [];
    if (working.length > 0) {
      verified = await this.verifyWorkingProxies(working);
    }
    
    const totalTime = Math.round((performance.now() - startTime) / 1000);
    
    // Analyze results
    const failed = results.filter(r => r.status === 'failed');
    const timeout = results.filter(r => r.status === 'timeout');
    
    // Display results
    console.log('\n📊 Final Results');
    console.log('================');
    console.log(`✅ Working: ${working.length}/${proxies.length} (${((working.length/proxies.length)*100).toFixed(1)}%)`);
    console.log(`✅ Verified: ${verified.length}/${working.length} (${working.length > 0 ? ((verified.length/working.length)*100).toFixed(1) : 0}%)`);
    console.log(`❌ Failed: ${failed.length}/${proxies.length}`);
    console.log(`⏱️  Timeout: ${timeout.length}/${proxies.length}`);
    console.log(`⏰ Total test time: ${totalTime}s\n`);
    
    if (verified.length > 0) {
      console.log('✅ Verified Working Proxies:');
      console.log('===========================');
      verified
        .sort((a, b) => (a.responseTime || 9999) - (b.responseTime || 9999))
        .forEach((result, index) => {
          console.log(`${index + 1}. ${result.proxy}`);
          console.log(`   Response time: ${result.responseTime}ms`);
          console.log(`   User Agent: ${result.userAgent?.substring(0, 50)}...`);
        });
      
      // Save verified proxies
      const verifiedProxiesContent = [
        '# Verified working proxies for Wagaya Japan',
        `# Tested: ${new Date().toISOString()}`,
        `# Success rate: ${verified.length}/${proxies.length} (${((verified.length/proxies.length)*100).toFixed(1)}%)`,
        '# These proxies passed multiple verification tests with full UA rotation',
        '',
        ...verified.map(r => `${r.proxy} # ${r.responseTime}ms`)
      ].join('\n');
      
      fs.writeFileSync(this.outputFile, verifiedProxiesContent);
      console.log(`\n💾 Saved ${verified.length} verified proxies to: ${this.outputFile}`);
      
      // Update the main proxy list if we found good ones
      if (verified.length >= 2) {
        const mainProxyFile = path.join(path.dirname(this.inputFile), 'proxilist.txt');
        const mainProxyContent = [
          '# Working proxies for Wagaya Japan',
          `# Last verified: ${new Date().toISOString().split('T')[0]}`,
          '# These proxies have been tested and confirmed to work',
          '',
          ...verified.slice(0, 10).map(r => r.proxy) // Keep top 10
        ].join('\n');
        
        fs.writeFileSync(mainProxyFile, mainProxyContent);
        console.log(`💾 Updated main proxy list with top ${Math.min(verified.length, 10)} proxies`);
      }
    } else {
      console.log('⚠️  No reliable proxies found!\n');
      
      // Show why they failed
      console.log('🔍 Failure Analysis:');
      const errorTypes = new Map<string, number>();
      
      failed.forEach(result => {
        const errorKey = result.error?.includes('ECONNREFUSED') ? 'Connection refused' :
                        result.error?.includes('ETIMEDOUT') ? 'Connection timeout' :
                        result.error?.includes('ENOTFOUND') ? 'Host not found' :
                        result.error?.includes('redirect') ? 'Too many redirects' :
                        result.error?.includes('Invalid response') ? 'Invalid response' :
                        'Other error';
        errorTypes.set(errorKey, (errorTypes.get(errorKey) || 0) + 1);
      });
      
      errorTypes.forEach((count, error) => {
        console.log(`- ${error}: ${count} proxies`);
      });
      
      console.log('\nRecommendations:');
      console.log('1. Try proxies from Japan or Asia regions');
      console.log('2. Use HTTPS-capable proxies');
      console.log('3. Consider residential proxies for better success rates');
      console.log('4. Test with premium proxy services');
    }
  }
}

// Run the tester
async function main() {
  const inputFile = path.join(process.cwd(), 'src/lib/scrapers/data/proxytest.txt');
  const tester = new WagayaProxyTesterWithUA(inputFile);
  
  try {
    await tester.run();
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

main();