import { ProxyConfig } from '~/types/scraper';

export interface ProxyStats {
  successCount: number;
  failureCount: number;
  lastUsed: Date;
  lastError?: Date;
  avgResponseTime: number;
  isHealthy: boolean;
}

export class ProxyManager {
  private proxies: Map<string, ProxyConfig> = new Map();
  private stats: Map<string, ProxyStats> = new Map();
  private currentIndex: number = 0;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(proxies: ProxyConfig[] = []) {
    proxies.forEach(proxy => this.addProxy(proxy));
  }

  /**
   * Add a proxy to the pool
   */
  addProxy(proxy: ProxyConfig): void {
    const key = this.getProxyKey(proxy);
    this.proxies.set(key, proxy);
    this.stats.set(key, {
      successCount: 0,
      failureCount: 0,
      lastUsed: new Date(),
      avgResponseTime: 0,
      isHealthy: true,
    });
  }

  /**
   * Remove a proxy from the pool
   */
  removeProxy(proxy: ProxyConfig): void {
    const key = this.getProxyKey(proxy);
    this.proxies.delete(key);
    this.stats.delete(key);
  }

  /**
   * Get the next available proxy (round-robin with health check)
   */
  getNextProxy(): ProxyConfig | undefined {
    const healthyProxies = this.getHealthyProxies();
    
    if (healthyProxies.length === 0) {
      return undefined;
    }
    
    const proxy = healthyProxies[this.currentIndex % healthyProxies.length];
    this.currentIndex++;
    
    // Update last used time
    const key = this.getProxyKey(proxy);
    const stats = this.stats.get(key);
    if (stats) {
      stats.lastUsed = new Date();
    }
    
    return proxy;
  }

  /**
   * Get a random healthy proxy
   */
  getRandomProxy(): ProxyConfig | undefined {
    const healthyProxies = this.getHealthyProxies();
    
    if (healthyProxies.length === 0) {
      return undefined;
    }
    
    const randomIndex = Math.floor(Math.random() * healthyProxies.length);
    const proxy = healthyProxies[randomIndex];
    
    // Update last used time
    const key = this.getProxyKey(proxy);
    const stats = this.stats.get(key);
    if (stats) {
      stats.lastUsed = new Date();
    }
    
    return proxy;
  }

  /**
   * Get least recently used healthy proxy
   */
  getLeastRecentlyUsedProxy(): ProxyConfig | undefined {
    const healthyProxies = this.getHealthyProxies();
    
    if (healthyProxies.length === 0) {
      return undefined;
    }
    
    let lruProxy: ProxyConfig | undefined;
    let oldestTime = new Date();
    
    for (const proxy of healthyProxies) {
      const key = this.getProxyKey(proxy);
      const stats = this.stats.get(key);
      
      if (stats && stats.lastUsed < oldestTime) {
        oldestTime = stats.lastUsed;
        lruProxy = proxy;
      }
    }
    
    if (lruProxy) {
      const key = this.getProxyKey(lruProxy);
      const stats = this.stats.get(key);
      if (stats) {
        stats.lastUsed = new Date();
      }
    }
    
    return lruProxy;
  }

  /**
   * Record a successful request
   */
  recordSuccess(proxy: ProxyConfig, responseTime: number): void {
    const key = this.getProxyKey(proxy);
    const stats = this.stats.get(key);
    
    if (stats) {
      stats.successCount++;
      stats.avgResponseTime = 
        (stats.avgResponseTime * (stats.successCount - 1) + responseTime) / 
        stats.successCount;
      
      // Re-enable proxy if it was marked unhealthy
      if (!stats.isHealthy && stats.successCount > stats.failureCount) {
        stats.isHealthy = true;
      }
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(proxy: ProxyConfig): void {
    const key = this.getProxyKey(proxy);
    const stats = this.stats.get(key);
    
    if (stats) {
      stats.failureCount++;
      stats.lastError = new Date();
      
      // Mark as unhealthy if failure rate is too high
      const totalRequests = stats.successCount + stats.failureCount;
      const failureRate = stats.failureCount / totalRequests;
      
      if (failureRate > 0.5 && totalRequests >= 10) {
        stats.isHealthy = false;
      }
    }
  }

  /**
   * Get all healthy proxies
   */
  private getHealthyProxies(): ProxyConfig[] {
    const healthy: ProxyConfig[] = [];
    
    this.proxies.forEach((proxy, key) => {
      const stats = this.stats.get(key);
      if (stats?.isHealthy) {
        healthy.push(proxy);
      }
    });
    
    return healthy;
  }

  /**
   * Get proxy statistics
   */
  getStats(): Map<string, ProxyStats> {
    return new Map(this.stats);
  }

  /**
   * Reset all proxy statistics
   */
  resetStats(): void {
    this.stats.forEach(stats => {
      stats.successCount = 0;
      stats.failureCount = 0;
      stats.avgResponseTime = 0;
      stats.isHealthy = true;
      delete stats.lastError;
    });
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks(intervalMs: number = 60000): void {
    this.stopHealthChecks();
    
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, intervalMs);
  }

  /**
   * Stop periodic health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  /**
   * Perform health check on all proxies
   */
  private performHealthCheck(): void {
    const now = new Date();
    
    this.stats.forEach((stats, key) => {
      // Re-enable proxies that haven't been used in a while
      const timeSinceLastError = stats.lastError 
        ? now.getTime() - stats.lastError.getTime()
        : Infinity;
      
      if (!stats.isHealthy && timeSinceLastError > 300000) { // 5 minutes
        stats.isHealthy = true;
        stats.failureCount = Math.floor(stats.failureCount / 2); // Decay failure count
      }
    });
  }

  /**
   * Get a unique key for a proxy
   */
  private getProxyKey(proxy: ProxyConfig): string {
    return `${proxy.protocol || 'http'}://${proxy.host}:${proxy.port}`;
  }

  /**
   * Get the total number of proxies
   */
  get size(): number {
    return this.proxies.size;
  }

  /**
   * Get the number of healthy proxies
   */
  get healthyCount(): number {
    return this.getHealthyProxies().length;
  }
}