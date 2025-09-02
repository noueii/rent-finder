// Debug Metro Residences in actual Next.js app environment
import { spawn } from 'child_process';
import fetch from 'node-fetch';

console.log('=== Metro Residences Debug in Next.js App ===\n');

// First, let's check if the server is running and what port
async function findNextJsPort() {
  const ports = [3000, 3001, 3002];
  for (const port of ports) {
    try {
      const response = await fetch(`http://localhost:${port}/api/trpc`);
      if (response.ok || response.status === 404 || response.status === 401) {
        console.log(`✓ Next.js server found on port ${port}`);
        return port;
      }
    } catch (e) {
      // Port not in use
    }
  }
  return null;
}

// Test the Metro API directly from this process first
async function testDirectAPI() {
  console.log('1. Testing Metro API directly...');
  
  try {
    const response = await fetch('https://www.metroresidences.com/api/mbp/building', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        price: "0,150000",
        size: "25,165",
        view: "grid-view",
        countryCode: "jp",
        languageCode: "en",
        distance: "2.5km",
        curPage: 1,
        perPage: 24
      }),
    });
    
    console.log('   Status:', response.status);
    console.log('   Headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.status === 500) {
      const text = await response.text();
      console.log('   500 Error:', text.substring(0, 200));
    }
  } catch (error) {
    console.error('   Error:', error.message);
  }
}

// Create a test API route that we can call
async function createTestRoute(port) {
  console.log('\n2. Creating test API route...');
  
  const testRouteContent = `
import { NextResponse } from 'next/server';

export async function GET() {
  console.log('[Test Route] Called');
  
  try {
    // Test 1: Direct fetch
    const response1 = await fetch('https://www.metroresidences.com/api/mbp/building', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        price: "0,150000",
        size: "25,165",
        view: "grid-view",
        countryCode: "jp",
        languageCode: "en",
        distance: "2.5km",
        curPage: 1,
        perPage: 24
      }),
    });
    
    const status1 = response1.status;
    let error1 = null;
    if (!response1.ok) {
      error1 = await response1.text();
    }
    
    // Test 2: Using the scraper
    let scraperResult = null;
    let scraperError = null;
    try {
      const { MetroResidencesScraper } = await import('~/lib/scrapers/sources/metro-residences-scraper');
      const scraper = new MetroResidencesScraper();
      scraperResult = await scraper.search({ limit: 1 });
    } catch (e) {
      scraperError = e.message;
    }
    
    return NextResponse.json({
      directFetch: {
        status: status1,
        error: error1,
      },
      scraper: {
        result: scraperResult,
        error: scraperError,
      },
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: process.env.VERCEL,
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
`;

  try {
    await fetch(`http://localhost:${port}/`, {
      method: 'GET',
      headers: {
        'X-Test-Route-Content': Buffer.from(testRouteContent).toString('base64')
      }
    });
  } catch (e) {
    // Expected to fail, just warming up
  }
}

// Call our test route
async function callTestRoute(port) {
  console.log('\n3. Testing through Next.js API route...');
  
  try {
    const response = await fetch(`http://localhost:${port}/api/test-metro`, {
      method: 'GET',
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('   Test route response:', JSON.stringify(data, null, 2));
    } else {
      console.log('   Test route not found, trying scraper search endpoint...');
      
      // Try the admin endpoint without auth to at least see the error
      const scraperResponse = await fetch(`http://localhost:${port}/api/admin/test-scraper`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scraperType: 'metro-residences',
          params: { limit: 1 }
        }),
      });
      
      console.log('   Admin endpoint status:', scraperResponse.status);
      const text = await scraperResponse.text();
      console.log('   Response:', text.substring(0, 200));
    }
  } catch (error) {
    console.error('   Error:', error.message);
  }
}

// Test the scraper in a subprocess
async function testInSubprocess() {
  console.log('\n4. Testing scraper in subprocess...');
  
  return new Promise((resolve) => {
    const child = spawn('node', ['-e', `
      const { MetroResidencesScraper } = require('./src/lib/scrapers/sources/metro-residences-scraper.ts');
      const scraper = new MetroResidencesScraper();
      
      scraper.search({ limit: 1 })
        .then(result => {
          console.log('Subprocess result:', JSON.stringify(result, null, 2));
        })
        .catch(error => {
          console.error('Subprocess error:', error.message);
        });
    `], {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: 'production' }
    });
    
    child.stdout.on('data', (data) => {
      console.log('   ', data.toString().trim());
    });
    
    child.stderr.on('data', (data) => {
      console.error('   Error:', data.toString().trim());
    });
    
    child.on('close', () => {
      resolve();
    });
  });
}

// Check network differences
async function checkNetworkDifferences() {
  console.log('\n5. Checking network configuration...');
  
  // Check if we can reach the API host
  const { Resolver } = await import('dns').then(m => m.promises);
  const resolver = new Resolver();
  
  try {
    const addresses = await resolver.resolve4('www.metroresidences.com');
    console.log('   DNS resolution:', addresses);
  } catch (e) {
    console.error('   DNS error:', e.message);
  }
  
  // Check TLS/SSL
  const https = await import('https');
  const agent = new https.Agent({
    rejectUnauthorized: false, // For testing only
  });
  
  try {
    const response = await fetch('https://www.metroresidences.com/api/mbp/building', {
      method: 'POST',
      agent,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        price: "0,150000",
        size: "25,165",
        view: "grid-view",
        countryCode: "jp",
        languageCode: "en",
        distance: "2.5km",
        curPage: 1,
        perPage: 24
      }),
    });
    
    console.log('   With custom agent status:', response.status);
  } catch (error) {
    console.error('   Custom agent error:', error.message);
  }
}

// Main debug flow
async function runDebug() {
  const port = await findNextJsPort();
  
  if (!port) {
    console.error('❌ Next.js server not found. Please start it with: npm run dev');
    return;
  }
  
  await testDirectAPI();
  await createTestRoute(port);
  await callTestRoute(port);
  // await testInSubprocess();
  await checkNetworkDifferences();
  
  console.log('\n=== Diagnosis ===');
  console.log('If Direct API works (200) but scraper fails (500):');
  console.log('1. Next.js might be modifying fetch behavior');
  console.log('2. There might be a proxy or middleware intercepting requests');
  console.log('3. The Node.js version or fetch polyfill might differ');
  console.log('4. Environment variables might be affecting the request');
  
  console.log('\nTry these solutions:');
  console.log('1. Set NODE_TLS_REJECT_UNAUTHORIZED=0 (temporarily)');
  console.log('2. Use a different HTTP client (axios, got, node-fetch)');
  console.log('3. Check if you have any Next.js middleware affecting API routes');
  console.log('4. Try deploying to Vercel/production to see if it\'s a local issue');
}

runDebug().catch(console.error);