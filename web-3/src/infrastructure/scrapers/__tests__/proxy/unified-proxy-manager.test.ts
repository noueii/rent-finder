/**
 * Tests for Unified Proxy Manager
 * Validates proxy rotation, health monitoring, and agent creation
 */


import { UnifiedProxyManager, type UnifiedProxyConfig } from '../../proxy/UnifiedProxyManager';
import type { ProxyConfig } from '~/types/scraper';
import * as fs from 'fs';
import axios from 'axios';

// Mock modules
jest.mock('fs');
jest.mock('axios');
jest.mock('p-limit', () => ({
  default: () => (fn: Function) => fn()
}));

describe('UnifiedProxyManager', () => {
  let manager: UnifiedProxyManager;
  let mockProxies: ProxyConfig[];
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockProxies = [
      { host: 'proxy1.test.com', port: 8080, protocol: 'http' },
      { host: 'proxy2.test.com', port: 8080, protocol: 'http', auth: { username: 'user', password: 'pass' } },
      { host: 'proxy3.test.com', port: 1080, protocol: 'socks5' }
    ];
    
    // Mock environment variables
    process.env.PROXY_LIST = '';
    process.env.PROXY_FILE = '';
    process.env.PROXY_HOST = '';
  });
  
  afterEach(() => {
    if (manager) {
      manager.destroy();
    }
  });
  
  describe('constructor', () => {
    it('should initialize with default config', () => {
      manager = new UnifiedProxyManager();
      expect(manager).toBeDefined();
      expect(manager.hasProxies()).toBe(false);
    });
    
    it('should initialize with proxies', () => {
      manager = new UnifiedProxyManager({
        proxies: mockProxies
      });
      
      expect(manager.hasProxies()).toBe(true);
      expect(manager.getProxyCount()).toBe(3);
    });
    
    it('should start health checks if interval specified', async () => {
      jest.useFakeTimers();
      
      manager = new UnifiedProxyManager({
        proxies: mockProxies,
        healthCheckInterval: 1000,
        performHealthCheck: false
      });
      
      const performHealthCheckSpy = jest.spyOn(manager as any, 'performHealthCheck');
      performHealthCheckSpy.mockResolvedValue(undefined);
      
      // Advance time to trigger health check
      await jest.advanceTimersByTimeAsync(1100);
      
      expect(performHealthCheckSpy).toHaveBeenCalled();
      
      jest.useRealTimers();
    });
  });
  
  describe('fromEnv', () => {
    it('should load proxies from PROXY_LIST env var', () => {
      process.env.PROXY_LIST = 'http://proxy1.test:8080,socks5://user:pass@proxy2.test:1080';
      
      manager = UnifiedProxyManager.fromEnv();
      
      expect(manager.hasProxies()).toBe(true);
      expect(manager.getProxyCount()).toBe(2);
    });
    
    it('should load proxies from file', () => {
      const mockFileContent = 'http://proxy1.test:8080\nsocks5://proxy2.test:1080\n# Comment line\n\nhttp://proxy3.test:8080';
      (fs.readFileSync as Mock).mockReturnValue(mockFileContent);
      (fs.existsSync as Mock).mockReturnValue(true);
      
      process.env.PROXY_FILE = '/path/to/proxies.txt';
      
      manager = UnifiedProxyManager.fromEnv();
      
      expect(manager.hasProxies()).toBe(true);
      expect(manager.getProxyCount()).toBe(3);
    });
    
    it('should load single proxy from env vars', () => {
      process.env.PROXY_HOST = 'proxy.test.com';
      process.env.PROXY_PORT = '8080';
      process.env.PROXY_USERNAME = 'testuser';
      process.env.PROXY_PASSWORD = 'testpass';
      
      manager = UnifiedProxyManager.fromEnv();
      
      expect(manager.hasProxies()).toBe(true);
      expect(manager.getProxyCount()).toBe(1);
      
      const proxy = manager.getNextProxy();
      expect(proxy).toEqual({
        host: 'proxy.test.com',
        port: 8080,
        protocol: 'http',
        auth: {
          username: 'testuser',
          password: 'testpass'
        }
      });
    });
  });
  
  describe('rotation strategies', () => {
    beforeEach(() => {
      manager = new UnifiedProxyManager({
        proxies: mockProxies
      });
    });
    
    it('should rotate round-robin', () => {
      manager = new UnifiedProxyManager({
        proxies: mockProxies,
        rotationStrategy: 'round-robin'
      });
      
      const proxy1 = manager.getNextProxy();
      const proxy2 = manager.getNextProxy();
      const proxy3 = manager.getNextProxy();
      const proxy4 = manager.getNextProxy();
      
      expect(proxy1?.host).toBe('proxy1.test.com');
      expect(proxy2?.host).toBe('proxy2.test.com');
      expect(proxy3?.host).toBe('proxy3.test.com');
      expect(proxy4?.host).toBe('proxy1.test.com'); // Back to start
    });
    
    it('should rotate randomly', () => {
      manager = new UnifiedProxyManager({
        proxies: mockProxies,
        rotationStrategy: 'random'
      });
      
      const selectedHosts = new Set<string>();
      
      // Get many proxies to ensure randomness
      for (let i = 0; i < 20; i++) {
        const proxy = manager.getNextProxy();
        if (proxy) {
          selectedHosts.add(proxy.host);
        }
      }
      
      // Should have selected all proxies at least once
      expect(selectedHosts.size).toBe(3);
    });
    
    it('should select by performance', () => {
      manager = new UnifiedProxyManager({
        proxies: mockProxies,
        rotationStrategy: 'performance'
      });
      
      // Report different performance for each proxy
      manager.reportSuccess(mockProxies[0], 100); // Fast
      manager.reportSuccess(mockProxies[1], 500); // Medium
      manager.reportSuccess(mockProxies[2], 1000); // Slow
      
      // Update top performers
      manager['updateTopPerformers']();
      
      // Should prefer faster proxies
      const proxy = manager.getNextProxy();
      expect(proxy?.host).toBe('proxy1.test.com');
    });
    
    it('should select least used', () => {
      manager = new UnifiedProxyManager({
        proxies: mockProxies,
        rotationStrategy: 'least-used'
      });
      
      // Use first proxy multiple times
      manager.getNextProxy(); // proxy1
      manager.reportSuccess(mockProxies[0], 100);
      manager.getNextProxy(); // proxy2
      manager.reportSuccess(mockProxies[1], 100);
      manager.getNextProxy(); // proxy3
      
      // Next should be proxy3 (least used)
      const proxy = manager.getNextProxy();
      expect(proxy?.host).toBe('proxy3.test.com');
    });
  });
  
  describe('blacklisting', () => {
    beforeEach(() => {
      manager = new UnifiedProxyManager({
        proxies: mockProxies,
        maxFailures: 2,
        blacklistDuration: 1000
      });
    });
    
    it('should blacklist proxy after max failures', () => {
      const proxy = mockProxies[0];
      
      // Report failures
      manager.reportFailure(proxy, 'Connection failed');
      manager.reportFailure(proxy, 'Connection failed');
      
      // Proxy should be blacklisted
      const stats = manager['proxyStats'].get(manager['getProxyKey'](proxy));
      expect(stats?.blacklistedUntil).toBeDefined();
      expect(stats?.blacklistedUntil!.getTime()).toBeGreaterThan(Date.now());
    });
    
    it('should not return blacklisted proxies', () => {
      // Blacklist first two proxies
      manager.reportFailure(mockProxies[0], 'Failed');
      manager.reportFailure(mockProxies[0], 'Failed');
      manager.reportFailure(mockProxies[1], 'Failed');
      manager.reportFailure(mockProxies[1], 'Failed');
      
      // Only third proxy should be returned
      const proxy = manager.getNextProxy();
      expect(proxy?.host).toBe('proxy3.test.com');
      
      // Next call should also return third proxy
      const proxy2 = manager.getNextProxy();
      expect(proxy2?.host).toBe('proxy3.test.com');
    });
    
    it('should unblacklist proxy after duration', async () => {
      jest.useFakeTimers();
      
      const proxy = mockProxies[0];
      
      // Blacklist proxy
      manager.reportFailure(proxy, 'Failed');
      manager.reportFailure(proxy, 'Failed');
      
      // Advance time past blacklist duration
      jest.advanceTimersByTime(1100);
      
      // Proxy should be available again
      const availableProxy = manager.getNextProxy();
      expect(availableProxy).toBeDefined();
      
      jest.useRealTimers();
    });
  });
  
  describe('health monitoring', () => {
    beforeEach(() => {
      manager = new UnifiedProxyManager({
        proxies: mockProxies
      });
    });
    
    it('should track success metrics', () => {
      const proxy = mockProxies[0];
      
      manager.reportSuccess(proxy, 100);
      manager.reportSuccess(proxy, 200);
      manager.reportSuccess(proxy, 150);
      
      const stats = manager['proxyStats'].get(manager['getProxyKey'](proxy));
      
      expect(stats?.successCount).toBe(3);
      expect(stats?.avgResponseTime).toBeCloseTo(150, 0);
      expect(stats?.healthScore).toBeGreaterThan(50);
    });
    
    it('should track failure metrics', () => {
      const proxy = mockProxies[0];
      
      manager.reportFailure(proxy, 'Connection timeout');
      
      const stats = manager['proxyStats'].get(manager['getProxyKey'](proxy));
      
      expect(stats?.failureCount).toBe(1);
      expect(stats?.lastError).toBe('Connection timeout');
      expect(stats?.healthScore).toBeLessThan(100);
    });
    
    it('should calculate health score correctly', () => {
      const proxy = mockProxies[0];
      
      // Mix of successes and failures
      manager.reportSuccess(proxy, 100);
      manager.reportSuccess(proxy, 200);
      manager.reportFailure(proxy, 'Error');
      manager.reportSuccess(proxy, 150);
      
      const stats = manager['proxyStats'].get(manager['getProxyKey'](proxy));
      const score = stats?.healthScore || 0;
      
      // Score should be between 0 and 100
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(100);
      // With 3 successes and 1 failure, score should be around 75
      expect(score).toBeCloseTo(75, -1);
    });
  });
  
  describe('health checks', () => {
    beforeEach(() => {
      (axios.get as Mock).mockResolvedValue({ 
        status: 200,
        data: { ip: '1.2.3.4' }
      });
    });
    
    it('should perform health check on all proxies', async () => {
      manager = new UnifiedProxyManager({
        proxies: mockProxies,
        performHealthCheck: true
      });
      
      await manager['performHealthCheck']();
      
      expect(axios.get).toHaveBeenCalledTimes(3);
      
      // All proxies should have health check timestamp
      for (const proxy of mockProxies) {
        const stats = manager['proxyStats'].get(manager['getProxyKey'](proxy));
        expect(stats?.lastHealthCheck).toBeDefined();
      }
    });
    
    it('should handle health check failures', async () => {
      (axios.get as Mock)
        .mockResolvedValueOnce({ status: 200 })
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValueOnce({ status: 200 });
      
      manager = new UnifiedProxyManager({
        proxies: mockProxies
      });
      
      await manager['performHealthCheck']();
      
      // Check that failure was recorded
      const stats = manager['proxyStats'].get(manager['getProxyKey'](mockProxies[1]));
      expect(stats?.failureCount).toBeGreaterThan(0);
    });
  });
  
  describe('proxy agents', () => {
    beforeEach(() => {
      manager = new UnifiedProxyManager({
        proxies: mockProxies
      });
    });
    
    it('should create HTTP proxy agents', () => {
      const proxy = mockProxies[0];
      const agents = manager.createProxyAgents('http://example.com', proxy);
      
      expect(agents.httpAgent).toBeDefined();
      expect(agents.httpsAgent).toBeDefined();
    });
    
    it('should create SOCKS proxy agent', () => {
      const proxy = mockProxies[2]; // SOCKS5 proxy
      const agents = manager.createProxyAgents('http://example.com', proxy);
      
      expect(agents.httpAgent).toBeDefined();
      expect(agents.httpsAgent).toBeDefined();
    });
    
    it('should handle auth in proxy URL', () => {
      const proxy = mockProxies[1]; // Has auth
      const url = manager['formatProxyUrl'](proxy);
      
      expect(url).toBe('http://user:pass@proxy2.test.com:8080');
    });
  });
  
  describe('summary and statistics', () => {
    it('should provide accurate summary', () => {
      manager = new UnifiedProxyManager({
        proxies: mockProxies,
        maxFailures: 2
      });
      
      // Create some activity
      manager.reportSuccess(mockProxies[0], 100);
      manager.reportFailure(mockProxies[1], 'Failed');
      manager.reportFailure(mockProxies[1], 'Failed'); // Blacklist
      
      const summary = manager.getSummary();
      
      expect(summary.total).toBe(3);
      expect(summary.active).toBe(2);
      expect(summary.blacklisted).toBe(1);
      expect(summary.byProtocol.http).toBe(2);
      expect(summary.byProtocol.socks5).toBe(1);
      expect(summary.averageHealthScore).toBeGreaterThan(0);
      expect(summary.totalRequests).toBe(1);
      expect(summary.totalFailures).toBe(2);
    });
    
    it('should export/import proxy stats', () => {
      manager = new UnifiedProxyManager({
        proxies: mockProxies
      });
      
      // Create some stats
      manager.reportSuccess(mockProxies[0], 100);
      manager.reportSuccess(mockProxies[0], 200);
      manager.reportFailure(mockProxies[1], 'Error');
      
      // Export stats
      const exported = manager.exportStats();
      
      // Create new manager and import
      const newManager = new UnifiedProxyManager({
        proxies: mockProxies
      });
      newManager.importStats(exported);
      
      // Verify stats were imported
      const stats = newManager['proxyStats'].get(newManager['getProxyKey'](mockProxies[0]));
      expect(stats?.successCount).toBe(2);
      expect(stats?.avgResponseTime).toBeCloseTo(150, 0);
    });
  });
  
  describe('destroy', () => {
    it('should clean up resources', () => {
      jest.useFakeTimers();
      
      manager = new UnifiedProxyManager({
        proxies: mockProxies,
        healthCheckInterval: 1000
      });
      
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      manager.destroy();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      
      jest.useRealTimers();
    });
  });
});