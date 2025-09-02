#!/usr/bin/env tsx

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { UserAgentRotator } from '../src/lib/scrapers/utils/user-agent-rotator';

interface ProxyTestResult {
  proxy: string;
  httpbin: boolean;
  wagayaHome: boolean;
  wagayaDetail: boolean;
  avgResponseTime?: number;
  error?: string;
}

class WagayaProxyTester {
  private userAgentRotator = new UserAgentRotator();
  
  async testProxy(proxyString: string): Promise<ProxyTestResult> {
    const [host, port] = proxyString.split(':');
    const result: ProxyTestResult = {
      proxy: proxyString,
      httpbin: false,
      wagayaHome: false,
      wagayaDetail: false
    };
    
    const proxyConfig = {
      host,
      port: parseInt(port),
      protocol: 'http' as const
    };
    
    // Get full headers like our scraper uses
    const headers = this.userAgentRotator.buildHeaders(undefined, true);
    const wagayaHeaders = {
      ...headers,
      'Referer': 'https://wagaya-japan.com/en/',
      'Origin': 'https://wagaya-japan.com',
    };
    
    const times: number[] = [];
    
    try {
      // Test 1: Basic connectivity with httpbin
      const start1 = Date.now();
      await axios.get('http://httpbin.org/ip', {
        timeout: 5000,
        proxy: proxyConfig
      });
      result.httpbin = true;
      times.push(Date.now() - start1);
      
      // Test 2: Wagaya home page
      const start2 = Date.now();
      const homeResponse = await axios.get('https://wagaya-japan.com/en/', {
        timeout: 10000,
        proxy: proxyConfig,
        headers: wagayaHeaders,
        maxRedirects: 5,
        validateStatus: (status) => status < 500,
      });
      
      if (homeResponse.status === 200 && homeResponse.data.includes('wagaya')) {
        result.wagayaHome = true;
        times.push(Date.now() - start2);
      }
      
      // Test 3: Wagaya detail page (most important)
      const start3 = Date.now();
      const detailResponse = await axios.get(
        'https://wagaya-japan.com/en/chintai_detail.php?id=2600102',
        {
          timeout: 10000,
          proxy: proxyConfig,
          headers: wagayaHeaders,
          maxRedirects: 5,
          validateStatus: (status) => status < 500,
        }
      );
      
      if (detailResponse.status === 200 && detailResponse.data.includes('wagaya')) {
        result.wagayaDetail = true;
        times.push(Date.now() - start3);
      }
      
      if (times.length > 0) {
        result.avgResponseTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
      }
      
    } catch (error: any) {
      result.error = error.code || error.message?.substring(0, 50);
    }
    
    return result;
  }
  
  async testProxies(proxies: string[]): Promise<ProxyTestResult[]> {
    const results: ProxyTestResult[] = [];
    
    console.log('Testing proxies...\n');
    console.log('Proxy               | HTTPBin | Home | Detail | Avg Time | Status');
    console.log('-------------------|---------|------|--------|----------|--------');
    
    for (const proxy of proxies) {
      const result = await this.testProxy(proxy);
      
      const status = result.wagayaDetail ? '✅ WORKING' :
                    result.wagayaHome ? '⚠️  Partial' :
                    result.httpbin ? '🔸 Basic' :
                    '❌ Failed';
      
      console.log(
        `${proxy.padEnd(18)} | ${result.httpbin ? '✓' : '✗'}       | ${result.wagayaHome ? '✓' : '✗'}    | ${result.wagayaDetail ? '✓' : '✗'}      | ${result.avgResponseTime ? result.avgResponseTime + 'ms' : 'N/A'} | ${status}`
      );
      
      results.push(result);
    }
    
    return results;
  }
  
  async run(inputFile: string) {
    console.log('🔍 Wagaya Japan Proxy Tester');
    console.log('============================\n');
    
    // Load proxies
    let proxies: string[];
    try {
      const content = fs.readFileSync(inputFile, 'utf-8');
      proxies = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#') && line.includes(':'));
    } catch (error) {
      console.error(`❌ Failed to load proxies from ${inputFile}`);
      return;
    }
    
    if (proxies.length === 0) {
      console.log('⚠️  No proxies found in file');
      return;
    }
    
    console.log(`📋 Testing ${proxies.length} proxies\n`);
    
    const results = await this.testProxies(proxies);
    
    // Analyze results
    const fullyWorking = results.filter(r => r.wagayaDetail);
    const partiallyWorking = results.filter(r => r.wagayaHome && !r.wagayaDetail);
    const basicOnly = results.filter(r => r.httpbin && !r.wagayaHome);
    
    console.log('\n📊 Summary:');
    console.log(`✅ Fully working: ${fullyWorking.length}/${proxies.length}`);
    console.log(`⚠️  Partially working: ${partiallyWorking.length}/${proxies.length}`);
    console.log(`🔸 Basic connectivity only: ${basicOnly.length}/${proxies.length}`);
    console.log(`❌ Completely failed: ${proxies.length - fullyWorking.length - partiallyWorking.length - basicOnly.length}/${proxies.length}`);
    
    if (fullyWorking.length > 0) {
      console.log('\n✅ Fully Working Proxies (can access detail pages):');
      fullyWorking
        .sort((a, b) => (a.avgResponseTime || 9999) - (b.avgResponseTime || 9999))
        .forEach(r => {
          console.log(`- ${r.proxy} (${r.avgResponseTime}ms avg)`);
        });
      
      // Save working proxies
      const outputFile = inputFile.replace('.txt', '-working.txt');
      const content = [
        '# Working proxies for Wagaya Japan',
        `# Tested: ${new Date().toISOString()}`,
        `# ${fullyWorking.length} proxies can access detail pages`,
        '',
        ...fullyWorking.map(r => r.proxy)
      ].join('\n');
      
      fs.writeFileSync(outputFile, content);
      console.log(`\n💾 Saved ${fullyWorking.length} working proxies to: ${outputFile}`);
    }
  }
}

// Main
const inputFile = process.argv[2] || path.join(process.cwd(), 'src/lib/scrapers/data/proxytest.txt');
const tester = new WagayaProxyTester();
tester.run(inputFile).catch(console.error);