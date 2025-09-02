import axios from 'axios';

async function testBasicFetch() {
  console.log('🧪 Testing basic network connectivity to Wagaya Japan\n');
  
  const testUrl = 'https://wagaya-japan.com/en/chintai_detail.php?id=2600102';
  
  // Test 1: Direct fetch without proxy
  console.log('1️⃣ Testing direct connection (no proxy)...');
  try {
    const start = Date.now();
    const response = await axios.get(testUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });
    const time = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`✅ Direct connection successful! (${time}s)`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Content length: ${response.data.length} bytes`);
  } catch (error: any) {
    console.log(`❌ Direct connection failed: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
    }
  }
  
  // Test 2: Try with a sample proxy
  console.log('\n2️⃣ Testing with first proxy from list...');
  try {
    // Read first proxy from file
    const fs = await import('fs');
    const proxyFile = './src/lib/scrapers/data/proxilist.txt';
    const content = fs.readFileSync(proxyFile, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    
    if (lines.length > 0) {
      const firstProxy = lines[0].trim();
      const [host, port] = firstProxy.split(':');
      console.log(`   Using proxy: ${host}:${port}`);
      
      const start = Date.now();
      const response = await axios.get(testUrl, {
        timeout: 10000,
        proxy: {
          host: host,
          port: parseInt(port),
          protocol: 'http'
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }
      });
      const time = ((Date.now() - start) / 1000).toFixed(2);
      console.log(`✅ Proxy connection successful! (${time}s)`);
      console.log(`   Status: ${response.status}`);
    } else {
      console.log('❌ No proxies found in file');
    }
  } catch (error: any) {
    console.log(`❌ Proxy connection failed: ${error.message}`);
  }
  
  // Test 3: Check if we're being blocked
  console.log('\n3️⃣ Checking response headers for blocking...');
  try {
    const response = await axios.head(testUrl, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });
    console.log('📋 Response headers:');
    Object.entries(response.headers).forEach(([key, value]) => {
      if (key.toLowerCase().includes('cloudflare') || 
          key.toLowerCase().includes('cf-') ||
          key.toLowerCase().includes('block') ||
          key.toLowerCase().includes('captcha')) {
        console.log(`   ⚠️  ${key}: ${value}`);
      }
    });
  } catch (error: any) {
    console.log(`❌ HEAD request failed: ${error.message}`);
  }
}

testBasicFetch().catch(console.error);