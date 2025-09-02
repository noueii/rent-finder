import fs from 'fs';
import https from 'https';
import http from 'http';
import { URL } from 'url';

async function testProxy(proxy) {
  const startTime = Date.now();
  const [proxyHost, proxyPort] = proxy.split(':');
  
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({
        proxy,
        success: false,
        error: 'Timeout after 10 seconds'
      });
    }, 10000);

    const targetUrl = 'https://realestate.co.jp/en';
    const parsedUrl = new URL(targetUrl);
    
    const connectOptions = {
      host: proxyHost,
      port: parseInt(proxyPort),
      method: 'CONNECT',
      path: `${parsedUrl.hostname}:443`,
      headers: {
        'Host': `${parsedUrl.hostname}:443`,
        'Proxy-Connection': 'keep-alive'
      }
    };

    const connectReq = http.request(connectOptions);
    
    connectReq.on('connect', (res, socket) => {
      if (res.statusCode !== 200) {
        clearTimeout(timeout);
        socket.destroy();
        resolve({
          proxy,
          success: false,
          error: `CONNECT failed with status ${res.statusCode}`
        });
        return;
      }

      const httpsOptions = {
        socket: socket,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'Host': parsedUrl.hostname,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Connection': 'close'
        }
      };

      const httpsReq = https.request(httpsOptions, (httpsRes) => {
        clearTimeout(timeout);
        const responseTime = Date.now() - startTime;
        
        if (httpsRes.statusCode >= 200 && httpsRes.statusCode < 400) {
          resolve({
            proxy,
            success: true,
            responseTime,
            statusCode: httpsRes.statusCode
          });
        } else {
          resolve({
            proxy,
            success: false,
            responseTime,
            statusCode: httpsRes.statusCode,
            error: `HTTP ${httpsRes.statusCode}`
          });
        }
        
        httpsRes.on('data', () => {});
        httpsRes.on('end', () => socket.destroy());
      });

      httpsReq.on('error', (err) => {
        clearTimeout(timeout);
        socket.destroy();
        resolve({
          proxy,
          success: false,
          error: err.message
        });
      });

      httpsReq.end();
    });

    connectReq.on('error', (err) => {
      clearTimeout(timeout);
      resolve({
        proxy,
        success: false,
        error: err.message
      });
    });

    connectReq.end();
  });
}

async function testProxiesInBatches(proxies, batchSize = 10) {
  const results = [];
  
  for (let i = 0; i < proxies.length; i += batchSize) {
    const batch = proxies.slice(i, i + batchSize);
    console.log(`\nTesting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(proxies.length / batchSize)} (${batch.length} proxies)...`);
    
    const batchResults = await Promise.all(batch.map(proxy => testProxy(proxy)));
    results.push(...batchResults);
    
    const successCount = results.filter(r => r.success).length;
    console.log(`Progress: ${results.length}/${proxies.length} tested, ${successCount} working`);
    
    if (i + batchSize < proxies.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

async function main() {
  console.log('🔍 RealEstate.co.jp Proxy Tester');
  console.log('=================================\n');
  
  const proxyFile = '/home/noueii/workspace/github.com/noueii/rent-finder/web-3/src/lib/scrapers/data/proxilist.txt';
  const content = fs.readFileSync(proxyFile, 'utf-8');
  
  const proxies = content
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  console.log(`📋 Found ${proxies.length} proxies to test`);
  console.log(`🎯 Target: realestate.co.jp`);
  console.log(`⏱️  Timeout: 10 seconds per proxy\n`);
  
  const startTime = Date.now();
  
  const results = await testProxiesInBatches(proxies, 20);
  
  const workingProxies = results.filter(r => r.success);
  const failedProxies = results.filter(r => !r.success);
  
  console.log('\n📊 Test Results:');
  console.log('================');
  console.log(`✅ Working: ${workingProxies.length}/${proxies.length} (${((workingProxies.length / proxies.length) * 100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${failedProxies.length}/${proxies.length} (${((failedProxies.length / proxies.length) * 100).toFixed(1)}%)`);
  console.log(`⏱️  Total time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  
  workingProxies.sort((a, b) => (a.responseTime || 0) - (b.responseTime || 0));
  
  console.log('\n🚀 Top 10 Fastest Proxies:');
  console.log('==========================');
  workingProxies.slice(0, 10).forEach((result, index) => {
    console.log(`${index + 1}. ${result.proxy} - ${result.responseTime}ms (HTTP ${result.statusCode})`);
  });
  
  const errorTypes = {};
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
  
  const workingProxiesFile = '/home/noueii/workspace/github.com/noueii/rent-finder/web-3/working-realestate-proxies.txt';
  const workingProxiesContent = [
    '# Working proxies for RealEstate.co.jp',
    `# Tested: ${new Date().toISOString()}`,
    `# Success rate: ${workingProxies.length}/${proxies.length} (${((workingProxies.length / proxies.length) * 100).toFixed(1)}%)`,
    '',
    ...workingProxies.map(r => `${r.proxy} # ${r.responseTime}ms`)
  ].join('\n');
  
  fs.writeFileSync(workingProxiesFile, workingProxiesContent);
  console.log(`\n💾 Saved ${workingProxies.length} working proxies to: ${workingProxiesFile}`);
}

main().catch(console.error);