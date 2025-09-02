import axios from 'axios';
import * as fs from 'fs';

async function testProxyWithWagaya(proxyString: string): Promise<boolean> {
  const [host, port] = proxyString.split(':');
  const testUrl = 'https://wagaya-japan.com/en/';
  
  try {
    const response = await axios.get(testUrl, {
      timeout: 8000,
      proxy: {
        host,
        port: parseInt(port),
        protocol: 'http'
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Upgrade-Insecure-Requests': '1',
      },
      maxRedirects: 5,
      validateStatus: (status) => status < 500, // Accept redirects
    });
    
    return response.status === 200 && response.data.includes('wagaya');
  } catch (error) {
    return false;
  }
}

async function findWorkingProxies() {
  console.log('🔍 Finding proxies that work with Wagaya Japan\n');
  
  // Load all proxies
  const proxyFile = './src/lib/scrapers/data/proxilist.txt';
  const content = fs.readFileSync(proxyFile, 'utf-8');
  const proxies = content.split('\n').filter(line => {
    const trimmed = line.trim();
    return trimmed && 
           !trimmed.startsWith('#') && 
           !trimmed.toLowerCase().includes('free proxies') &&
           !trimmed.toLowerCase().includes('updated at') &&
           trimmed.includes(':');
  });
  
  console.log(`📋 Testing ${proxies.length} proxies with Wagaya Japan`);
  console.log('⏳ This may take a while...\n');
  
  const workingProxies: string[] = [];
  const batchSize = 10;
  
  // Test in batches to avoid overwhelming
  for (let i = 0; i < proxies.length; i += batchSize) {
    const batch = proxies.slice(i, Math.min(i + batchSize, proxies.length));
    console.log(`\nTesting batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(proxies.length/batchSize)}...`);
    
    const promises = batch.map(async (proxy) => {
      const works = await testProxyWithWagaya(proxy);
      if (works) {
        console.log(`✅ WORKS: ${proxy}`);
        workingProxies.push(proxy);
      }
      return works;
    });
    
    await Promise.all(promises);
    
    // If we found at least 5 working proxies, that's enough for testing
    if (workingProxies.length >= 5) {
      console.log('\n🎯 Found enough working proxies for testing!');
      break;
    }
  }
  
  console.log('\n📊 Results:');
  console.log(`✅ Working with Wagaya: ${workingProxies.length}/${proxies.length} tested`);
  
  if (workingProxies.length > 0) {
    console.log('\n🎯 Working proxies for Wagaya Japan:');
    workingProxies.forEach((p, i) => {
      console.log(`${i + 1}. ${p}`);
    });
    
    // Save working proxies to a new file
    const outputFile = './src/lib/scrapers/data/wagaya-working-proxies.txt';
    fs.writeFileSync(outputFile, workingProxies.join('\n'));
    console.log(`\n💾 Saved ${workingProxies.length} working proxies to ${outputFile}`);
  } else {
    console.log('\n⚠️  No proxies work with Wagaya Japan!');
    console.log('\nPossible reasons:');
    console.log('1. Free proxies are often blocked by websites');
    console.log('2. Wagaya may have strong anti-bot protection');
    console.log('3. The proxies might be geographically restricted');
    console.log('\nRecommendations:');
    console.log('1. Use premium residential proxies');
    console.log('2. Use rotating proxies with Japanese IPs');
    console.log('3. Consider using a proxy service like ScraperAPI or Bright Data');
  }
}

findWorkingProxies().catch(console.error);