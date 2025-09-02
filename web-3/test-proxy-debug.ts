import { ProxyManager } from './src/lib/scrapers/utils/proxy-manager';

async function debugProxyManager() {
  console.log('🔍 Debugging Proxy Manager');
  console.log('==========================\n');
  
  // Set environment variable to use proxy file
  process.env.PROXY_FILE = 'src/lib/scrapers/data/proxilist.txt';
  
  // Create proxy manager from environment
  const proxyManager = ProxyManager.fromEnv();
  
  console.log(`Total proxies loaded: ${proxyManager.getProxyCount()}`);
  console.log(`Available proxies: ${proxyManager.getAvailableProxyCount()}`);
  console.log(`Has proxies: ${proxyManager.hasProxies()}`);
  
  // Get first few proxies
  console.log('\nFirst 5 proxies:');
  for (let i = 0; i < 5; i++) {
    const proxy = proxyManager.getNextProxy();
    if (proxy) {
      console.log(`${i + 1}. ${proxy.host}:${proxy.port} (protocol: ${proxy.protocol})`);
    }
  }
  
  // Test if axios config is being created correctly
  console.log('\n\nTesting proxy agent creation...');
  
  // Import the helper
  const { createProxyAgents } = await import('./src/lib/scrapers/utils/proxy-agent-helper');
  
  const proxy = proxyManager.getNextProxy();
  if (proxy) {
    console.log(`\nTesting with proxy: ${proxy.host}:${proxy.port}`);
    
    const targetUrl = 'https://wagaya-japan.com/en/rent/tokyo/list/';
    const agentConfig = createProxyAgents(targetUrl, proxy);
    
    console.log('Agent config created:', {
      hasHttpsAgent: !!agentConfig.httpsAgent,
      hasHttpAgent: !!agentConfig.httpAgent,
      proxy: agentConfig.proxy
    });
  }
}

debugProxyManager().catch(console.error);