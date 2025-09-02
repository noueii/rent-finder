import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

interface ProxyTestResult {
  proxy: string;
  status: 'working' | 'failed' | 'timeout';
  responseTime?: number;
  error?: string;
}

async function testProxy(proxyString: string, timeout: number = 5000): Promise<ProxyTestResult> {
  const [host, port] = proxyString.split(':');
  const testUrl = 'http://httpbin.org/ip'; // Simple test endpoint that returns your IP
  
  const startTime = Date.now();
  
  try {
    const response = await axios.get(testUrl, {
      timeout,
      proxy: {
        host,
        port: parseInt(port),
        protocol: 'http'
      },
      validateStatus: () => true, // Accept any status
    });
    
    const responseTime = Date.now() - startTime;
    
    if (response.status === 200) {
      return {
        proxy: proxyString,
        status: 'working',
        responseTime
      };
    } else {
      return {
        proxy: proxyString,
        status: 'failed',
        error: `HTTP ${response.status}`
      };
    }
  } catch (error: any) {
    return {
      proxy: proxyString,
      status: error.code === 'ECONNABORTED' ? 'timeout' : 'failed',
      error: error.message
    };
  }
}

async function validateProxies() {
  console.log('🔍 Proxy Validation Test\n');
  
  // Load proxies from file
  const proxyFile = './src/lib/scrapers/data/proxilist.txt';
  const content = fs.readFileSync(proxyFile, 'utf-8');
  const lines = content.split('\n').filter(line => {
    const trimmed = line.trim();
    return trimmed && 
           !trimmed.startsWith('#') && 
           !trimmed.toLowerCase().includes('free proxies') &&
           !trimmed.toLowerCase().includes('updated at') &&
           trimmed.includes(':');
  });
  
  console.log(`📋 Found ${lines.length} proxies to test\n`);
  
  // Test first 10 proxies to see if any work
  const testCount = Math.min(10, lines.length);
  console.log(`🧪 Testing first ${testCount} proxies...\n`);
  
  const results: ProxyTestResult[] = [];
  
  for (let i = 0; i < testCount; i++) {
    const proxy = lines[i].trim();
    process.stdout.write(`[${i + 1}/${testCount}] Testing ${proxy}... `);
    
    const result = await testProxy(proxy);
    results.push(result);
    
    if (result.status === 'working') {
      console.log(`✅ WORKING! (${result.responseTime}ms)`);
    } else if (result.status === 'timeout') {
      console.log(`⏱️  TIMEOUT`);
    } else {
      console.log(`❌ FAILED: ${result.error}`);
    }
  }
  
  // Summary
  console.log('\n📊 Summary:');
  const working = results.filter(r => r.status === 'working');
  const failed = results.filter(r => r.status === 'failed');
  const timeout = results.filter(r => r.status === 'timeout');
  
  console.log(`✅ Working: ${working.length}/${testCount}`);
  console.log(`❌ Failed: ${failed.length}/${testCount}`);
  console.log(`⏱️  Timeout: ${timeout.length}/${testCount}`);
  
  if (working.length > 0) {
    console.log('\n🎯 Working proxies:');
    working.forEach(p => {
      console.log(`   - ${p.proxy} (${p.responseTime}ms)`);
    });
  }
  
  // Test with a working proxy on Wagaya
  if (working.length > 0) {
    console.log('\n🧪 Testing first working proxy with Wagaya Japan...');
    const workingProxy = working[0];
    const [host, port] = workingProxy.proxy.split(':');
    
    try {
      const response = await axios.get('https://wagaya-japan.com/en/', {
        timeout: 10000,
        proxy: {
          host,
          port: parseInt(port),
          protocol: 'http'
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      console.log(`✅ Successfully accessed Wagaya Japan via proxy ${workingProxy.proxy}`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Content length: ${response.data.length} bytes`);
    } catch (error: any) {
      console.log(`❌ Failed to access Wagaya Japan: ${error.message}`);
    }
  }
  
  // Suggestion
  if (working.length === 0) {
    console.log('\n⚠️  No working proxies found!');
    console.log('Consider:');
    console.log('1. Getting fresh proxy list from a reliable source');
    console.log('2. Using premium proxies for better reliability');
    console.log('3. Running without proxies for now');
  } else {
    console.log(`\n💡 Found ${working.length} working proxies out of ${testCount} tested`);
    console.log('You may want to:');
    console.log('1. Test all proxies and keep only working ones');
    console.log('2. Use proxy validation before scraping');
    console.log('3. Implement automatic proxy health checks');
  }
}

validateProxies().catch(console.error);