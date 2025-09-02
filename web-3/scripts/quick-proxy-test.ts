#!/usr/bin/env tsx

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

async function quickProxyTest() {
  const inputFile = process.argv[2] || path.join(process.cwd(), 'src/lib/scrapers/data/proxypool.txt');
  
  // Load proxies
  const content = fs.readFileSync(inputFile, 'utf-8');
  const proxies = content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#') && line.includes(':'));
  
  console.log(`Testing ${proxies.length} proxies...\n`);
  
  const working: string[] = [];
  
  // Quick test - just check if proxy responds
  for (const proxy of proxies) {
    const [host, port] = proxy.split(':');
    process.stdout.write(`${proxy}... `);
    
    try {
      // First, quick test with httpbin
      await axios.get('http://httpbin.org/ip', {
        timeout: 5000,
        proxy: {
          host,
          port: parseInt(port),
          protocol: 'http'
        }
      });
      
      // If that works, test with Wagaya
      await axios.get('https://wagaya-japan.com/en/', {
        timeout: 8000,
        proxy: {
          host,
          port: parseInt(port),
          protocol: 'http'
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      console.log('✅ WORKING');
      working.push(proxy);
      
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        console.log('❌ Refused');
      } else if (error.code === 'ECONNABORTED') {
        console.log('⏱️  Timeout');
      } else if (error.message?.includes('redirect')) {
        console.log('🔄 Redirects');
      } else {
        console.log('❌ Failed');
      }
    }
  }
  
  console.log(`\n✅ Working: ${working.length}/${proxies.length}`);
  
  if (working.length > 0) {
    console.log('\nWorking proxies:');
    working.forEach(p => console.log(`- ${p}`));
    
    // Save to file
    fs.writeFileSync(
      inputFile.replace('proxytest.txt', 'working-proxies.txt'),
      working.join('\n')
    );
  }
}

quickProxyTest().catch(console.error);