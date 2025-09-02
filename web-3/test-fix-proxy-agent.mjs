import axios from 'axios';
import pkg from 'https-proxy-agent';
const { HttpsProxyAgent } = pkg;
import fs from 'fs';

async function testProxyWithAgent(proxyString) {
  try {
    const startTime = Date.now();
    const proxyUrl = `http://${proxyString}`;
    
    // Create proxy agent
    const httpsAgent = new HttpsProxyAgent(proxyUrl);
    
    const response = await axios.get('https://realestate.co.jp/en/rent/search/Search?prefecture=JP-13&city=13000', {
      httpsAgent: httpsAgent,
      httpAgent: httpsAgent,
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      maxRedirects: 5,
      validateStatus: function (status) {
        return status >= 200 && status < 400;
      }
    });
    
    const responseTime = Date.now() - startTime;
    
    return {
      proxy: proxyString,
      success: true,
      responseTime,
      statusCode: response.status,
      dataLength: response.data.length
    };
  } catch (error) {
    return {
      proxy: proxyString,
      success: false,
      error: error.message,
      code: error.code
    };
  }
}

async function main() {
  console.log('🔍 Testing Proxies with HTTPS Proxy Agent');
  console.log('=========================================\n');
  
  const proxyFile = '/home/noueii/workspace/github.com/noueii/rent-finder/web-3/src/lib/scrapers/data/proxilist.txt';
  const content = fs.readFileSync(proxyFile, 'utf-8');
  
  const proxies = content
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .slice(0, 10); // Test first 10 proxies
  
  console.log(`Testing ${proxies.length} proxies with https-proxy-agent...\n`);
  
  let successCount = 0;
  
  for (const proxy of proxies) {
    console.log(`Testing ${proxy}...`);
    const result = await testProxyWithAgent(proxy);
    
    if (result.success) {
      successCount++;
      console.log(`✅ Success: ${result.responseTime}ms, Status: ${result.statusCode}, Data: ${result.dataLength} bytes`);
    } else {
      console.log(`❌ Failed: ${result.error} (${result.code})`);
    }
  }
  
  console.log(`\n\nSummary: ${successCount}/${proxies.length} proxies working`);
}

main().catch(console.error);