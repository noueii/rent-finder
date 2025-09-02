/**
 * Unified Proxy Manager
 * Consolidates proxy management with multiple rotation strategies,
 * health monitoring, and agent creation
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ProxyConfig } from '~/types/scraper';
import type { AxiosRequestConfig } from 'axios';
import axios from 'axios';
import pLimit from 'p-limit';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';

export interface ProxyStats {
  successCount: number;
  failureCount: number;
  lastUsed: Date;
  lastError?: string;
  avgResponseTime: number;
  blacklistedUntil?: Date;
  healthScore: number; // 0-100, higher is better
  lastHealthCheck?: Date;
  consecutiveSuccesses: number;
  recentLatencies: number[]; // Last 10 response times
}

export type RotationStrategy = 'round-robin' | 'random' | 'performance' | 'least-used';

export interface UnifiedProxyConfig {
  proxies?: ProxyConfig[];
  rotationStrategy?: RotationStrategy;
  healthCheckInterval?: number; // milliseconds, 0 to disable
  blacklistDuration?: number; // milliseconds
  maxFailures?: number; // failures before blacklisting
  performHealthCheck?: boolean; // whether to perform initial health check
  concurrentHealthChecks?: number; // max concurrent health check requests
}

export class UnifiedProxyManager {
  private proxies: ProxyConfig[] = [];
  private proxyStats: Map<string, ProxyStats> = new Map();
  private currentIndex: number = 0;
  private rotationStrategy: RotationStrategy;
  private blacklistDuration: number;
  private maxFailures: number;
  private healthCheckInterval?: NodeJS.Timeout;
  private concurrencyLimit: ReturnType<typeof pLimit>;
  private topPerformers: ProxyConfig[] = [];

  constructor(config: UnifiedProxyConfig = {}) {
    this.rotationStrategy = config.rotationStrategy || 'round-robin';
    this.blacklistDuration = config.blacklistDuration || 300000; // 5 minutes
    this.maxFailures = config.maxFailures || 3;
    this.concurrencyLimit = pLimit(config.concurrentHealthChecks || 10);

    if (config.proxies) {
      this.addProxies(config.proxies);
    }

    // Start health checks if interval specified
    if (config.healthCheckInterval && config.healthCheckInterval > 0) {
      this.startHealthChecks(config.healthCheckInterval);
    }

    // Perform initial health check if requested
    if (config.performHealthCheck && this.proxies.length > 0) {
      setImmediate(() => {
        this.performHealthCheck().catch(console.error);
      });
    }
  }

  /**
   * Create from environment variables
   */
  static fromEnv(config: Partial<UnifiedProxyConfig> = {}): UnifiedProxyManager {
    const proxies: ProxyConfig[] = [];
    
    // Load from PROXY_LIST env var
    const proxyList = process.env.PROXY_LIST || '';
    if (proxyList) {
      const proxyStrings = proxyList.split(',').map(p => p.trim()).filter(Boolean);
      for (const proxyString of proxyStrings) {
        const proxy = UnifiedProxyManager.parseProxyString(proxyString);
        if (proxy) proxies.push(proxy);
      }
    }
    
    // Load from proxy file
    const proxyFile = process.env.PROXY_FILE || '';
    if (proxyFile || (!proxyList && !process.env.PROXY_HOST)) {
      const filePath = proxyFile || 'src/lib/scrapers/data/proxilist.txt';
      const loadedProxies = UnifiedProxyManager.loadFromFile(filePath);
      proxies.push(...loadedProxies);
    }
    
    // Single proxy from env vars
    if (process.env.PROXY_HOST) {
      proxies.push({
        host: process.env.PROXY_HOST,
        port: parseInt(process.env.PROXY_PORT || '8080', 10),
        username: process.env.PROXY_USERNAME,
        password: process.env.PROXY_PASSWORD,
        protocol: (process.env.PROXY_PROTOCOL as any) || 'http',
      });
    }
    
    const strategy = (process.env.PROXY_ROTATION_STRATEGY as RotationStrategy) || config.rotationStrategy;
    const blacklistDuration = parseInt(process.env.PROXY_BLACKLIST_DURATION || '300000', 10);
    const maxFailures = parseInt(process.env.PROXY_MAX_FAILURES || '3', 10);
    
    return new UnifiedProxyManager({
      ...config,
      proxies,
      rotationStrategy: strategy,
      blacklistDuration,
      maxFailures,
    });
  }

  /**
   * Load proxies from a file
   */
  static loadFromFile(filePath: string): ProxyConfig[] {
    const proxies: ProxyConfig[] = [];
    
    try {
      const fullPath = path.resolve(process.cwd(), filePath);
      if (!fs.existsSync(fullPath)) {
        console.warn(`Proxy file not found: ${fullPath}`);
        return proxies;
      }
      
      const fileContent = fs.readFileSync(fullPath, 'utf-8');
      const lines = fileContent.split('\n');
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) continue;
        if (trimmedLine.toLowerCase().includes('free proxies') || 
            trimmedLine.toLowerCase().includes('updated at') ||
            !trimmedLine.includes(':')) continue;
        
        const proxy = UnifiedProxyManager.parseProxyString(trimmedLine);
        if (proxy) proxies.push(proxy);
      }
    } catch (error) {
      console.error(`Failed to load proxies from file: ${filePath}`, error);
    }
    
    return proxies;
  }

  /**
   * Parse proxy string format
   */
  static parseProxyString(proxyString: string): ProxyConfig | null {
    try {
      if (proxyString.includes('://')) {
        const url = new URL(proxyString);
        const protocol = url.protocol.replace(':', '').toLowerCase();
        
        if (!['http', 'https', 'socks4', 'socks5'].includes(protocol)) {
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
        const parts = proxyString.split(':');
        if (parts.length === 2 && !isNaN(parseInt(parts[1], 10))) {
          const port = parseInt(parts[1], 10);
          let protocol: ProxyConfig['protocol'] = 'http';
          
          // Auto-detect SOCKS proxies
          if (port === 1080 || port === 1081 || port === 9050 || port === 9150) {
            protocol = 'socks5';
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
   * Add multiple proxies
   */
  addProxies(proxies: ProxyConfig[]): void {
    for (const proxy of proxies) {
      this.addProxy(proxy);
    }
  }

  /**
   * Add a single proxy
   */
  addProxy(proxy: ProxyConfig): void {
    const key = this.getProxyKey(proxy);
    if (!this.proxyStats.has(key)) {
      this.proxies.push(proxy);
      this.proxyStats.set(key, {
        successCount: 0,
        failureCount: 0,
        lastUsed: new Date(0),
        avgResponseTime: 0,
        healthScore: 50,
        consecutiveSuccesses: 0,
        recentLatencies: [],
      });
    }
  }

  /**
   * Remove a proxy
   */
  removeProxy(proxy: ProxyConfig): void {
    const key = this.getProxyKey(proxy);
    this.proxies = this.proxies.filter(p => this.getProxyKey(p) !== key);
    this.proxyStats.delete(key);
  }

  /**
   * Get next proxy based on rotation strategy
   */
  getNextProxy(): ProxyConfig | undefined {
    const availableProxies = this.getAvailableProxies();
    
    if (availableProxies.length === 0) {
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
    const stats = this.proxyStats.get(this.getProxyKey(selectedProxy));
    if (stats) {
      stats.lastUsed = new Date();
    }
    
    return selectedProxy;
  }

  /**
   * Get multiple proxies for concurrent requests
   */
  getProxyBatch(count: number): ProxyConfig[] {
    const availableProxies = this.getAvailableProxies();
    const batch: ProxyConfig[] = [];
    const used = new Set<string>();
    
    for (let i = 0; i < count && i < availableProxies.length; i++) {
      let proxy: ProxyConfig;
      
      do {
        proxy = availableProxies[Math.floor(Math.random() * availableProxies.length)];
      } while (used.has(this.getProxyKey(proxy)) && used.size < availableProxies.length);
      
      used.add(this.getProxyKey(proxy));
      batch.push(proxy);
      
      // Update last used
      const stats = this.proxyStats.get(this.getProxyKey(proxy));
      if (stats) {
        stats.lastUsed = new Date();
      }
    }
    
    return batch;
  }

  /**
   * Create proxy agents for axios
   */
  createProxyAgents(targetUrl: string, proxy: ProxyConfig): Partial<AxiosRequestConfig> {
    let proxyUrl: string;
    
    if (proxy.username && proxy.password) {
      proxyUrl = `${proxy.protocol || 'http'}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
    } else {
      proxyUrl = `${proxy.protocol || 'http'}://${proxy.host}:${proxy.port}`;
    }
    
    const isTargetHttps = targetUrl.startsWith('https://');
    
    // Handle SOCKS proxies
    if (proxy.protocol === 'socks5' || proxy.protocol === 'socks4') {
      const socksAgent = new SocksProxyAgent(proxyUrl);
      socksAgent.timeout = 10000;
      return {
        httpsAgent: socksAgent,
        httpAgent: socksAgent,
        proxy: false,
      };
    }
    
    // Handle HTTP/HTTPS proxies
    if (isTargetHttps) {
      const httpsAgent = new HttpsProxyAgent(proxyUrl);
      httpsAgent.timeout = 10000;
      return {
        httpsAgent,
        proxy: false,
      };
    } else {
      const httpAgent = new HttpProxyAgent(proxyUrl);
      httpAgent.timeout = 10000;
      return {
        httpAgent,
        proxy: false,
      };
    }
  }

  /**
   * Report successful request
   */
  reportSuccess(proxy: ProxyConfig, responseTime: number): void {
    const stats = this.proxyStats.get(this.getProxyKey(proxy));
    
    if (stats) {
      stats.successCount++;
      stats.consecutiveSuccesses++;
      
      // Update average response time
      const totalRequests = stats.successCount + stats.failureCount;
      stats.avgResponseTime = (stats.avgResponseTime * (totalRequests - 1) + responseTime) / totalRequests;
      
      // Update recent latencies
      stats.recentLatencies.push(responseTime);
      if (stats.recentLatencies.length > 10) {
        stats.recentLatencies.shift();
      }
      
      // Boost health score
      stats.healthScore = Math.min(100, stats.healthScore + 2);
      
      // Clear blacklist if healthy
      if (stats.blacklistedUntil && stats.healthScore > 50) {
        stats.blacklistedUntil = undefined;
      }
    }
  }

  /**
   * Report failed request
   */
  reportFailure(proxy: ProxyConfig, error: string): void {
    const stats = this.proxyStats.get(this.getProxyKey(proxy));
    
    if (stats) {
      stats.failureCount++;
      stats.lastError = error;
      stats.consecutiveSuccesses = 0;
      stats.healthScore = Math.max(0, stats.healthScore - 10);
      
      // Blacklist if too many failures
      if (stats.failureCount >= this.maxFailures) {
        stats.blacklistedUntil = new Date(Date.now() + this.blacklistDuration);
      }
      
      // Quick blacklist for timeouts
      if (error.includes('timeout') || error.includes('ETIMEDOUT')) {
        stats.blacklistedUntil = new Date(Date.now() + 60000); // 1 min
      }
    }
  }

  /**
   * Get available (non-blacklisted) proxies
   */
  private getAvailableProxies(): ProxyConfig[] {
    const now = new Date();
    
    return this.proxies.filter(proxy => {
      const stats = this.proxyStats.get(this.getProxyKey(proxy));
      
      if (!stats) return true;
      
      // Check blacklist
      if (stats.blacklistedUntil && stats.blacklistedUntil > now) {
        return false;
      }
      
      // Clear expired blacklist
      if (stats.blacklistedUntil && stats.blacklistedUntil <= now) {
        stats.blacklistedUntil = undefined;
        stats.failureCount = 0;
      }
      
      return true;
    });
  }

  /**
   * Get best performing proxy
   */
  private getBestPerformingProxy(proxies: ProxyConfig[]): ProxyConfig {
    let bestProxy = proxies[0];
    let bestScore = -Infinity;
    
    for (const proxy of proxies) {
      const stats = this.proxyStats.get(this.getProxyKey(proxy));
      
      if (!stats) continue;
      
      // Use health score if available, otherwise calculate
      const score = stats.healthScore;
      
      if (score > bestScore) {
        bestScore = score;
        bestProxy = proxy;
      }
    }
    
    return bestProxy;
  }

  /**
   * Get least recently used proxy
   */
  private getLeastUsedProxy(proxies: ProxyConfig[]): ProxyConfig {
    let leastUsedProxy = proxies[0];
    let oldestTime = new Date();
    
    for (const proxy of proxies) {
      const stats = this.proxyStats.get(this.getProxyKey(proxy));
      
      if (!stats) return proxy; // Never used
      
      if (stats.lastUsed < oldestTime) {
        oldestTime = stats.lastUsed;
        leastUsedProxy = proxy;
      }
    }
    
    return leastUsedProxy;
  }

  /**
   * Perform health check on all proxies
   */
  private async performHealthCheck(): Promise<void> {
    const startTime = Date.now();
    
    const healthPromises = this.proxies.map(proxy => 
      this.concurrencyLimit(() => this.checkProxyHealth(proxy))
    );
    
    await Promise.allSettled(healthPromises);
    
    // Update top performers
    this.updateTopPerformers();
    
    const duration = Date.now() - startTime;
    const healthy = this.getAvailableProxies().length;
    console.log(`✅ Health check complete: ${healthy}/${this.proxies.length} healthy proxies (${duration}ms)`);
  }

  /**
   * Check health of a single proxy
   */
  private async checkProxyHealth(proxy: ProxyConfig): Promise<void> {
    const stats = this.proxyStats.get(this.getProxyKey(proxy));
    if (!stats) return;
    
    try {
      const startTime = Date.now();
      const agents = this.createProxyAgents('https://api.ipify.org', proxy);
      
      await axios.get('https://api.ipify.org?format=json', {
        ...agents,
        timeout: 5000,
      });
      
      const latency = Date.now() - startTime;
      
      // Update stats
      stats.recentLatencies.push(latency);
      if (stats.recentLatencies.length > 10) {
        stats.recentLatencies.shift();
      }
      
      stats.consecutiveSuccesses++;
      stats.lastHealthCheck = new Date();
      
      // Calculate health score
      const avgLatency = stats.recentLatencies.reduce((a, b) => a + b, 0) / stats.recentLatencies.length;
      const latencyScore = Math.max(0, 100 - (avgLatency / 50));
      const reliabilityScore = Math.min(100, stats.consecutiveSuccesses * 10);
      stats.healthScore = (latencyScore + reliabilityScore) / 2;
      
      stats.blacklistedUntil = undefined;
      
    } catch (error) {
      stats.consecutiveSuccesses = 0;
      stats.healthScore = Math.max(0, stats.healthScore - 20);
      stats.lastHealthCheck = new Date();
      
      if (stats.healthScore < 10) {
        stats.blacklistedUntil = new Date(Date.now() + 600000); // 10 min
      }
    }
  }

  /**
   * Update top performers cache
   */
  private updateTopPerformers(): void {
    const availableProxies = this.getAvailableProxies();
    
    const sorted = availableProxies.sort((a, b) => {
      const aStats = this.proxyStats.get(this.getProxyKey(a));
      const bStats = this.proxyStats.get(this.getProxyKey(b));
      return (bStats?.healthScore || 0) - (aStats?.healthScore || 0);
    });
    
    const topCount = Math.max(10, Math.floor(sorted.length * 0.2));
    this.topPerformers = sorted.slice(0, topCount);
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks(intervalMs: number): void {
    this.stopHealthChecks();
    
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck().catch(console.error);
    }, intervalMs);
  }

  /**
   * Stop health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  /**
   * Get proxy key
   */
  private getProxyKey(proxy: ProxyConfig): string {
    return `${proxy.protocol || 'http'}://${proxy.host}:${proxy.port}`;
  }

  /**
   * Get statistics
   */
  getStats(): Map<string, ProxyStats> {
    return new Map(this.proxyStats);
  }

  /**
   * Get summary
   */
  getSummary(): {
    total: number;
    available: number;
    blacklisted: number;
    topPerformers: number;
    avgHealthScore: number;
  } {
    const now = new Date();
    let blacklisted = 0;
    let totalHealthScore = 0;
    
    this.proxyStats.forEach(stats => {
      if (stats.blacklistedUntil && stats.blacklistedUntil > now) {
        blacklisted++;
      }
      totalHealthScore += stats.healthScore;
    });
    
    return {
      total: this.proxies.length,
      available: this.getAvailableProxies().length,
      blacklisted,
      topPerformers: this.topPerformers.length,
      avgHealthScore: this.proxies.length > 0 ? totalHealthScore / this.proxies.length : 0,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.proxyStats.forEach(stats => {
      stats.successCount = 0;
      stats.failureCount = 0;
      stats.lastError = undefined;
      stats.blacklistedUntil = undefined;
      stats.avgResponseTime = 0;
      stats.healthScore = 50;
      stats.consecutiveSuccesses = 0;
      stats.recentLatencies = [];
    });
  }

  /**
   * Check if has proxies
   */
  hasProxies(): boolean {
    return this.proxies.length > 0;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopHealthChecks();
  }
}

// Export singleton for convenience
export const defaultProxyManager = UnifiedProxyManager.fromEnv();