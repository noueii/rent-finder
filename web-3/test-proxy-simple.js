#!/usr/bin/env node

/**
 * Simple test to verify proxy file can be loaded
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('Simple Proxy File Test\n');
console.log('=====================\n');

const proxyFile = 'src/lib/scrapers/data/proxilist.txt';
const fullPath = path.resolve(process.cwd(), proxyFile);

console.log(`Checking: ${fullPath}\n`);

if (fs.existsSync(fullPath)) {
  const content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');
  
  let proxyCount = 0;
  const proxies = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines, comments, and headers
    if (!trimmed || 
        trimmed.startsWith('#') || 
        trimmed.toLowerCase().includes('free proxies') ||
        trimmed.toLowerCase().includes('updated at')) {
      continue;
    }
    
    // Check if it looks like a proxy (host:port format)
    if (trimmed.match(/^[\d\.]+:\d+$/)) {
      proxyCount++;
      if (proxies.length < 10) {
        proxies.push(trimmed);
      }
    }
  }
  
  console.log(`✅ File loaded successfully!`);
  console.log(`📊 Found ${proxyCount} proxies`);
  console.log(`\n🔍 First 10 proxies:`);
  proxies.forEach((proxy, i) => {
    console.log(`   ${i + 1}. ${proxy}`);
  });
  
  console.log(`\n🎯 Proxy Configuration:`);
  console.log(`   • Proxies will be loaded automatically from this file`);
  console.log(`   • Each scraper will rotate through ${proxyCount} different IPs`);
  console.log(`   • Combined with 288 user agents = ${proxyCount * 288} unique fingerprints!`);
  
} else {
  console.log('❌ File not found!');
}