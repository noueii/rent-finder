#!/usr/bin/env node

/**
 * Test script to demonstrate proxy configuration options
 */

console.log('Tokyo Apartment Finder - Proxy Configuration Test\n');
console.log('================================================\n');

console.log('🌐 Proxy System Features:');
console.log('  • Multiple proxy support');
console.log('  • Automatic rotation (4 strategies)');
console.log('  • Intelligent blacklisting');
console.log('  • Performance tracking');
console.log('  • HTTP/HTTPS/SOCKS5 support');

console.log('\n📋 Configuration Methods:\n');

console.log('1. Environment Variable - Multiple Proxies:');
console.log('   PROXY_LIST="http://proxy1:8080,socks5://user:pass@proxy2:1080"');

console.log('\n2. Environment Variable - Single Proxy:');
console.log('   PROXY_HOST="proxy.example.com"');
console.log('   PROXY_PORT="8080"');
console.log('   PROXY_USERNAME="user" (optional)');
console.log('   PROXY_PASSWORD="pass" (optional)');

console.log('\n3. Programmatic Configuration:');
console.log(`   new WagayaJapanScraper({
     proxies: [
       { host: 'proxy1.com', port: 8080, protocol: 'http' },
       { host: 'proxy2.com', port: 1080, protocol: 'socks5' }
     ]
   })`);

console.log('\n🔄 Rotation Strategies:\n');

const strategies = [
  {
    name: 'round-robin',
    desc: 'Cycles through proxies in order',
    use: 'Equal-quality proxy pools'
  },
  {
    name: 'random',
    desc: 'Randomly selects proxies',
    use: 'Avoiding patterns, large pools'
  },
  {
    name: 'performance',
    desc: 'Selects fastest, most reliable',
    use: 'Mixed-quality pools, production'
  },
  {
    name: 'least-used',
    desc: 'Prioritizes least recently used',
    use: 'Rate-limited proxies'
  }
];

strategies.forEach(s => {
  console.log(`${s.name.toUpperCase()}:`);
  console.log(`  Description: ${s.desc}`);
  console.log(`  Best for: ${s.use}\n`);
});

console.log('🛡️ Anti-Blocking Stack:\n');
console.log('1. User Agent Rotation: 288+ browser fingerprints');
console.log('2. Proxy Rotation: N proxies × rotation strategies');
console.log('3. Request Delays: Base + random jitter');
console.log('4. Total Combinations: 288 × N proxies = massive variety');

console.log('\n📊 Proxy Performance Tracking:\n');
console.log('For each proxy, the system tracks:');
console.log('  • Success/failure count');
console.log('  • Average response time');
console.log('  • Last error message');
console.log('  • Blacklist status & duration');

console.log('\n⚙️ Advanced Settings:\n');
console.log('PROXY_BLACKLIST_DURATION="300000"  # 5 min blacklist');
console.log('PROXY_MAX_FAILURES="3"             # Failures before blacklist');

console.log('\n🔧 Example Configurations:\n');

console.log('Development (Free Proxies):');
console.log('  PROXY_LIST="http://free1.proxy.com:8080,http://free2.proxy.com:3128"');
console.log('  PROXY_ROTATION_STRATEGY="random"');

console.log('\nProduction (Premium):');
console.log('  PROXY_LIST="http://user:pass@premium1.proxy.com:22225"');
console.log('  PROXY_ROTATION_STRATEGY="performance"');

console.log('\nHigh-Security (SOCKS5):');
console.log('  PROXY_LIST="socks5://secure-user:pass@socks.proxy.com:1080"');
console.log('  PROXY_ROTATION_STRATEGY="least-used"');

console.log('\n✅ Benefits of Proxy Configuration:');
console.log('  • Avoid IP-based blocking');
console.log('  • Distribute requests across IPs');
console.log('  • Continue scraping if one IP blocked');
console.log('  • Access geo-restricted content');
console.log('  • Scale scraping operations');

console.log('\n📚 See docs/PROXY-SETUP.md for detailed setup instructions!');

// Show current proxy configuration status
console.log('\n🔍 Current Configuration:');
console.log(`  PROXY_LIST: ${process.env.PROXY_LIST || '(not set)'}`);