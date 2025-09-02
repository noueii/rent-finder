#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';

function splitProxyFile(inputFile: string, chunkSize: number = 100) {
  console.log(`📂 Splitting ${inputFile} into chunks of ${chunkSize}...`);
  
  // Read file
  const content = fs.readFileSync(inputFile, 'utf-8');
  const proxies = content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#') && line.includes(':'));
  
  console.log(`📋 Found ${proxies.length} proxies`);
  
  // Create chunks
  const chunks = [];
  for (let i = 0; i < proxies.length; i += chunkSize) {
    chunks.push(proxies.slice(i, i + chunkSize));
  }
  
  // Save chunks
  const dir = path.dirname(inputFile);
  const basename = path.basename(inputFile, '.txt');
  
  chunks.forEach((chunk, index) => {
    const chunkFile = path.join(dir, `${basename}-chunk-${index + 1}.txt`);
    fs.writeFileSync(chunkFile, chunk.join('\n'));
    console.log(`💾 Saved chunk ${index + 1}: ${chunkFile} (${chunk.length} proxies)`);
  });
  
  console.log(`\n✅ Split into ${chunks.length} files`);
}

// Usage
const inputFile = process.argv[2];
const chunkSize = parseInt(process.argv[3] || '100');

if (!inputFile) {
  console.log('Usage: npx tsx scripts/proxy-file-splitter.ts <input-file> [chunk-size]');
  console.log('Example: npx tsx scripts/proxy-file-splitter.ts proxies.txt 100');
  process.exit(1);
}

splitProxyFile(inputFile, chunkSize);