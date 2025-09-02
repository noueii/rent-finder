import { NextResponse } from 'next/server';

export async function GET() {
  console.log('[Metro Diagnostic] Starting comprehensive test...');
  
  const results: any = {
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      nodeVersion: process.version,
      headers: {},
    },
    tests: {}
  };

  // Test 1: Try with absolute minimal headers
  try {
    console.log('[Test 1] Minimal headers test...');
    const response1 = await fetch('https://www.metroresidences.com/api/mbp/building', {
      method: 'POST',
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
    
    results.tests.minimal = {
      status: response1.status,
      statusText: response1.statusText,
      headers: Object.fromEntries(response1.headers.entries()),
    };
    
    if (!response1.ok) {
      results.tests.minimal.error = await response1.text();
    } else {
      const data = await response1.json();
      results.tests.minimal.dataCount = data.units?.length || 0;
    }
  } catch (error: any) {
    results.tests.minimal = { error: error.message, stack: error.stack };
  }

  // Test 2: Try with different fetch implementations
  try {
    console.log('[Test 2] Node.js https module test...');
    const https = await import('https');
    const postData = JSON.stringify({
      price: "0,150000",
      size: "25,165",
      view: "grid-view",
      countryCode: "jp",
      languageCode: "en",
      distance: "2.5km",
      curPage: 1,
      perPage: 24
    });

    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'www.metroresidences.com',
        path: '/api/mbp/building',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data.substring(0, 200)
          });
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    results.tests.nodeHttps = result;
  } catch (error: any) {
    results.tests.nodeHttps = { error: error.message };
  }

  // Test 3: Check DNS resolution
  try {
    console.log('[Test 3] DNS resolution test...');
    const dns = await import('dns').then(m => m.promises);
    const addresses = await dns.resolve4('www.metroresidences.com');
    results.tests.dns = { addresses };
  } catch (error: any) {
    results.tests.dns = { error: error.message };
  }

  // Test 4: Test with axios (if available)
  try {
    console.log('[Test 4] Axios test...');
    const axios = await import('axios').catch(() => null);
    if (axios) {
      const response = await axios.default.post(
        'https://www.metroresidences.com/api/mbp/building',
        {
          price: "0,150000",
          size: "25,165",
          view: "grid-view",
          countryCode: "jp",
          languageCode: "en",
          distance: "2.5km",
          curPage: 1,
          perPage: 24
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          validateStatus: () => true, // Don't throw on any status
        }
      );
      
      results.tests.axios = {
        status: response.status,
        statusText: response.statusText,
        dataCount: response.data?.units?.length || 0,
      };
    } else {
      results.tests.axios = { error: 'axios not available' };
    }
  } catch (error: any) {
    results.tests.axios = { error: error.message, code: error.code };
  }

  // Test 5: Check if we can access their main site
  try {
    console.log('[Test 5] Main site accessibility test...');
    const mainSiteResponse = await fetch('https://www.metroresidences.com/robots.txt');
    results.tests.mainSite = {
      status: mainSiteResponse.status,
      accessible: mainSiteResponse.ok,
    };
  } catch (error: any) {
    results.tests.mainSite = { error: error.message };
  }

  // Test 6: Try with a delay
  try {
    console.log('[Test 6] Delayed request test...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
    
    const response6 = await fetch('https://www.metroresidences.com/api/mbp/building', {
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
    
    results.tests.delayed = {
      status: response6.status,
      success: response6.ok,
    };
  } catch (error: any) {
    results.tests.delayed = { error: error.message };
  }

  console.log('[Metro Diagnostic] Complete results:', JSON.stringify(results, null, 2));
  
  return NextResponse.json(results);
}