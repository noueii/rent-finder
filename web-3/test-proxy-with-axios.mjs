import axios from 'axios';
import fs from 'fs';

async function testProxyWithAxios(proxyString) {
  const [host, port] = proxyString.split(':');
  
  try {
    const startTime = Date.now();
    
    const response = await axios.get('https://realestate.co.jp/en/rent/search/Search?prefecture=JP-13&city=13000', {
      proxy: {
        host: host,
        port: parseInt(port),
        protocol: 'http'
      },
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
        return status >= 200 && status < 400; // Accept redirects
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
  console.log('🔍 Testing Proxy Configuration with Axios');
  console.log('=========================================\n');
  
  // Read a few proxies from the file
  const proxyFile = '/home/noueii/workspace/github.com/noueii/rent-finder/web-3/src/lib/scrapers/data/proxilist.txt';
  const content = fs.readFileSync(proxyFile, 'utf-8');
  
  const proxies = content
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .slice(0, 5); // Test just first 5 proxies
  
  console.log(`Testing ${proxies.length} proxies with axios...\n`);
  
  for (const proxy of proxies) {
    console.log(`Testing ${proxy}...`);
    const result = await testProxyWithAxios(proxy);
    
    if (result.success) {
      console.log(`✅ Success: ${result.responseTime}ms, Status: ${result.statusCode}, Data: ${result.dataLength} bytes`);
    } else {
      console.log(`❌ Failed: ${result.error} (${result.code})`);
    }
    console.log('');
  }
  
  // Test with https-proxy-agent instead
  console.log('\n\nNow testing with different proxy configuration...\n');
  
  // Test using proxy as part of URL (different approach)
  const testProxy = proxies[0];
  const [host, port] = testProxy.split(':');
  
  try {
    console.log(`Testing ${testProxy} with modified config...`);
    
    const httpsAgent = new (await import('https-proxy-agent')).HttpsProxyAgent(`http://${testProxy}`);
    
    const response = await axios.get('https://realestate.co.jp/en/rent/search/Search?prefecture=JP-13&city=13000', {
      httpsAgent: httpsAgent,
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });
    
    console.log(`✅ Success with https-proxy-agent! Status: ${response.status}`);
  } catch (error) {
    console.log(`❌ Failed with https-proxy-agent: ${error.message}`);
  }
}

main().catch(console.error);