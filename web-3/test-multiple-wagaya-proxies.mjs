#!/usr/bin/env node

import axios from 'axios';
import httpsProxyAgent from 'https-proxy-agent';
import fs from 'fs';

const { HttpsProxyAgent } = httpsProxyAgent;

// Read first 10 proxies from file
const proxies = fs.readFileSync('./src/lib/scrapers/data/proxyscrape_premium_http_proxies.txt', 'utf-8')
  .split('\n')
  .filter(line => line.trim())
  .slice(0, 10);

const TEST_URL = 'https://wagaya-japan.com/en/';

console.log(`Testing ${proxies.length} HTTP proxies with Wagaya...`);
console.log(`Target URL: ${TEST_URL}`);
console.log('---\n');

const results = [];

for (const proxy of proxies) {
  const [host, port] = proxy.trim().split(':');
  process.stdout.write(`Testing ${host}:${port}... `);
  
  try {
    const proxyUrl = `http://${host}:${port}`;
    const agent = new HttpsProxyAgent(proxyUrl);
    
    const startTime = Date.now();
    const response = await axios.get(TEST_URL, {
      httpsAgent: agent,
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    
    const time = Date.now() - startTime;
    console.log(`✓ SUCCESS (${time}ms)`);
    results.push({ proxy, status: 'success', time });
  } catch (error) {
    console.log(`✗ FAILED (${error.code || error.message})`);
    results.push({ proxy, status: 'failed', error: error.code || error.message });
  }
}

// Summary
console.log('\n--- Summary ---');
const successful = results.filter(r => r.status === 'success');
console.log(`Success rate: ${successful.length}/${results.length} (${Math.round(successful.length/results.length*100)}%)`);

if (successful.length > 0) {
  const avgTime = Math.round(successful.reduce((sum, r) => sum + r.time, 0) / successful.length);
  console.log(`Average response time: ${avgTime}ms`);
  console.log('\nWorking proxies:');
  successful.forEach(r => console.log(`  ${r.proxy} - ${r.time}ms`));
}