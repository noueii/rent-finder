#!/usr/bin/env node

/**
 * Simple test to check Wagaya Japan scraper headers
 * This tests the enhanced headers without needing a full build
 */

import axios from 'axios';

// Simulate the enhanced headers
const enhancedHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'en-US,en;q=0.9,ja;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'max-age=0',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Referer': 'https://wagaya-japan.com/en/',
  'DNT': '1',
  'Connection': 'keep-alive',
};

// Old headers for comparison
const oldHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en,ja;q=0.9',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
};

async function testHeaders(headers, label) {
  console.log(`\nTesting ${label}:`);
  console.log('Headers:', Object.keys(headers).length, 'headers');
  
  try {
    const response = await axios.get('https://wagaya-japan.com/en/rent/tokyo/list/', {
      headers,
      timeout: 10000,
      maxRedirects: 0,
      validateStatus: (status) => status < 500, // Don't throw on 4xx
    });
    
    console.log(`✅ Response status: ${response.status}`);
    console.log(`Response headers:`, Object.keys(response.headers).join(', '));
    
    if (response.status === 403) {
      console.log('⚠️  403 Forbidden - May be blocked');
    } else if (response.status === 200) {
      console.log('✅ 200 OK - Request successful');
      // Check for signs of blocking in content
      const content = response.data.substring(0, 500);
      if (content.includes('captcha') || content.includes('blocked')) {
        console.log('⚠️  Possible captcha or blocking detected in content');
      }
    }
    
  } catch (error) {
    if (error.response) {
      console.log(`❌ Response status: ${error.response.status}`);
    } else {
      console.log(`❌ Request failed:`, error.message);
    }
  }
}

console.log('Wagaya Japan Header Test\n');
console.log('Testing different header configurations...');

// Test old headers
await testHeaders(oldHeaders, 'OLD HEADERS (minimal)');

// Wait 3 seconds
console.log('\nWaiting 3 seconds...');
await new Promise(resolve => setTimeout(resolve, 3000));

// Test enhanced headers
await testHeaders(enhancedHeaders, 'ENHANCED HEADERS (comprehensive)');

console.log('\n\nSummary:');
console.log('- Enhanced headers include', Object.keys(enhancedHeaders).length - Object.keys(oldHeaders).length, 'additional headers');
console.log('- Key additions: Sec-Ch-Ua headers, Sec-Fetch headers, Referer, DNT, Connection');
console.log('- These make the request appear more like a real browser');