import * as fs from 'fs';
import * as https from 'https';
import httpsProxyAgent from 'https-proxy-agent';

const { HttpsProxyAgent } = httpsProxyAgent;

interface ProxyTestResult {
  proxy: string;
  success: boolean;
  responseTime?: number;
  statusCode?: number;
  error?: string;
}

async function testProxy(proxy: string): Promise<ProxyTestResult> {
  const startTime = Date.now();
  const proxyUrl = `http://${proxy}`;
  
  try {
    const agent = new HttpsProxyAgent(proxyUrl);
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          proxy,
          success: false,
          error: 'Timeout after 10 seconds'
        });
      }, 10000);

      const options = {
        hostname: 'realestate.co.jp',
        path: '/en/rent/search/Search?prefecture=JP-13&city=13000',
        method: 'GET',
        agent: agent,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      };

      const req = https.request(options, (res) => {
        clearTimeout(timeout);
        
        const responseTime = Date.now() - startTime;
        
        // Check if we got a successful response
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
          resolve({
            proxy,
            success: true,
            responseTime,
            statusCode: res.statusCode
          });
        } else {
          resolve({
            proxy,
            success: false,
            responseTime,
            statusCode: res.statusCode,
            error: `HTTP ${res.statusCode}`
          });
        }
        
        // Consume response data to free up memory
        res.on('data', () => {});
        res.on('end', () => {});
      });

      req.on('error', (err) => {
        clearTimeout(timeout);
        resolve({
          proxy,
          success: false,
          error: err.message
        });
      });

      req.end();
    });
  } catch (error) {
    return {
      proxy,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function testProxiesInBatches(proxies: string[], batchSize: number = 10): Promise<ProxyTestResult[]> {
  const results: ProxyTestResult[] = [];
  
  for (let i = 0; i < proxies.length; i += batchSize) {
    const batch = proxies.slice(i, i + batchSize);
    console.log(`\nTesting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(proxies.length / batchSize)} (${batch.length} proxies)...`);
    
    const batchResults = await Promise.all(batch.map(proxy => testProxy(proxy)));
    results.push(...batchResults);
    
    // Show progress
    const successCount = results.filter(r => r.success).length;
    console.log(`Progress: ${results.length}/${proxies.length} tested, ${successCount} working`);
    
    // Small delay between batches to avoid overwhelming
    if (i + batchSize < proxies.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

async function main() {
  console.log('🔍 RealEstate.co.jp Proxy Tester');
  console.log('=================================\n');
  
  // Read HTTP proxy list
  const proxyFile = 'src/lib/scrapers/data/proxyscrape_premium_http_proxies.txt';
  console.log(`📂 Reading proxies from: ${proxyFile}`);
  const content = fs.readFileSync(proxyFile, 'utf-8');
  
  // Parse proxies (skip comments and empty lines)
  const allProxies = content
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(line => line.trim());
  
  // Test first 200 proxies for now
  const proxies = allProxies.slice(0, 200);
  
  console.log(`📋 Found ${allProxies.length} total proxies`);
  console.log(`🧪 Testing first ${proxies.length} proxies`);
  console.log(`🎯 Target: realestate.co.jp`);
  console.log(`⏱️  Timeout: 10 seconds per proxy\n`);
  
  const startTime = Date.now();
  
  // Test proxies in batches
  const results = await testProxiesInBatches(proxies, 20);
  
  // Analyze results
  const workingProxies = results.filter(r => r.success);
  const failedProxies = results.filter(r => !r.success);
  
  console.log('\n📊 Test Results:');
  console.log('================');
  console.log(`✅ Working: ${workingProxies.length}/${proxies.length} (${((workingProxies.length / proxies.length) * 100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${failedProxies.length}/${proxies.length} (${((failedProxies.length / proxies.length) * 100).toFixed(1)}%)`);
  console.log(`⏱️  Total time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  
  // Sort working proxies by response time
  workingProxies.sort((a, b) => (a.responseTime || 0) - (b.responseTime || 0));
  
  // Show top 10 fastest proxies
  console.log('\n🚀 Top 10 Fastest Proxies:');
  console.log('==========================');
  workingProxies.slice(0, 10).forEach((result, index) => {
    console.log(`${index + 1}. ${result.proxy} - ${result.responseTime}ms (HTTP ${result.statusCode})`);
  });
  
  // Error analysis
  const errorTypes: { [key: string]: number } = {};
  failedProxies.forEach(result => {
    const error = result.error || 'Unknown';
    errorTypes[error] = (errorTypes[error] || 0) + 1;
  });
  
  console.log('\n❌ Error Analysis:');
  console.log('==================');
  Object.entries(errorTypes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([error, count]) => {
      console.log(`${error}: ${count} proxies`);
    });
  
  // Save working proxies to a new file
  const workingProxiesFile = 'working-realestate-http-proxies.txt';
  const workingProxiesContent = workingProxies.map(r => r.proxy).join('\n');
  
  fs.writeFileSync(workingProxiesFile, workingProxiesContent);
  console.log(`\n💾 Saved ${workingProxies.length} working proxies to: ${workingProxiesFile}`);
  
  // Also create a detailed report
  const reportFile = 'realestate-proxy-test-report.txt';
  const reportContent = [
    '# RealEstate.co.jp HTTP Proxy Test Report',
    `# Tested: ${new Date().toISOString()}`,
    `# Success rate: ${workingProxies.length}/${proxies.length} (${((workingProxies.length / proxies.length) * 100).toFixed(1)}%)`,
    '',
    '## Working Proxies (sorted by speed):',
    ...workingProxies.map((r, i) => `${i + 1}. ${r.proxy} - ${r.responseTime}ms`),
    '',
    '## Failed Proxies by Error:',
    ...Object.entries(errorTypes).map(([error, count]) => `- ${error}: ${count} proxies`)
  ].join('\n');
  
  fs.writeFileSync(reportFile, reportContent);
  console.log(`📄 Detailed report saved to: ${reportFile}`);
}

// Run the test
main().catch(console.error);