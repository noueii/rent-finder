import { NextResponse } from 'next/server';

export async function GET() {
  console.log('[Test Metro Route] Starting tests...');
  
  const results: any = {
    timestamp: new Date().toISOString(),
    tests: {}
  };
  
  // Test 1: Direct fetch with minimal headers
  try {
    console.log('[Test 1] Direct fetch with minimal headers...');
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
    
    results.tests.minimalHeaders = {
      status: response1.status,
      headers: Object.fromEntries(response1.headers.entries()),
      error: response1.status !== 200 ? await response1.text() : null,
    };
  } catch (error: any) {
    results.tests.minimalHeaders = { error: error.message };
  }
  
  // Test 2: With full headers
  try {
    console.log('[Test 2] Direct fetch with full headers...');
    const response2 = await fetch('https://www.metroresidences.com/api/mbp/building', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://www.metroresidences.com',
        'Referer': 'https://www.metroresidences.com/jp-en/apartment-rental/',
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
    
    results.tests.fullHeaders = {
      status: response2.status,
      error: response2.status !== 200 ? await response2.text() : null,
    };
  } catch (error: any) {
    results.tests.fullHeaders = { error: error.message };
  }
  
  // Test 3: Using the scraper
  try {
    console.log('[Test 3] Using Metro Residences scraper...');
    const { UnifiedMetroResidencesScraper } = await import('~/lib/scrapers/sources/metro-residences-scraper');
    const scraper = new UnifiedMetroResidencesScraper();
    const scraperResult = await scraper.search({ limit: 1 });
    
    results.tests.scraper = {
      success: scraperResult.success,
      error: scraperResult.error,
      dataCount: scraperResult.data?.length || 0,
    };
  } catch (error: any) {
    results.tests.scraper = { error: error.message, stack: error.stack };
  }
  
  // Test 4: Check fetch implementation
  results.environment = {
    nodeVersion: process.version,
    fetchType: typeof fetch,
    fetchName: fetch.name,
    fetchConstructor: fetch.constructor.name,
    nextjsVersion: process.env.NEXT_RUNTIME,
    isDevelopment: process.env.NODE_ENV === 'development',
  };
  
  // Test 5: Try with undici fetch if available
  try {
    console.log('[Test 5] Trying with undici fetch...');
    const { fetch: undiciFetch } = await import('undici');
    const response5 = await undiciFetch('https://www.metroresidences.com/api/mbp/building', {
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
    
    results.tests.undiciFetch = {
      status: response5.status,
      error: response5.status !== 200 ? await response5.text() : null,
    };
  } catch (error: any) {
    results.tests.undiciFetch = { error: error.message };
  }
  
  console.log('[Test Metro Route] Results:', JSON.stringify(results, null, 2));
  
  return NextResponse.json(results);
}