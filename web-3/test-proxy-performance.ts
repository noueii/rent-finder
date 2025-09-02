import { WagayaJapanScraper } from './src/lib/scrapers/sources/wagaya-japan-scraper';
import { FastProxyManager } from './src/lib/scrapers/utils/fast-proxy-manager';
import { ProxyManager } from './src/lib/scrapers/utils/proxy-manager';

class ProxyPerformanceTester {
  async runPerformanceTests() {
    console.log('🚀 Proxy Performance Optimization Test');
    console.log('=====================================\n');

    // Set environment to use SOCKS proxies
    process.env.PROXY_FILE = 'src/lib/scrapers/data/proxyscrape_premium_socks_proxies.txt';

    // Test 1: Standard Proxy Manager
    await this.testStandardProxyManager();

    // Test 2: Fast Proxy Manager
    await this.testFastProxyManager();

    // Test 3: Concurrent Scraping
    await this.testConcurrentScraping();

    // Test 4: Pre-warmed Proxies
    await this.testPreWarmedProxies();
  }

  private async testStandardProxyManager() {
    console.log('📊 Test 1: Standard Proxy Manager');
    console.log('---------------------------------');

    const startTime = Date.now();
    
    try {
      const scraper = new WagayaJapanScraper({
        rateLimit: 500, // Faster rate limit
        maxRetries: 1,
        timeout: 15000,
      });

      console.log('Scraping 10 apartments with standard proxy rotation...');
      
      const result = await scraper.search({
        maxPrice: 200000,
        limit: 10,
      });

      const duration = Date.now() - startTime;
      
      if (result.success && result.data) {
        console.log(`✅ Scraped ${result.data.length} apartments in ${duration}ms`);
        console.log(`   Average time per apartment: ${(duration / result.data.length).toFixed(0)}ms`);
      } else {
        throw new Error(result.error?.message || 'Scraping failed');
      }
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
    }
    console.log('\n');
  }

  private async testFastProxyManager() {
    console.log('⚡ Test 2: Fast Proxy Manager');
    console.log('-----------------------------');

    const startTime = Date.now();
    
    try {
      // Load proxies
      const proxies = ProxyManager.loadFromFile('src/lib/scrapers/data/proxyscrape_premium_socks_proxies.txt');
      
      // Create fast proxy manager
      const fastManager = new FastProxyManager({
        proxies: proxies.slice(0, 50), // Use first 50 proxies
        rotationStrategy: 'performance',
      });

      console.log('Performing health check on 50 proxies...');
      
      // Wait a bit for initial health check
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const healthSummary = fastManager.getHealthSummary();
      console.log(`✅ Health check complete:`);
      console.log(`   Healthy proxies: ${healthSummary.healthy}/${healthSummary.total}`);
      console.log(`   Average latency: ${healthSummary.avgLatency.toFixed(0)}ms`);
      console.log(`   Top proxy: ${healthSummary.topProxy}`);
      
      // Test proxy selection speed
      console.log('\nTesting proxy selection speed...');
      const selectionStart = Date.now();
      for (let i = 0; i < 1000; i++) {
        fastManager.getNextProxy();
      }
      const selectionDuration = Date.now() - selectionStart;
      console.log(`✅ Selected 1000 proxies in ${selectionDuration}ms (${(selectionDuration / 1000).toFixed(2)}ms per selection)`);
      
      fastManager.destroy();
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
    }
    console.log('\n');
  }

  private async testConcurrentScraping() {
    console.log('🔄 Test 3: Concurrent Scraping');
    console.log('------------------------------');

    // This would require modifying WagayaJapanScraper to extend FastBaseScraper
    // For now, we'll simulate concurrent requests
    
    const startTime = Date.now();
    
    try {
      console.log('Simulating concurrent requests to 5 different pages...');
      
      const urls = [
        'https://wagaya-japan.com/en/rent/tokyo/list/?page=1',
        'https://wagaya-japan.com/en/rent/tokyo/list/?page=2',
        'https://wagaya-japan.com/en/rent/tokyo/list/?page=3',
        'https://wagaya-japan.com/en/rent/tokyo/list/?page=4',
        'https://wagaya-japan.com/en/rent/tokyo/list/?page=5',
      ];
      
      const scraper = new WagayaJapanScraper({
        rateLimit: 100, // Very fast for testing
        maxRetries: 1,
        timeout: 10000,
      });
      
      // Fetch pages concurrently
      const promises = urls.map(async (url, index) => {
        const start = Date.now();
        try {
          // Use scraper's internal fetch method
          const result = await scraper['fetchHtml'](url);
          const duration = Date.now() - start;
          return { success: true, duration, index };
        } catch (error) {
          return { success: false, duration: Date.now() - start, index, error: error.message };
        }
      });
      
      const results = await Promise.all(promises);
      const totalDuration = Date.now() - startTime;
      
      const successful = results.filter(r => r.success);
      console.log(`✅ Completed ${successful.length}/${results.length} requests in ${totalDuration}ms`);
      
      results.forEach(r => {
        const status = r.success ? '✅' : '❌';
        console.log(`   ${status} Page ${r.index + 1}: ${r.duration}ms${r.error ? ` (${r.error})` : ''}`);
      });
      
      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      console.log(`   Average request time: ${avgDuration.toFixed(0)}ms`);
      console.log(`   Speedup factor: ${(avgDuration * results.length / totalDuration).toFixed(1)}x`);
      
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
    }
    console.log('\n');
  }

  private async testPreWarmedProxies() {
    console.log('🔥 Test 4: Pre-warmed Proxies');
    console.log('-----------------------------');

    try {
      // Create a scraper that extends FastBaseScraper
      console.log('Testing with proxy pre-warming...');
      
      const proxies = ProxyManager.loadFromFile('src/lib/scrapers/data/proxyscrape_premium_socks_proxies.txt');
      const fastManager = new FastProxyManager({
        proxies: proxies.slice(0, 20),
        rotationStrategy: 'performance',
      });
      
      // Measure cold start
      console.log('\n1. Cold start performance:');
      let startTime = Date.now();
      const coldProxy = fastManager.getNextProxy();
      if (coldProxy) {
        try {
          const scraper = new WagayaJapanScraper({
            proxies: [coldProxy],
            rateLimit: 100,
            timeout: 10000,
          });
          await scraper['fetchHtml']('https://wagaya-japan.com/en/');
          const coldDuration = Date.now() - startTime;
          console.log(`   First request (cold): ${coldDuration}ms`);
        } catch (error) {
          console.log(`   Cold start failed: ${error.message}`);
        }
      }
      
      // Pre-warm proxies
      console.log('\n2. Pre-warming proxies...');
      startTime = Date.now();
      // Simulate warmup by doing health checks
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log(`   Warmup completed in ${Date.now() - startTime}ms`);
      
      // Measure warm performance
      console.log('\n3. Warm proxy performance:');
      const warmResults = [];
      for (let i = 0; i < 3; i++) {
        startTime = Date.now();
        const warmProxy = fastManager.getNextProxy();
        if (warmProxy) {
          try {
            const scraper = new WagayaJapanScraper({
              proxies: [warmProxy],
              rateLimit: 100,
              timeout: 10000,
            });
            await scraper['fetchHtml']('https://wagaya-japan.com/en/');
            const warmDuration = Date.now() - startTime;
            warmResults.push(warmDuration);
            console.log(`   Request ${i + 1} (warm): ${warmDuration}ms`);
          } catch (error) {
            console.log(`   Request ${i + 1} failed: ${error.message}`);
          }
        }
      }
      
      if (warmResults.length > 0) {
        const avgWarm = warmResults.reduce((a, b) => a + b, 0) / warmResults.length;
        console.log(`   Average warm request: ${avgWarm.toFixed(0)}ms`);
      }
      
      fastManager.destroy();
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
    }
    console.log('\n');
  }
}

// Run the performance tests
const tester = new ProxyPerformanceTester();
tester.runPerformanceTests().catch(console.error);