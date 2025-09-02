import { NextResponse } from 'next/server';

export async function GET() {
  console.log('[Test Metro Node-Fetch] Starting test...');
  
  const results: any = {
    timestamp: new Date().toISOString(),
    tests: {}
  };

  // Test 1: Use global fetch with minimal headers
  try {
    console.log('[Test 1] Global fetch...');
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
    
    results.tests.globalFetch = {
      status: response1.status,
      ok: response1.ok,
    };
    
    if (response1.ok) {
      const data = await response1.json();
      results.tests.globalFetch.unitCount = data.units?.length || 0;
    } else {
      results.tests.globalFetch.error = await response1.text();
    }
  } catch (error: any) {
    results.tests.globalFetch = { error: error.message };
  }

  // Test 2: Try importing and using node-fetch explicitly
  try {
    console.log('[Test 2] Explicit node-fetch...');
    const nodeFetch = await import('node-fetch').then(m => m.default).catch(() => null);
    
    if (nodeFetch) {
      const response2 = await nodeFetch('https://www.metroresidences.com/api/mbp/building', {
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
      
      results.tests.nodeFetch = {
        status: response2.status,
        ok: response2.ok,
      };
      
      if (response2.ok) {
        const data = await response2.json();
        results.tests.nodeFetch.unitCount = data.units?.length || 0;
      } else {
        results.tests.nodeFetch.error = await response2.text();
      }
    } else {
      results.tests.nodeFetch = { error: 'node-fetch not available' };
    }
  } catch (error: any) {
    results.tests.nodeFetch = { error: error.message };
  }

  // Test 3: Test the scraper with the updated minimal headers
  try {
    console.log('[Test 3] Updated scraper...');
    const { UnifiedMetroResidencesScraper } = await import('~/lib/scrapers/sources/metro-residences-scraper');
    const scraper = new UnifiedMetroResidencesScraper();
    const scraperResult = await scraper.search({ limit: 1 });
    
    results.tests.scraper = {
      success: scraperResult.success,
      error: scraperResult.error,
      dataCount: scraperResult.data?.length || 0,
    };
  } catch (error: any) {
    results.tests.scraper = { error: error.message };
  }

  console.log('[Test Metro Node-Fetch] Results:', JSON.stringify(results, null, 2));
  
  return NextResponse.json(results);
}