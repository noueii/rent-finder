/**
 * Test script for UnifiedProxyManager
 */

import { UnifiedProxyManager } from './src/infrastructure/scrapers/proxy';
import type { ProxyConfig } from './src/types/scraper';

async function testUnifiedProxyManager() {
  console.log('🧪 Testing UnifiedProxyManager...\n');

  // Test 1: Basic initialization
  console.log('Test 1: Basic initialization');
  const manager1 = new UnifiedProxyManager({
    proxies: [
      { host: '127.0.0.1', port: 8080, protocol: 'http' },
      { host: '127.0.0.1', port: 1080, protocol: 'socks5' },
      { host: '192.168.1.1', port: 3128, protocol: 'http' },
    ],
    rotationStrategy: 'round-robin',
  });
  console.log('✅ Created manager with 3 proxies\n');

  // Test 2: Proxy string parsing
  console.log('Test 2: Proxy string parsing');
  const testStrings = [
    '127.0.0.1:8080',
    'http://proxy.example.com:3128',
    'socks5://user:pass@socks.example.com:1080',
    'invalid-proxy-string',
    '192.168.1.1:1080', // Should auto-detect as SOCKS5
  ];

  for (const str of testStrings) {
    const result = UnifiedProxyManager.parseProxyString(str);
    console.log(`  "${str}" -> ${result ? JSON.stringify(result) : 'null'}`);
  }
  console.log();

  // Test 3: Rotation strategies
  console.log('Test 3: Rotation strategies');
  const strategies: Array<'round-robin' | 'random' | 'performance' | 'least-used'> = [
    'round-robin',
    'random',
    'performance',
    'least-used',
  ];

  for (const strategy of strategies) {
    const manager = new UnifiedProxyManager({
      proxies: [
        { host: 'proxy1.test', port: 8080, protocol: 'http' },
        { host: 'proxy2.test', port: 8080, protocol: 'http' },
        { host: 'proxy3.test', port: 8080, protocol: 'http' },
      ],
      rotationStrategy: strategy,
    });

    console.log(`\n  Strategy: ${strategy}`);
    const used = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const proxy = manager.getNextProxy();
      if (proxy) {
        const key = `${proxy.host}:${proxy.port}`;
        used.add(key);
        console.log(`    Request ${i + 1}: ${key}`);
      }
    }
    console.log(`    Unique proxies used: ${used.size}`);
  }

  // Test 4: Proxy statistics and health
  console.log('\n\nTest 4: Proxy statistics and health');
  const manager4 = new UnifiedProxyManager({
    proxies: [
      { host: 'good.proxy', port: 8080, protocol: 'http' },
      { host: 'bad.proxy', port: 8080, protocol: 'http' },
    ],
    maxFailures: 2,
    blacklistDuration: 5000, // 5 seconds
  });

  // Simulate success
  const goodProxy = manager4.getNextProxy()!;
  manager4.reportSuccess(goodProxy, 100);
  manager4.reportSuccess(goodProxy, 150);

  // Simulate failures
  const badProxy = manager4.getNextProxy()!;
  manager4.reportFailure(badProxy, 'Connection timeout');
  manager4.reportFailure(badProxy, 'Connection refused');

  const summary = manager4.getSummary();
  console.log('\n  Summary:', summary);

  const stats = manager4.getStats();
  console.log('\n  Detailed stats:');
  stats.forEach((stat, key) => {
    console.log(`    ${key}:`, {
      success: stat.successCount,
      failures: stat.failureCount,
      avgResponse: stat.avgResponseTime.toFixed(2) + 'ms',
      healthScore: stat.healthScore,
      blacklisted: stat.blacklistedUntil ? 'Yes' : 'No',
    });
  });

  // Test 5: Batch proxy retrieval
  console.log('\n\nTest 5: Batch proxy retrieval');
  const manager5 = new UnifiedProxyManager({
    proxies: Array.from({ length: 10 }, (_, i) => ({
      host: `proxy${i + 1}.test`,
      port: 8080,
      protocol: 'http' as const,
    })),
  });

  const batch = manager5.getProxyBatch(5);
  console.log(`  Requested 5 proxies, got ${batch.length}:`);
  batch.forEach((proxy, i) => {
    console.log(`    ${i + 1}. ${proxy.host}:${proxy.port}`);
  });

  // Test 6: Environment variable loading
  console.log('\n\nTest 6: Environment variable loading');
  process.env.PROXY_LIST = 'http://env1.proxy:8080,socks5://env2.proxy:1080';
  process.env.PROXY_ROTATION_STRATEGY = 'performance';
  
  const envManager = UnifiedProxyManager.fromEnv();
  const envSummary = envManager.getSummary();
  console.log('  Loaded from env:', envSummary);

  // Cleanup
  delete process.env.PROXY_LIST;
  delete process.env.PROXY_ROTATION_STRATEGY;

  console.log('\n✅ All tests completed!');
}

// Run tests
testUnifiedProxyManager().catch(console.error);