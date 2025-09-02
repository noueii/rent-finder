import axios from 'axios';
import httpsProxyAgent from 'https-proxy-agent';
import * as fs from 'fs';

const { HttpsProxyAgent } = httpsProxyAgent;

async function testSingleProxy(proxy: string) {
  console.log(`\nTesting proxy: ${proxy}`);
  
  try {
    const agent = new HttpsProxyAgent(`http://${proxy}`);
    
    const response = await axios.get('https://realestate.co.jp/en/rent/view/1254309', {
      httpsAgent: agent,
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en,ja;q=0.9',
      }
    });
    
    console.log(`✅ SUCCESS! Status: ${response.status}, Size: ${response.data.length} bytes`);
    return true;
  } catch (error: any) {
    console.log(`❌ FAILED: ${error.code || error.message}`);
    if (error.response) {
      console.log(`   Response status: ${error.response.status}`);
    }
    return false;
  }
}

async function main() {
  console.log('🧪 Simple RealEstate Proxy Test\n');
  
  // Test the known working proxy from earlier
  const knownWorkingProxy = '156.242.43.120:3129';
  console.log('1️⃣ Testing known working proxy first:');
  await testSingleProxy(knownWorkingProxy);
  
  // Test a few from the file
  console.log('\n2️⃣ Testing proxies from file:');
  const proxyFile = 'src/lib/scrapers/data/proxyscrape_premium_http_proxies.txt';
  const proxies = fs.readFileSync(proxyFile, 'utf-8')
    .split('\n')
    .filter(line => line.trim())
    .slice(0, 5); // Just test first 5
  
  let workingCount = 0;
  for (const proxy of proxies) {
    const works = await testSingleProxy(proxy);
    if (works) workingCount++;
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`\n📊 Results: ${workingCount}/${proxies.length} proxies working`);
  
  // Also test without proxy to ensure the site is accessible
  console.log('\n3️⃣ Testing direct connection (no proxy):');
  try {
    const response = await axios.get('https://realestate.co.jp/en/rent/view/1254309', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en,ja;q=0.9',
      }
    });
    console.log(`✅ Direct connection works! Status: ${response.status}`);
  } catch (error: any) {
    console.log(`❌ Direct connection failed: ${error.code || error.message}`);
  }
}

main().catch(console.error);