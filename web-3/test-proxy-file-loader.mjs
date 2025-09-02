#!/usr/bin/env node

/**
 * Test script to verify proxy file loading functionality
 */

import { ProxyManager } from './dist/lib/scrapers/utils/proxy-manager.js';
import fs from 'fs';
import path from 'path';

console.log('Proxy File Loader Test\n');
console.log('======================\n');

// Test loading from the proxilist.txt file
const proxyFile = 'src/lib/scrapers/data/proxilist.txt';
const fullPath = path.resolve(process.cwd(), proxyFile);

console.log(`📁 Checking proxy file: ${proxyFile}`);
console.log(`   Full path: ${fullPath}`);

if (fs.existsSync(fullPath)) {
  console.log('✅ File exists!\n');
  
  // Read file stats
  const stats = fs.statSync(fullPath);
  const lines = fs.readFileSync(fullPath, 'utf-8').split('\n');
  const nonEmptyLines = lines.filter(line => line.trim() && !line.trim().startsWith('#'));
  
  console.log('📊 File Statistics:');
  console.log(`   File size: ${(stats.size / 1024).toFixed(2)} KB`);
  console.log(`   Total lines: ${lines.length}`);
  console.log(`   Non-empty lines: ${nonEmptyLines.length}`);
  console.log(`   Last modified: ${stats.mtime.toLocaleString()}`);
  
  // Test parsing some proxies
  console.log('\n🔍 Sample Proxies (first 10):');
  let count = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && 
        !trimmed.toLowerCase().includes('free proxies') && 
        !trimmed.toLowerCase().includes('updated at')) {
      console.log(`   ${count + 1}. ${trimmed}`);
      count++;
      if (count >= 10) break;
    }
  }
  
  // Test ProxyManager loading
  console.log('\n🔧 Testing ProxyManager.loadFromFile():');
  const proxies = ProxyManager.loadFromFile(proxyFile);
  console.log(`   ✅ Loaded ${proxies.length} proxies successfully!`);
  
  if (proxies.length > 0) {
    console.log('\n📋 First 5 parsed proxies:');
    proxies.slice(0, 5).forEach((proxy, i) => {
      console.log(`   ${i + 1}. ${proxy.protocol}://${proxy.host}:${proxy.port}`);
    });
  }
  
  // Test creating ProxyManager instance
  console.log('\n🔄 Testing ProxyManager with loaded proxies:');
  const manager = new ProxyManager({
    proxies: proxies,
    rotationStrategy: 'random'
  });
  
  console.log(`   Total proxies: ${manager.getAvailableCount()}`);
  console.log(`   Has proxies: ${manager.hasProxies()}`);
  
  // Test getting some proxies
  console.log('\n🎲 Testing proxy rotation (5 random selections):');
  for (let i = 0; i < 5; i++) {
    const proxy = manager.getNextProxy();
    if (proxy) {
      console.log(`   ${i + 1}. ${proxy.host}:${proxy.port}`);
    }
  }
  
} else {
  console.log('❌ File not found!');
  console.log('\nMake sure the proxy file exists at:');
  console.log(`   ${fullPath}`);
}

console.log('\n📝 Usage Notes:');
console.log('   • By default, scrapers will automatically load from proxilist.txt');
console.log('   • You can override with PROXY_FILE environment variable');
console.log('   • Free proxies may have low success rates - consider premium proxies for production');
console.log('   • The system will automatically blacklist failing proxies');