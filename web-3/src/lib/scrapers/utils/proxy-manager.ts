/**
 * Proxy Manager
 * Manages proxy rotation, health checking, and load balancing for scrapers
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ProxyConfig } from '~/types/scraper';

export interface ProxyStats {
  successCount: number;
  failureCount: number;
  lastUsed: Date;
  lastError?: string;
  avgResponseTime: number;
  blacklistedUntil?: Date;
}

export interface ProxyPoolConfig {
  proxies: ProxyConfig[];
  rotationStrategy: 'round-robin' | 'random' | 'performance' | 'least-used';
  healthCheckInterval?: number; // milliseconds
  blacklistDuration?: number; // milliseconds
  maxFailures?: number; // failures before blacklisting
}

export class ProxyManager {
  private proxies: ProxyConfig[] = [];
  private proxyStats: Map<string, ProxyStats> = new Map();
  private currentIndex: number = 0;
  private rotationStrategy: ProxyPoolConfig['rotationStrategy'] = 'round-robin';
  private blacklistDuration: number = 300000; // 5 minutes default
  private maxFailures: number = 3;
  
  constructor(config?: ProxyPoolConfig) {
    if (config) {
      this.proxies = config.proxies;
      this.rotationStrategy = config.rotationStrategy;
      this.blacklistDuration = config.blacklistDuration || 300000;
      this.maxFailures = config.maxFailures || 3;
      
      // Initialize stats for each proxy
      this.proxies.forEach(proxy => {
        const key = this.getProxyKey(proxy);
        this.proxyStats.set(key, {
          successCount: 0,
          failureCount: 0,
          lastUsed: new Date(0),
          avgResponseTime: 0,
        });
      });
    }
  }
  
  /**
   * Load proxies from environment variables
   * Format: PROXY_LIST="http://user:pass@host1:port1,socks5://host2:port2"
   */
  static fromEnv(): ProxyManager {
    const proxyList = process.env.PROXY_LIST || '';
    const proxyFile = process.env.PROXY_FILE || '';
    const proxies: ProxyConfig[] = [];
    
    // Load from PROXY_LIST environment variable
    if (proxyList) {
      const proxyStrings = proxyList.split(',').map(p => p.trim()).filter(Boolean);
      
      for (const proxyString of proxyStrings) {
        try {
          const proxy = ProxyManager.parseProxyString(proxyString);
          if (proxy) {
            proxies.push(proxy);
          }
        } catch (error) {
          console.error(`Failed to parse proxy: ${proxyString}`, error);
        }
      }
    }
    
    // Load from proxy file if specified
    if (proxyFile || (!proxyList && !process.env.PROXY_HOST)) {
      // Default to proxilist.txt if no other proxy config is provided
      const filePath = proxyFile || 'src/lib/scrapers/data/proxilist.txt';
      const loadedProxies = ProxyManager.loadFromFile(filePath);
      proxies.push(...loadedProxies);
    }
    
    // Also support individual proxy configs
    if (process.env.PROXY_HOST) {
      proxies.push({
        host: process.env.PROXY_HOST,
        port: parseInt(process.env.PROXY_PORT || '8080', 10),
        username: process.env.PROXY_USERNAME,
        password: process.env.PROXY_PASSWORD,
        protocol: (process.env.PROXY_PROTOCOL as any) || 'http',
      });
    }
    
    const strategy = (process.env.PROXY_ROTATION_STRATEGY as any) || 'round-robin';
    const blacklistDuration = parseInt(process.env.PROXY_BLACKLIST_DURATION || '300000', 10);
    const maxFailures = parseInt(process.env.PROXY_MAX_FAILURES || '3', 10);
    
    return new ProxyManager({
      proxies,
      rotationStrategy: strategy,
      blacklistDuration,
      maxFailures,
    });
  }
  
  /**
   * Load proxies from a text file
   * Supports comments (lines starting with #) and various proxy formats
   */
  static loadFromFile(filePath: string): ProxyConfig[] {
    const proxies: ProxyConfig[] = [];
    
    try {
      // Resolve path relative to project root
      const fullPath = path.resolve(process.cwd(), filePath);
      
      if (!fs.existsSync(fullPath)) {
        console.warn(`Proxy file not found: ${fullPath}`);
        return proxies;
      }
      
      const fileContent = fs.readFileSync(fullPath, 'utf-8');
      const lines = fileContent.split('\n');
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Skip empty lines and comments
        if (!trimmedLine || trimmedLine.startsWith('#')) {
          continue;
        }
        
        // Skip header lines (like "Free proxies from...")
        if (trimmedLine.toLowerCase().includes('free proxies') || 
            trimmedLine.toLowerCase().includes('updated at') ||
            !trimmedLine.includes(':')) {
          continue;
        }
        
        try {
          const proxy = ProxyManager.parseProxyString(trimmedLine);
          if (proxy) {
            proxies.push(proxy);
          }
        } catch (error) {
          // Skip invalid proxy lines
          console.debug(`Skipping invalid proxy line: ${trimmedLine}`);
        }
      }
      
      // console.log(`Loaded ${proxies.length} proxies from ${filePath}`);
    } catch (error) {
      console.error(`Failed to load proxies from file: ${filePath}`, error);
    }
    
    return proxies;
  }
  
  /**
   * Parse proxy string format: protocol://user:pass@host:port or host:port
   */
  static parseProxyString(proxyString: string): ProxyConfig | null {
    try {
      // Check if it contains protocol
      if (proxyString.includes('://')) {
        const url = new URL(proxyString);
        const protocol = url.protocol.replace(':', '').toLowerCase();
        
        // Validate protocol
        if (!['http', 'https', 'socks4', 'socks5'].includes(protocol)) {
          console.warn(`Unsupported proxy protocol: ${protocol}`);
          return null;
        }
        
        return {
          host: url.hostname,
          port: parseInt(url.port, 10),
          username: url.username || undefined,
          password: url.password || undefined,
          protocol: protocol as any,
        };
      } else {
        // Try simple format: host:port
        const parts = proxyString.split(':');
        if (parts.length === 2 && !isNaN(parseInt(parts[1], 10))) {
          const port = parseInt(parts[1], 10);
          
          // Auto-detect SOCKS proxies based on common ports
          let protocol: ProxyConfig['protocol'] = 'http';
          if (port === 1080 || port === 1081) {
            protocol = 'socks5'; // Common SOCKS5 ports
          } else if (port === 9050 || port === 9150) {
            protocol = 'socks5'; // Tor SOCKS ports
          }
          
          return {
            host: parts[0],
            port: port,
            protocol: protocol,
          };
        }
      }
      
      return null;
    } catch {
      return null;
    }
  }
  
  /**
   * Get a unique key for a proxy
   */
  private getProxyKey(proxy: ProxyConfig): string {
    return `${proxy.protocol || 'http'}://${proxy.host}:${proxy.port}`;
  }
  
  /**
   * Get the next available proxy based on rotation strategy
   */
  getNextProxy(): ProxyConfig | undefined {
    const availableProxies = this.getAvailableProxies();
    
    if (availableProxies.length === 0) {
      console.warn('No available proxies in the pool');
      return undefined;
    }
    
    let selectedProxy: ProxyConfig;
    
    switch (this.rotationStrategy) {
      case 'random':
        selectedProxy = availableProxies[Math.floor(Math.random() * availableProxies.length)];
        break;
        
      case 'performance':
        selectedProxy = this.getBestPerformingProxy(availableProxies);
        break;
        
      case 'least-used':
        selectedProxy = this.getLeastUsedProxy(availableProxies);
        break;
        
      case 'round-robin':
      default:
        this.currentIndex = (this.currentIndex + 1) % availableProxies.length;
        selectedProxy = availableProxies[this.currentIndex];
        break;
    }
    
    // Update last used time
    const key = this.getProxyKey(selectedProxy);
    const stats = this.proxyStats.get(key);
    if (stats) {
      stats.lastUsed = new Date();
    }
    
    return selectedProxy;
  }
  
  /**
   * Get proxies that are not blacklisted
   */
  private getAvailableProxies(): ProxyConfig[] {
    const now = new Date();
    
    return this.proxies.filter(proxy => {
      const key = this.getProxyKey(proxy);
      const stats = this.proxyStats.get(key);
      
      if (!stats) return true;
      
      // Check if blacklisted
      if (stats.blacklistedUntil && stats.blacklistedUntil > now) {
        return false;
      }
      
      // Clear blacklist if expired
      if (stats.blacklistedUntil && stats.blacklistedUntil <= now) {
        stats.blacklistedUntil = undefined;
        stats.failureCount = 0;
      }
      
      return true;
    });
  }
  
  /**
   * Get the best performing proxy based on success rate and response time
   */
  private getBestPerformingProxy(proxies: ProxyConfig[]): ProxyConfig {
    let bestProxy = proxies[0];
    let bestScore = -Infinity;
    
    for (const proxy of proxies) {
      const key = this.getProxyKey(proxy);
      const stats = this.proxyStats.get(key);
      
      if (!stats) continue;
      
      // Calculate score based on success rate and response time
      const totalRequests = stats.successCount + stats.failureCount;
      const successRate = totalRequests > 0 ? stats.successCount / totalRequests : 0;
      const responseTimeScore = stats.avgResponseTime > 0 ? 1000 / stats.avgResponseTime : 1;
      
      const score = successRate * 100 + responseTimeScore;
      
      if (score > bestScore) {
        bestScore = score;
        bestProxy = proxy;
      }
    }
    
    return bestProxy;
  }
  
  /**
   * Get the least recently used proxy
   */
  private getLeastUsedProxy(proxies: ProxyConfig[]): ProxyConfig {
    let leastUsedProxy = proxies[0];
    let oldestTime = new Date();
    
    for (const proxy of proxies) {
      const key = this.getProxyKey(proxy);
      const stats = this.proxyStats.get(key);
      
      if (!stats) return proxy; // Never used
      
      if (stats.lastUsed < oldestTime) {
        oldestTime = stats.lastUsed;
        leastUsedProxy = proxy;
      }
    }
    
    return leastUsedProxy;
  }
  
  /**
   * Report successful proxy usage
   */
  reportSuccess(proxy: ProxyConfig, responseTime: number): void {
    const key = this.getProxyKey(proxy);
    const stats = this.proxyStats.get(key);
    
    if (stats) {
      stats.successCount++;
      // Update average response time
      const totalRequests = stats.successCount + stats.failureCount;
      stats.avgResponseTime = (stats.avgResponseTime * (totalRequests - 1) + responseTime) / totalRequests;
    }
  }
  
  /**
   * Report failed proxy usage
   */
  reportFailure(proxy: ProxyConfig, error: string): void {
    const key = this.getProxyKey(proxy);
    const stats = this.proxyStats.get(key);
    
    if (stats) {
      stats.failureCount++;
      stats.lastError = error;
      
      // Blacklist if too many failures
      if (stats.failureCount >= this.maxFailures) {
        stats.blacklistedUntil = new Date(Date.now() + this.blacklistDuration);
        console.warn(`Proxy ${key} blacklisted for ${this.blacklistDuration}ms due to ${stats.failureCount} failures`);
      }
    }
  }
  
  /**
   * Get statistics for all proxies
   */
  getStats(): Map<string, ProxyStats> {
    return new Map(this.proxyStats);
  }
  
  /**
   * Get number of available proxies
   */
  getAvailableCount(): number {
    return this.getAvailableProxies().length;
  }
  
  /**
   * Reset all proxy statistics
   */
  resetStats(): void {
    this.proxyStats.forEach(stats => {
      stats.successCount = 0;
      stats.failureCount = 0;
      stats.lastError = undefined;
      stats.blacklistedUntil = undefined;
      stats.avgResponseTime = 0;
    });
  }
  
  /**
   * Check if proxy manager has any proxies configured
   */
  hasProxies(): boolean {
    return this.proxies.length > 0;
  }
  
  /**
   * Get total number of proxies
   */
  getProxyCount(): number {
    return this.proxies.length;
  }
  
  /**
   * Get number of available (non-blacklisted) proxies
   */
  getAvailableProxyCount(): number {
    return this.getAvailableProxies().length;
  }
}

// Export singleton instance for convenience
export const defaultProxyManager = ProxyManager.fromEnv();