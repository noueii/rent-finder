# Proxy Manager Migration Guide

## Overview

We've consolidated 3 proxy managers into a single `UnifiedProxyManager`:
- ✅ `ProxyManager` → `UnifiedProxyManager`
- ✅ `FastProxyManager` → `UnifiedProxyManager` 
- ✅ `ProxyAgentHelper` → Built into `UnifiedProxyManager`

## Key Benefits

1. **Single API** - One consistent interface for all proxy needs
2. **Multiple Strategies** - Round-robin, random, performance, least-used
3. **Built-in Agent Creation** - No need for separate proxy agent helper
4. **Health Monitoring** - Automatic blacklisting and recovery
5. **Better Configuration** - Environment variables, files, or direct config

## Migration Steps

### 1. Update Imports

**Before:**
```typescript
import { ProxyManager } from '~/lib/scrapers/proxy-manager';
import { FastProxyManager } from '~/lib/scrapers/utils/fast-proxy-manager';
import { createProxyAgents } from '~/lib/scrapers/utils/proxy-agent-helper';
```

**After:**
```typescript
import { UnifiedProxyManager } from '~/infrastructure/scrapers/proxy';
```

### 2. Update Initialization

**Before:**
```typescript
// Basic ProxyManager
const proxyManager = new ProxyManager(proxies);

// FastProxyManager
const fastProxy = new FastProxyManager({
  proxies,
  rotationStrategy: 'performance'
});

// From environment
const envProxy = ProxyManager.fromEnv();
```

**After:**
```typescript
// Basic initialization
const proxyManager = new UnifiedProxyManager({
  proxies,
  rotationStrategy: 'round-robin', // or 'random', 'performance', 'least-used'
  healthCheckInterval: 0, // Disable auto health checks
  blacklistDuration: 300000, // 5 minutes
  maxFailures: 3
});

// From environment (same API)
const envProxy = UnifiedProxyManager.fromEnv();

// With performance strategy (replaces FastProxyManager)
const fastProxy = new UnifiedProxyManager({
  proxies,
  rotationStrategy: 'performance',
  concurrentHealthChecks: 50 // For faster health checks
});
```

### 3. Update Proxy Agent Creation

**Before:**
```typescript
import { createProxyAgents } from '~/lib/scrapers/utils/proxy-agent-helper';

const proxy = proxyManager.getNextProxy();
const agents = createProxyAgents(targetUrl, proxy);

const response = await axios.get(url, {
  ...agents,
  // other config
});
```

**After:**
```typescript
const proxy = proxyManager.getNextProxy();
const agents = proxyManager.createProxyAgents(targetUrl, proxy);

const response = await axios.get(url, {
  ...agents,
  // other config
});
```

### 4. Update Method Names

Most methods remain the same, but some have been standardized:

| Old Method | New Method | Notes |
|------------|------------|-------|
| `getNextProxy()` | `getNextProxy()` | Same |
| `getRandomProxy()` | Use `rotationStrategy: 'random'` | Configure strategy instead |
| `getLeastRecentlyUsedProxy()` | Use `rotationStrategy: 'least-used'` | Configure strategy instead |
| `recordSuccess()` | `reportSuccess()` | Name standardized |
| `recordFailure()` | `reportFailure()` | Name standardized |
| `getProxyBatch()` (FastProxy) | `getProxyBatch()` | Now in unified manager |
| `getHealthSummary()` (FastProxy) | `getSummary()` | Standardized |

### 5. Update BaseScraper Integration

The `BaseScraper` has been updated to automatically use `UnifiedProxyManager` when proxies are enabled:

```typescript
// In scraper config
const config: ScraperConfig = {
  // ... other config
  features: {
    proxy: true // Enables proxy support
  }
};

// The base scraper automatically:
// 1. Creates a UnifiedProxyManager instance
// 2. Uses proxies for all requests
// 3. Reports success/failure
// 4. Handles cleanup
```

### 6. Environment Variables

The same environment variables work:

```bash
# Proxy list (comma-separated)
PROXY_LIST="http://proxy1:8080,socks5://proxy2:1080"

# Or from file
PROXY_FILE="path/to/proxies.txt"

# Or single proxy
PROXY_HOST="proxy.example.com"
PROXY_PORT="8080"
PROXY_USERNAME="user"
PROXY_PASSWORD="pass"
PROXY_PROTOCOL="http"

# Rotation strategy
PROXY_ROTATION_STRATEGY="performance" # round-robin, random, performance, least-used

# Blacklist settings
PROXY_BLACKLIST_DURATION="300000" # milliseconds
PROXY_MAX_FAILURES="3"
```

## Example: Complete Migration

**Before:**
```typescript
import { FastProxyManager } from '~/lib/scrapers/utils/fast-proxy-manager';
import { createProxyAgents } from '~/lib/scrapers/utils/proxy-agent-helper';
import axios from 'axios';

class MyScraper {
  private proxyManager: FastProxyManager;

  constructor() {
    this.proxyManager = new FastProxyManager({
      proxies: loadProxies(),
      rotationStrategy: 'performance'
    });
  }

  async scrape(url: string) {
    const proxy = this.proxyManager.getNextProxy();
    if (!proxy) throw new Error('No proxies available');

    const agents = createProxyAgents(url, proxy);
    
    try {
      const response = await axios.get(url, {
        ...agents,
        timeout: 30000
      });
      
      this.proxyManager.reportSuccess(proxy, Date.now() - start);
      return response.data;
    } catch (error) {
      this.proxyManager.reportFailure(proxy, error.message);
      throw error;
    }
  }
}
```

**After:**
```typescript
import { UnifiedProxyManager } from '~/infrastructure/scrapers/proxy';
import axios from 'axios';

class MyScraper {
  private proxyManager: UnifiedProxyManager;

  constructor() {
    this.proxyManager = new UnifiedProxyManager({
      proxies: loadProxies(),
      rotationStrategy: 'performance',
      healthCheckInterval: 0, // No auto health checks
      maxFailures: 3,
      blacklistDuration: 300000
    });
  }

  async scrape(url: string) {
    const proxy = this.proxyManager.getNextProxy();
    if (!proxy) throw new Error('No proxies available');

    const agents = this.proxyManager.createProxyAgents(url, proxy);
    const start = Date.now();
    
    try {
      const response = await axios.get(url, {
        ...agents,
        timeout: 30000
      });
      
      this.proxyManager.reportSuccess(proxy, Date.now() - start);
      return response.data;
    } catch (error) {
      this.proxyManager.reportFailure(proxy, error.message);
      throw error;
    }
  }

  destroy() {
    this.proxyManager.destroy(); // Clean up resources
  }
}
```

## Breaking Changes

1. **No automatic health checks by default** - Set `healthCheckInterval` if needed
2. **Method name changes** - `recordSuccess` → `reportSuccess`, etc.
3. **Strategy configuration** - Use `rotationStrategy` instead of different methods
4. **Import path** - Now in `~/infrastructure/scrapers/proxy`

## Tips

1. **Disable health checks** for scrapers that run quickly
2. **Use performance strategy** for high-volume scraping
3. **Use round-robin** for even distribution
4. **Monitor proxy stats** with `getSummary()` for debugging
5. **Always call `destroy()`** when done to clean up resources