#!/usr/bin/env node

import axios from 'axios';
import httpProxyAgent from 'http-proxy-agent';
import httpsProxyAgent from 'https-proxy-agent';

const { HttpProxyAgent } = httpProxyAgent;
const { HttpsProxyAgent } = httpsProxyAgent;

// Test configuration
const TEST_URL = 'https://wagaya-japan.com/en/';
const PROXY_HOST = '156.242.43.120';
const PROXY_PORT = '3129';

console.log('Testing HTTP proxy with Wagaya endpoint...');
console.log(`Proxy: ${PROXY_HOST}:${PROXY_PORT}`);
console.log(`Target URL: ${TEST_URL}`);
console.log('---');

// Test 1: Direct request (no proxy)
console.log('\n1. Testing direct request (no proxy):');
try {
  const startDirect = Date.now();
  const directResponse = await axios.get(TEST_URL, {
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });
  console.log(`✓ Success - Status: ${directResponse.status}, Time: ${Date.now() - startDirect}ms`);
  console.log(`  Content length: ${directResponse.data.length} bytes`);
} catch (error) {
  console.log(`✗ Failed - ${error.message}`);
}

// Test 2: HTTP proxy with HttpsProxyAgent (recommended for HTTPS sites)
console.log('\n2. Testing with HttpsProxyAgent:');
try {
  const proxyUrl = `http://${PROXY_HOST}:${PROXY_PORT}`;
  const httpsAgent = new HttpsProxyAgent(proxyUrl);
  
  const startProxy1 = Date.now();
  const proxyResponse1 = await axios.get(TEST_URL, {
    httpsAgent,
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });
  console.log(`✓ Success - Status: ${proxyResponse1.status}, Time: ${Date.now() - startProxy1}ms`);
  console.log(`  Content length: ${proxyResponse1.data.length} bytes`);
  console.log(`  Title found: ${proxyResponse1.data.includes('<title>') ? 'Yes' : 'No'}`);
} catch (error) {
  console.log(`✗ Failed - ${error.message}`);
  if (error.code) console.log(`  Error code: ${error.code}`);
}

// Test 3: HTTP proxy with axios proxy config
console.log('\n3. Testing with axios proxy config:');
try {
  const startProxy2 = Date.now();
  const proxyResponse2 = await axios.get(TEST_URL, {
    proxy: {
      protocol: 'http',
      host: PROXY_HOST,
      port: parseInt(PROXY_PORT),
    },
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });
  console.log(`✓ Success - Status: ${proxyResponse2.status}, Time: ${Date.now() - startProxy2}ms`);
  console.log(`  Content length: ${proxyResponse2.data.length} bytes`);
} catch (error) {
  console.log(`✗ Failed - ${error.message}`);
  if (error.code) console.log(`  Error code: ${error.code}`);
}

// Test 4: Check what the proxy sees (using httpbin)
console.log('\n4. Testing proxy IP detection:');
try {
  const proxyUrl = `http://${PROXY_HOST}:${PROXY_PORT}`;
  const httpsAgent = new HttpsProxyAgent(proxyUrl);
  
  const ipResponse = await axios.get('https://api.ipify.org?format=json', {
    httpsAgent,
    timeout: 10000,
  });
  console.log(`✓ Proxy IP: ${ipResponse.data.ip}`);
} catch (error) {
  console.log(`✗ Failed to get proxy IP - ${error.message}`);
}

console.log('\nTest completed!');