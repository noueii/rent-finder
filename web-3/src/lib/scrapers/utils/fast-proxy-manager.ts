/**
 * Fast Proxy Manager - Optimized for speed
 * Implements concurrent health checking, smart caching, and performance-based selection
 */

import { ProxyManager } from './proxy-manager';
import type { ProxyStats } from './proxy-manager';
import type { ProxyConfig } from '~/types/scraper';
import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
import httpsProxyAgent from 'https-proxy-agent';
import pLimit from 'p-limit';

const { HttpsProxyAgent } = httpsProxyAgent;

interface FastProxyStats extends ProxyStats {
  healthScore: number; // 0-100, higher is better
  lastHealthCheck: Date;
  consecutiveSuccesses: number;
  recentLatencies: number[]; // Last 10 response times
}

export class FastProxyManager extends ProxyManager {
  private fastStats: Map<string, FastProxyStats> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private topPerformers: ProxyConfig[] = []; // Cache of best proxies
  private concurrencyLimit = pLimit(50); // Increased for faster health checks
  
  constructor(config?: any) {
    super(config);
    this.initializeFastStats();
    // Don't start health checking - it causes hanging
  }
  
  /**
   * Initialize enhanced stats for each proxy
   */
  private initializeFastStats(): void {
    this.proxies.forEach(proxy => {
      const key = this.getProxyKey(proxy);
      this.fastStats.set(key, {
        ...this.proxyStats.get(key)!,
        healthScore: 50, // Start neutral
        lastHealthCheck: new Date(0),
        consecutiveSuccesses: 0,
        recentLatencies: [],
      });
    });
  }
  
  /**
   * Get proxy key (make it public for fast manager)
   */
  public getProxyKey(proxy: ProxyConfig): string {
    return `${proxy.protocol || 'http'}://${proxy.host}:${proxy.port}`;
  }
  
  /**
   * Start background health checking
   */
  private startHealthChecking(): void {
    // Initial health check - DON'T BLOCK, run in background
    console.log('🏥 Scheduling background proxy health check...');
    setImmediate(() => {
      this.performHealthCheck().catch(console.error);
    });
    
    // Schedule regular health checks every 5 minutes
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck().catch(console.error);
    }, 300000); // 5 minutes
  }
  
  /**
   * Perform concurrent health checks on all proxies
   */
  private async performHealthCheck(): Promise<void> {
    console.log('🏥 Starting proxy health check...');
    const startTime = Date.now();
    
    // Test all proxies concurrently with limit
    const healthPromises = this.proxies.map(proxy => 
      this.concurrencyLimit(() => this.checkProxyHealth(proxy))
    );
    
    await Promise.allSettled(healthPromises);
    
    // Update top performers cache
    this.updateTopPerformers();
    
    const duration = Date.now() - startTime;
    const healthy = this.topPerformers.length;
    console.log(`✅ Health check complete: ${healthy}/${this.proxies.length} healthy proxies (${duration}ms)`);
  }
  
  /**
   * Check health of a single proxy
   */
  private async checkProxyHealth(proxy: ProxyConfig): Promise<void> {
    const key = this.getProxyKey(proxy);
    const stats = this.fastStats.get(key);
    if (!stats) return;
    
    try {
      const proxyUrl = `${proxy.protocol}://${proxy.host}:${proxy.port}`;
      const agent = proxy.protocol === 'socks5' 
        ? new SocksProxyAgent(proxyUrl)
        : new HttpsProxyAgent(proxyUrl);
      
      const startTime = Date.now();
      const response = await axios.get('https://api.ipify.org?format=json', {
        httpsAgent: agent,
        httpAgent: agent,
        timeout: 5000, // Quick timeout for health check
      });
      
      const latency = Date.now() - startTime;
      
      // Update stats
      stats.recentLatencies.push(latency);
      if (stats.recentLatencies.length > 10) {
        stats.recentLatencies.shift();
      }
      
      stats.consecutiveSuccesses++;
      stats.lastHealthCheck = new Date();
      
      // Calculate health score (0-100)
      const avgLatency = stats.recentLatencies.reduce((a, b) => a + b, 0) / stats.recentLatencies.length;
      const latencyScore = Math.max(0, 100 - (avgLatency / 50)); // 5s = 0 score
      const reliabilityScore = Math.min(100, stats.consecutiveSuccesses * 10);
      stats.healthScore = (latencyScore + reliabilityScore) / 2;
      
      // Clear any blacklist
      stats.blacklistedUntil = undefined;
      
    } catch (error) {
      stats.consecutiveSuccesses = 0;
      stats.healthScore = Math.max(0, stats.healthScore - 20);
      stats.lastHealthCheck = new Date();
      
      // Blacklist if score too low
      if (stats.healthScore < 10) {
        stats.blacklistedUntil = new Date(Date.now() + 600000); // 10 min
      }
    }
  }
  
  /**
   * Update cache of top performing proxies
   */
  private updateTopPerformers(): void {
    const availableProxies = this.getAvailableProxies();
    
    // Sort by health score
    const sorted = availableProxies.sort((a, b) => {
      const aStats = this.fastStats.get(this.getProxyKey(a));
      const bStats = this.fastStats.get(this.getProxyKey(b));
      return (bStats?.healthScore || 0) - (aStats?.healthScore || 0);
    });
    
    // Keep top 20% or at least 10 proxies
    const topCount = Math.max(10, Math.floor(sorted.length * 0.2));
    this.topPerformers = sorted.slice(0, topCount);
  }
  
  /**
   * Get next proxy - optimized for speed
   */
  getNextProxy(): ProxyConfig | undefined {
    // Since we're not doing health checks, just use all available proxies
    const pool = this.getAvailableProxies();
    
    if (pool.length === 0) {
      console.warn('No available proxies in the pool');
      return undefined;
    }
    
    // For performance strategy, just rotate through all
    if (this.rotationStrategy === 'performance' && pool.length > 0) {
      this.currentIndex = (this.currentIndex + 1) % pool.length;
      return pool[this.currentIndex];
    }
    
    // For round-robin, rotate through all proxies
    if (this.rotationStrategy === 'round-robin') {
      this.currentIndex = (this.currentIndex + 1) % pool.length;
      return pool[this.currentIndex];
    }
    
    // Random selection from all proxies
    return pool[Math.floor(Math.random() * pool.length)];
  }
  
  /**
   * Get multiple proxies at once for concurrent requests
   */
  getProxyBatch(count: number): ProxyConfig[] {
    const pool = this.getAvailableProxies();
    const batch: ProxyConfig[] = [];
    const used = new Set<string>();
    
    for (let i = 0; i < count && i < pool.length; i++) {
      let proxy: ProxyConfig;
      
      // Try to get unique proxies
      do {
        proxy = pool[Math.floor(Math.random() * pool.length)];
      } while (used.has(this.getProxyKey(proxy)) && used.size < pool.length);
      
      used.add(this.getProxyKey(proxy));
      batch.push(proxy);
    }
    
    return batch;
  }
  
  /**
   * Report success with enhanced tracking
   */
  reportSuccess(proxy: ProxyConfig, responseTime: number): void {
    super.reportSuccess(proxy, responseTime);
    
    const key = this.getProxyKey(proxy);
    const stats = this.fastStats.get(key);
    
    if (stats) {
      // Update latency tracking
      stats.recentLatencies.push(responseTime);
      if (stats.recentLatencies.length > 10) {
        stats.recentLatencies.shift();
      }
      
      // Boost health score for success
      stats.healthScore = Math.min(100, stats.healthScore + 2);
      stats.consecutiveSuccesses++;
    }
  }
  
  /**
   * Report failure with smart blacklisting
   */
  reportFailure(proxy: ProxyConfig, error: string): void {
    super.reportFailure(proxy, error);
    
    const key = this.getProxyKey(proxy);
    const stats = this.fastStats.get(key);
    
    if (stats) {
      stats.consecutiveSuccesses = 0;
      stats.healthScore = Math.max(0, stats.healthScore - 10);
      
      // Quick blacklist for timeout errors
      if (error.includes('timeout') || error.includes('ETIMEDOUT')) {
        stats.blacklistedUntil = new Date(Date.now() + 60000); // 1 min for timeouts
      }
    }
  }
  
  /**
   * Get proxy statistics summary
   */
  getHealthSummary(): { total: number; healthy: number; avgLatency: number; topProxy: string | null } {
    const healthyProxies = this.topPerformers;
    let totalLatency = 0;
    let latencyCount = 0;
    let topProxy: string | null = null;
    let topScore = 0;
    
    this.fastStats.forEach((stats, key) => {
      if (stats.recentLatencies.length > 0) {
        const avgLatency = stats.recentLatencies.reduce((a, b) => a + b, 0) / stats.recentLatencies.length;
        totalLatency += avgLatency;
        latencyCount++;
      }
      
      if (stats.healthScore > topScore) {
        topScore = stats.healthScore;
        topProxy = key;
      }
    });
    
    return {
      total: this.proxies.length,
      healthy: healthyProxies.length,
      avgLatency: latencyCount > 0 ? totalLatency / latencyCount : 0,
      topProxy,
    };
  }
  
  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}