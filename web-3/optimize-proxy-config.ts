import { ProxyManager } from './src/lib/scrapers/utils/proxy-manager';
import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
import pLimit from 'p-limit';

/**
 * Proxy Configuration Optimizer
 * Finds the best proxy settings for maximum speed
 */
class ProxyOptimizer {
  private limit = pLimit(20); // Test 20 proxies concurrently
  
  async optimize() {
    console.log('⚡ Proxy Configuration Optimizer');
    console.log('================================\n');
    
    // Load all available proxies
    const allProxies = ProxyManager.loadFromFile('src/lib/scrapers/data/proxyscrape_premium_socks_proxies.txt');
    console.log(`Loaded ${allProxies.length} proxies for testing\n`);
    
    // Test different configurations
    await this.findOptimalProxies(allProxies);
    await this.testTimeoutSettings();
    await this.testConcurrencyLevels();
    await this.generateOptimalConfig();
  }
  
  private async findOptimalProxies(proxies: any[]) {
    console.log('🔍 Finding fastest proxies...');
    console.log('----------------------------');
    
    const testResults: Array<{proxy: any, latency: number, success: boolean}> = [];
    
    // Test each proxy
    const testPromises = proxies.slice(0, 100).map(proxy => 
      this.limit(async () => {
        const result = await this.testProxy(proxy);
        testResults.push(result);
      })
    );
    
    await Promise.allSettled(testPromises);
    
    // Sort by latency
    const successfulTests = testResults
      .filter(r => r.success)
      .sort((a, b) => a.latency - b.latency);
    
    console.log(`\n✅ Tested ${testResults.length} proxies`);
    console.log(`   Successful: ${successfulTests.length}`);
    console.log(`   Failed: ${testResults.length - successfulTests.length}`);
    
    if (successfulTests.length > 0) {
      console.log('\nTop 10 fastest proxies:');
      successfulTests.slice(0, 10).forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.proxy.host}:${result.proxy.port} - ${result.latency}ms`);
      });
      
      const avgLatency = successfulTests.reduce((sum, r) => sum + r.latency, 0) / successfulTests.length;
      console.log(`\nAverage latency: ${avgLatency.toFixed(0)}ms`);
      
      // Save fast proxies
      await this.saveFastProxies(successfulTests.slice(0, 50).map(r => r.proxy));
    }
  }
  
  private async testProxy(proxy: any): Promise<{proxy: any, latency: number, success: boolean}> {
    const startTime = Date.now();
    try {
      const proxyUrl = `socks5://${proxy.host}:${proxy.port}`;
      const agent = new SocksProxyAgent(proxyUrl);
      
      await axios.get('https://api.ipify.org?format=json', {
        httpsAgent: agent,
        timeout: 5000,
      });
      
      const latency = Date.now() - startTime;
      return { proxy, latency, success: true };
    } catch (error) {
      return { proxy, latency: Date.now() - startTime, success: false };
    }
  }
  
  private async testTimeoutSettings() {
    console.log('\n⏱️ Testing timeout settings...');
    console.log('-----------------------------');
    
    const timeouts = [3000, 5000, 10000, 15000];
    const results: any[] = [];
    
    // Use a known fast proxy
    const testProxy = { host: '156.242.43.120', port: 1081, protocol: 'socks5' };
    
    for (const timeout of timeouts) {
      const successes = [];
      const failures = [];
      
      // Test 5 times for each timeout
      for (let i = 0; i < 5; i++) {
        try {
          const startTime = Date.now();
          const proxyUrl = `socks5://${testProxy.host}:${testProxy.port}`;
          const agent = new SocksProxyAgent(proxyUrl);
          
          await axios.get('https://wagaya-japan.com/en/', {
            httpsAgent: agent,
            timeout,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          
          successes.push(Date.now() - startTime);
        } catch (error) {
          failures.push(error instanceof Error ? error.message : String(error));
        }
      }
      
      const successRate = (successes.length / 5) * 100;
      const avgTime = successes.length > 0 ? 
        successes.reduce((a, b) => a + b, 0) / successes.length : 0;
      
      results.push({ timeout, successRate, avgTime });
      console.log(`   ${timeout}ms timeout: ${successRate}% success, avg ${avgTime.toFixed(0)}ms`);
    }
    
    const optimal = results.reduce((best, current) => {
      // Balance success rate and speed
      const currentScore = current.successRate - (current.avgTime / 100);
      const bestScore = best.successRate - (best.avgTime / 100);
      return currentScore > bestScore ? current : best;
    });
    
    console.log(`\n✅ Optimal timeout: ${optimal.timeout}ms`);
  }
  
  private async testConcurrencyLevels() {
    console.log('\n🔄 Testing concurrency levels...');
    console.log('--------------------------------');
    
    const concurrencyLevels = [1, 3, 5, 10, 20];
    const results: any[] = [];
    
    // Load some fast proxies
    const fastProxies = ProxyManager.loadFromFile('src/lib/scrapers/data/proxyscrape_premium_socks_proxies.txt')
      .slice(0, 20);
    
    for (const concurrency of concurrencyLevels) {
      const startTime = Date.now();
      const limit = pLimit(concurrency);
      
      // Make 20 requests
      const promises = Array(20).fill(0).map((_, index) => 
        limit(async () => {
          const proxy = fastProxies[index % fastProxies.length];
          if (!proxy) throw new Error('No proxy available');
          const proxyUrl = `socks5://${proxy.host}:${proxy.port}`;
          const agent = new SocksProxyAgent(proxyUrl);
          
          try {
            await axios.get('https://api.ipify.org', {
              httpsAgent: agent,
              timeout: 5000,
            });
            return true;
          } catch {
            return false;
          }
        })
      );
      
      const responses = await Promise.all(promises);
      const duration = Date.now() - startTime;
      const successCount = responses.filter(r => r).length;
      
      results.push({
        concurrency,
        duration,
        successRate: (successCount / 20) * 100,
        requestsPerSecond: (20 / duration) * 1000
      });
      
      console.log(`   Concurrency ${concurrency}: ${duration}ms total, ${results[results.length - 1].requestsPerSecond.toFixed(1)} req/s`);
    }
    
    const optimal = results.reduce((best, current) => {
      return current.requestsPerSecond > best.requestsPerSecond ? current : best;
    });
    
    console.log(`\n✅ Optimal concurrency: ${optimal.concurrency} (${optimal.requestsPerSecond.toFixed(1)} req/s)`);
  }
  
  private async saveFastProxies(proxies: any[]) {
    const content = proxies.map(p => `${p.host}:${p.port}`).join('\n');
    const fs = await import('fs/promises');
    await fs.writeFile(
      'src/lib/scrapers/data/fast-socks-proxies.txt',
      `# Fast SOCKS5 Proxies (Auto-generated)\n# Generated: ${new Date().toISOString()}\n\n${content}`
    );
    console.log(`\n💾 Saved ${proxies.length} fast proxies to fast-socks-proxies.txt`);
  }
  
  private async generateOptimalConfig() {
    console.log('\n📋 Optimal Configuration');
    console.log('=======================\n');
    
    const config = {
      proxy: {
        file: 'src/lib/scrapers/data/fast-socks-proxies.txt',
        rotationStrategy: 'performance',
        maxFailures: 2,
        blacklistDuration: 60000, // 1 minute
        healthCheckInterval: 300000, // 5 minutes
      },
      scraper: {
        timeout: 10000, // 10 seconds
        maxRetries: 2,
        rateLimit: 200, // 200ms between requests
        maxConcurrency: 5, // 5 concurrent requests
      },
      performance: {
        enableProxyWarmup: true,
        warmupCount: 10,
        useFastProxyManager: true,
        enableConcurrentRequests: true,
      }
    };
    
    console.log('```json');
    console.log(JSON.stringify(config, null, 2));
    console.log('```');
    
    console.log('\nEnvironment variables:');
    console.log('```bash');
    console.log('export PROXY_FILE="src/lib/scrapers/data/fast-socks-proxies.txt"');
    console.log('export PROXY_ROTATION_STRATEGY="performance"');
    console.log('export PROXY_BLACKLIST_DURATION="60000"');
    console.log('export PROXY_MAX_FAILURES="2"');
    console.log('```');
    
    console.log('\n✅ Configuration optimized for maximum speed!');
  }
}

// Run the optimizer
const optimizer = new ProxyOptimizer();
optimizer.optimize().catch(console.error);