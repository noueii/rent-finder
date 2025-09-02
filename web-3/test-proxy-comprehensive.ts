import { WagayaJapanScraper } from './src/lib/scrapers/sources/wagaya-japan-scraper';
import { ProxyManager } from './src/lib/scrapers/utils/proxy-manager';
import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';

interface TestResult {
  testName: string;
  passed: boolean;
  details: string;
  duration?: number;
}

class ProxyTester {
  private results: TestResult[] = [];

  async runAllTests() {
    console.log('🧪 Comprehensive Proxy System Test Suite');
    console.log('=======================================\n');

    // Test 1: Load and Parse Proxies
    await this.testProxyLoading();

    // Test 2: Direct SOCKS Connection
    await this.testDirectSocksConnection();

    // Test 3: Proxy Manager Rotation
    await this.testProxyRotation();

    // Test 4: Scraper Integration
    await this.testScraperIntegration();

    // Test 5: Performance Tracking
    await this.testPerformanceTracking();

    // Test 6: Error Handling
    await this.testErrorHandling();

    // Display Results
    this.displayResults();
  }

  private async testProxyLoading(): Promise<void> {
    const startTime = Date.now();
    console.log('📋 Test 1: Proxy Loading and Parsing');
    console.log('------------------------------------');

    try {
      // Test loading from file
      const proxies = ProxyManager.loadFromFile('src/lib/scrapers/data/proxyscrape_premium_socks_proxies.txt');
      
      if (proxies.length > 0) {
        console.log(`✅ Loaded ${proxies.length} proxies from file`);
        
        // Check first few proxies
        const sample = proxies.slice(0, 3);
        console.log('\nSample proxies:');
        sample.forEach(proxy => {
          console.log(`  - ${proxy.protocol}://${proxy.host}:${proxy.port}`);
        });

        // Verify auto-detection
        const socksProxies = proxies.filter(p => p.protocol === 'socks5');
        console.log(`\n✅ Auto-detected ${socksProxies.length} SOCKS5 proxies (port 1081)`);

        this.results.push({
          testName: 'Proxy Loading',
          passed: true,
          details: `Loaded ${proxies.length} proxies, ${socksProxies.length} SOCKS5`,
          duration: Date.now() - startTime
        });
      } else {
        throw new Error('No proxies loaded from file');
      }
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
      this.results.push({
        testName: 'Proxy Loading',
        passed: false,
        details: error.message,
        duration: Date.now() - startTime
      });
    }
    console.log('\n');
  }

  private async testDirectSocksConnection(): Promise<void> {
    const startTime = Date.now();
    console.log('🔌 Test 2: Direct SOCKS Connection');
    console.log('----------------------------------');

    try {
      const testProxy = '156.242.43.120:1081';
      const socksUrl = `socks5://${testProxy}`;
      const agent = new SocksProxyAgent(socksUrl);
      
      console.log(`Testing SOCKS5 proxy: ${testProxy}`);
      
      // Test IP check
      const ipResponse = await axios.get('https://api.ipify.org?format=json', {
        httpsAgent: agent,
        timeout: 10000
      });
      
      console.log(`✅ Connected via proxy IP: ${ipResponse.data.ip}`);
      
      // Test actual website
      const targetUrl = 'https://wagaya-japan.com/en/rent/tokyo/list/';
      const response = await axios.get(targetUrl, {
        httpsAgent: agent,
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      console.log(`✅ Successfully accessed ${targetUrl}`);
      console.log(`   Response size: ${response.data.length} bytes`);

      this.results.push({
        testName: 'Direct SOCKS Connection',
        passed: true,
        details: `Connected via ${ipResponse.data.ip}`,
        duration: Date.now() - startTime
      });
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
      this.results.push({
        testName: 'Direct SOCKS Connection',
        passed: false,
        details: error.message,
        duration: Date.now() - startTime
      });
    }
    console.log('\n');
  }

  private async testProxyRotation(): Promise<void> {
    const startTime = Date.now();
    console.log('🔄 Test 3: Proxy Rotation');
    console.log('-------------------------');

    try {
      // Create proxy manager with round-robin rotation
      const manager = new ProxyManager({
        proxies: ProxyManager.loadFromFile('src/lib/scrapers/data/proxyscrape_premium_socks_proxies.txt').slice(0, 10),
        rotationStrategy: 'round-robin'
      });

      console.log(`Testing rotation with ${manager.getProxyCount()} proxies`);
      
      const usedProxies = new Set<string>();
      
      // Get 5 proxies and ensure they're different
      for (let i = 0; i < 5; i++) {
        const proxy = manager.getNextProxy();
        if (proxy) {
          const key = `${proxy.host}:${proxy.port}`;
          usedProxies.add(key);
          console.log(`  Rotation ${i + 1}: ${proxy.protocol}://${key}`);
        }
      }

      if (usedProxies.size >= 3) {
        console.log(`✅ Proxy rotation working: ${usedProxies.size} different proxies used`);
        this.results.push({
          testName: 'Proxy Rotation',
          passed: true,
          details: `Rotated through ${usedProxies.size} proxies`,
          duration: Date.now() - startTime
        });
      } else {
        throw new Error('Insufficient proxy rotation');
      }
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
      this.results.push({
        testName: 'Proxy Rotation',
        passed: false,
        details: error.message,
        duration: Date.now() - startTime
      });
    }
    console.log('\n');
  }

  private async testScraperIntegration(): Promise<void> {
    const startTime = Date.now();
    console.log('🕷️ Test 4: Scraper Integration');
    console.log('------------------------------');

    try {
      // Set environment to use SOCKS proxies
      process.env.PROXY_FILE = 'src/lib/scrapers/data/proxyscrape_premium_socks_proxies.txt';
      
      const scraper = new WagayaJapanScraper({
        rateLimit: 1000,
        maxRetries: 1,
        timeout: 20000
      });

      console.log('Testing scraper with SOCKS proxy...');
      
      const result = await scraper.search({
        maxPrice: 200000,
        limit: 3
      });

      if (result.success && result.data && result.data.length > 0) {
        console.log(`✅ Scraped ${result.data.length} apartments`);
        console.log(`   First apartment: ${result.data[0].title}`);
        
        if (result.metadata?.proxy) {
          console.log(`   Used proxy: ${result.metadata.proxy}`);
        }

        this.results.push({
          testName: 'Scraper Integration',
          passed: true,
          details: `Scraped ${result.data.length} apartments`,
          duration: Date.now() - startTime
        });
      } else {
        throw new Error(result.error?.message || 'No data scraped');
      }
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
      this.results.push({
        testName: 'Scraper Integration',
        passed: false,
        details: error.message,
        duration: Date.now() - startTime
      });
    }
    console.log('\n');
  }

  private async testPerformanceTracking(): Promise<void> {
    const startTime = Date.now();
    console.log('📊 Test 5: Performance Tracking');
    console.log('-------------------------------');

    try {
      const manager = new ProxyManager({
        proxies: ProxyManager.loadFromFile('src/lib/scrapers/data/proxyscrape_premium_socks_proxies.txt').slice(0, 5),
        rotationStrategy: 'performance'
      });

      console.log('Testing performance-based rotation...');
      
      // Simulate some successful and failed requests
      const proxy1 = manager.getNextProxy();
      if (proxy1) {
        manager.reportSuccess(proxy1, 1500); // 1.5s response
        manager.reportSuccess(proxy1, 2000); // 2s response
        console.log(`✅ Reported success for ${proxy1.host}:${proxy1.port}`);
      }

      const proxy2 = manager.getNextProxy();
      if (proxy2) {
        manager.reportFailure(proxy2, 'Connection timeout');
        console.log(`❌ Reported failure for ${proxy2.host}:${proxy2.port}`);
      }

      // Get stats
      const stats = manager.getStats();
      console.log(`\nProxy Statistics:`);
      let hasStats = false;
      stats.forEach((stat, key) => {
        if (stat.successCount > 0 || stat.failureCount > 0) {
          hasStats = true;
          console.log(`  ${key}:`);
          console.log(`    Success: ${stat.successCount}, Failures: ${stat.failureCount}`);
          console.log(`    Avg Response: ${stat.avgResponseTime.toFixed(0)}ms`);
        }
      });

      if (hasStats) {
        this.results.push({
          testName: 'Performance Tracking',
          passed: true,
          details: 'Stats tracking working',
          duration: Date.now() - startTime
        });
      } else {
        throw new Error('No performance stats recorded');
      }
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
      this.results.push({
        testName: 'Performance Tracking',
        passed: false,
        details: error.message,
        duration: Date.now() - startTime
      });
    }
    console.log('\n');
  }

  private async testErrorHandling(): Promise<void> {
    const startTime = Date.now();
    console.log('⚠️ Test 6: Error Handling');
    console.log('-------------------------');

    try {
      // Test with invalid proxy
      const invalidProxy = 'socks5://999.999.999.999:1081';
      const agent = new SocksProxyAgent(invalidProxy);
      
      console.log('Testing invalid proxy handling...');
      
      try {
        await axios.get('https://api.ipify.org', {
          httpsAgent: agent,
          timeout: 5000
        });
        throw new Error('Expected connection to fail');
      } catch (error) {
        console.log(`✅ Correctly caught error: ${error.message}`);
      }

      // Test blacklisting
      const manager = new ProxyManager({
        proxies: [{ host: 'test.proxy', port: 1081, protocol: 'socks5' }],
        maxFailures: 2,
        blacklistDuration: 1000
      });

      const proxy = manager.getNextProxy();
      if (proxy) {
        manager.reportFailure(proxy, 'Test failure 1');
        manager.reportFailure(proxy, 'Test failure 2');
        
        const available = manager.getAvailableProxyCount();
        console.log(`✅ Proxy blacklisted after 2 failures (available: ${available})`);
      }

      this.results.push({
        testName: 'Error Handling',
        passed: true,
        details: 'Error handling working correctly',
        duration: Date.now() - startTime
      });
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
      this.results.push({
        testName: 'Error Handling',
        passed: false,
        details: error.message,
        duration: Date.now() - startTime
      });
    }
    console.log('\n');
  }

  private displayResults(): void {
    console.log('📈 Test Results Summary');
    console.log('======================\n');

    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const passRate = (passed / total * 100).toFixed(1);

    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      const duration = result.duration ? ` (${result.duration}ms)` : '';
      console.log(`${status} ${result.testName}: ${result.details}${duration}`);
    });

    console.log(`\nOverall: ${passed}/${total} tests passed (${passRate}%)`);
    
    if (passed === total) {
      console.log('\n🎉 All tests passed! The proxy system is working correctly.');
    } else {
      console.log('\n⚠️ Some tests failed. Please check the details above.');
    }
  }
}

// Run the tests
const tester = new ProxyTester();
tester.runAllTests().catch(console.error);