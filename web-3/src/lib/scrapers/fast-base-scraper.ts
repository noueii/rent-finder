import { BaseScraper } from './base-scraper';
import type { ScraperConfig, ScrapeResult } from '~/types/scraper';
import type { AxiosRequestConfig } from 'axios';
import axios from 'axios';
import pLimit from 'p-limit';
import { FastProxyManager } from './utils/fast-proxy-manager';
import { getScraperProxyConfig } from './config/proxy-config';
import { ProxyManager } from './utils/proxy-manager';
import { load } from 'cheerio';

/**
 * Fast Base Scraper - Optimized for speed with concurrent requests
 */
export abstract class FastBaseScraper extends BaseScraper {
  protected fastProxyManager?: FastProxyManager;
  protected concurrencyLimit: ReturnType<typeof pLimit>;
  protected enableConcurrentRequests: boolean = true;
  protected maxConcurrency: number = 20; // Default 20 concurrent workers
  
  constructor(config: ScraperConfig) {
    super(config);
    
    // Load proxy configuration for this specific scraper
    const scraperName = config.name?.toLowerCase().replace('fast', '').trim() || '';
    const proxyConfig = getScraperProxyConfig(scraperName);
    
    if (proxyConfig) {
      console.log(`[${config.name}] Loading ${proxyConfig.type} proxies from ${proxyConfig.file}`);
      
      // Load proxies from the configured file
      let proxies = ProxyManager.loadFromFile(proxyConfig.file);
      
      if (proxies.length > 0) {
        // Limit proxy pool size for faster initialization
        const maxProxies = 200; // Only use top 200 proxies
        if (proxies.length > maxProxies) {
          console.log(`[${config.name}] Limiting proxy pool from ${proxies.length} to ${maxProxies} for faster startup`);
          proxies = proxies.slice(0, maxProxies);
        }
        
        // Set the protocol for each proxy based on the config type
        proxies.forEach(proxy => {
          proxy.protocol = proxyConfig.type === 'http' ? 'http' : 'socks5';
          if (proxyConfig.username) proxy.username = proxyConfig.username;
          if (proxyConfig.password) proxy.password = proxyConfig.password;
        });
        
        // Create fast proxy manager with the loaded proxies
        this.fastProxyManager = new FastProxyManager({
          proxies,
          rotationStrategy: 'performance',
          maxFailures: 2,
        });
        this.proxyManager = this.fastProxyManager;
        
        console.log(`[${config.name}] Loaded ${proxies.length} ${proxyConfig.type} proxies`);
      }
    } else if (this.proxyManager && this.proxyManager.hasProxies()) {
      // Fall back to existing proxy manager if no specific config
      this.fastProxyManager = new FastProxyManager({
        proxies: this.proxyManager.getProxyCount() > 0 ? 
          this.proxyManager['proxies'] : [], // Access private property
        rotationStrategy: 'performance',
        maxFailures: 2,
      });
      this.proxyManager = this.fastProxyManager;
    }
    
    // Set up concurrency limiter
    this.concurrencyLimit = pLimit(this.maxConcurrency);
  }
  
  /**
   * Fetch multiple URLs concurrently
   */
  protected async fetchHtmlBatch(
    urls: string[],
    config?: AxiosRequestConfig
  ): Promise<ScrapeResult<string>[]> {
    if (!this.enableConcurrentRequests) {
      // Fall back to sequential if concurrent is disabled
      const results: ScrapeResult<string>[] = [];
      for (const url of urls) {
        results.push(await this.fetchHtml(url, config));
      }
      return results;
    }
    
    // Get a batch of proxies for concurrent requests
    const proxies = this.fastProxyManager?.getProxyBatch(urls.length) || [];
    
    // Track completed requests
    const completedResults: Map<number, ScrapeResult<string>> = new Map();
    
    // Create concurrent fetch promises with different proxies
    const fetchPromises = urls.map((url, index) => 
      this.concurrencyLimit(async () => {
        // Use a different proxy for each concurrent request
        const proxyConfig = proxies[index] ? {
          ...config,
          // Override getProxy to use specific proxy
          proxy: proxies[index]
        } : config;
        
        const result = await this.fetchHtmlWithProxy(url, {
          ...proxyConfig,
          timeout: this.config.timeout || 10000
        }, proxies[index]);
        
        // Store completed result
        completedResults.set(index, result);
        return result;
      })
    );
    
    // Wait for all to complete with timeout
    console.log(`[${this.getName()}] Waiting for ${fetchPromises.length} concurrent fetches...`);
    
    // Add a timeout wrapper
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Batch fetch timeout after 30 seconds')), 30000)
    );
    
    try {
      const results = await Promise.race([
        Promise.allSettled(fetchPromises),
        timeoutPromise
      ]) as PromiseSettledResult<ScrapeResult<string>>[];
      console.log(`[${this.getName()}] All fetches completed`);
      return results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          return {
            success: false,
            error: {
              code: 'CONCURRENT_FETCH_ERROR',
              message: result.reason?.message || 'Concurrent fetch failed',
              details: result.reason,
              retryable: true,
            },
            metadata: {
              url: urls[index],
              scrapedAt: new Date(),
              duration: 0,
              retries: 0,
            },
          };
        }
      });
    } catch (timeoutError) {
      console.error(`[${this.getName()}] Batch fetch timed out! Using ${completedResults.size} completed results`);
      // Return completed results + timeout errors for incomplete ones
      return urls.map((url, index) => {
        const completed = completedResults.get(index);
        if (completed) {
          return completed;
        }
        return {
          success: false,
          error: {
            code: 'TIMEOUT',
            message: 'Request timeout - no response after 30 seconds',
            details: timeoutError,
            retryable: true,
          },
          metadata: {
            url,
            scrapedAt: new Date(),
            duration: 30000,
            retries: 0,
          },
        };
      });
    }
  }
  
  /**
   * Fetch with specific proxy (bypasses rotation)
   */
  private async fetchHtmlWithProxy(
    url: string,
    config?: AxiosRequestConfig,
    proxy?: any
  ): Promise<ScrapeResult<string>> {
    // Add logging for RealEstate
    if (url.includes('realestate.co.jp')) {
      console.log(`[FastBaseScraper] Fetching RealEstate with proxy:`, url);
      console.log(`[FastBaseScraper] Proxy:`, proxy ? `${proxy.host}:${proxy.port}` : 'none');
    }
    
    // Temporarily override proxy selection
    const originalGetProxy = this.getProxy.bind(this);
    this.getProxy = () => proxy;
    
    try {
      // For RealEstate, use direct axios approach that we know works
      if (url.includes('realestate.co.jp') && proxy) {
        console.log(`[FastBaseScraper] Using direct axios for RealEstate`);
        try {
          const httpsProxyAgent = await import('https-proxy-agent');
          const { HttpsProxyAgent } = httpsProxyAgent.default || httpsProxyAgent;
          const agent = new HttpsProxyAgent(`http://${proxy.host}:${proxy.port}`);
          
          const directResponse = await axios.get(url, {
            httpsAgent: agent,
            timeout: 5000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en,ja;q=0.9',
            }
          });
          
          console.log(`[FastBaseScraper] RealEstate direct request SUCCESS for ${url}`);
          return {
            success: true,
            data: directResponse.data,
            metadata: {
              url,
              scrapedAt: new Date(),
              duration: Date.now() - Date.now(),
              retries: 0,
              proxy: `${proxy.host}:${proxy.port}`,
            },
          };
        } catch (directError: any) {
          console.error(`[FastBaseScraper] RealEstate direct request failed:`, directError.message);
          // Fall back to normal flow
        }
      }
      
      // Normal flow for other sites
      const configWithTimeout = {
        ...config,
        timeout: 5000 // Reduced to 5 seconds to fail faster on bad proxies
      };
      const result = await this.fetchHtml(url, configWithTimeout);
      
      if (url.includes('realestate.co.jp')) {
        console.log(`[FastBaseScraper] RealEstate fetch result:`, result.success ? 'SUCCESS' : 'FAILED');
        if (!result.success) {
          console.error(`[FastBaseScraper] RealEstate error:`, result.error);
        }
      }
      
      return result;
    } catch (error: any) {
      // If proxy failed, report it and try with a different proxy
      if (proxy && (error.code === 'ETIMEOUT' || error.code === 'ECONNABORTED')) {
        console.log(`[FastBaseScraper] Proxy ${proxy.host}:${proxy.port} timed out, blacklisting...`);
        this.fastProxyManager?.reportFailure(proxy, 'Socket timeout');
        
        // For RealEstate, try a direct axios request like we know works
        if (url.includes('realestate.co.jp')) {
          console.log(`[FastBaseScraper] Trying direct axios request for RealEstate...`);
          try {
            const httpsProxyAgent = await import('https-proxy-agent');
            const { HttpsProxyAgent } = httpsProxyAgent.default || httpsProxyAgent;
            const agent = new HttpsProxyAgent(`http://${proxy.host}:${proxy.port}`);
            
            const directResponse = await axios.get(url, {
              httpsAgent: agent,
              timeout: 5000,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en,ja;q=0.9',
              }
            });
            
            console.log(`[FastBaseScraper] Direct request SUCCESS!`);
            return {
              success: true,
              data: directResponse.data,
              metadata: {
                url,
                scrapedAt: new Date(),
                duration: Date.now() - (Date.now() - 5000),
                retries: 0,
                proxy: `${proxy.host}:${proxy.port}`,
              },
            };
          } catch (directError: any) {
            console.log(`[FastBaseScraper] Direct request also failed:`, directError.code);
          }
        }
        
        // Try once more with a different proxy
        const newProxy = this.fastProxyManager?.getNextProxy();
        if (newProxy && newProxy !== proxy) {
          console.log(`[FastBaseScraper] Retrying with new proxy: ${newProxy.host}:${newProxy.port}`);
          this.getProxy = () => newProxy;
          const retryResult = await this.fetchHtml(url, configWithTimeout);
          return retryResult;
        }
      }
      throw error;
    } finally {
      // Restore original proxy selection
      this.getProxy = originalGetProxy;
    }
  }
  
  /**
   * Optimized rate limiting for concurrent requests
   */
  protected async applyRateLimitBatch(count: number): Promise<void> {
    // For batch requests, apply rate limit once for the batch
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const batchRateLimit = this.config.rateLimit * count * 0.7; // 30% faster for batches
    
    if (timeSinceLastRequest < batchRateLimit) {
      const delay = batchRateLimit - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
  }
  
  /**
   * Pre-warm proxies for better performance
   */
  async warmupProxies(count: number = 10): Promise<void> {
    if (!this.fastProxyManager) return;
    
    console.log(`🔥 Warming up ${count} proxies...`);
    const startTime = Date.now();
    
    // Get proxies to warm up
    const proxies = this.fastProxyManager.getProxyBatch(count);
    
    // Test each proxy concurrently
    const warmupPromises = proxies.map(proxy => 
      this.concurrencyLimit(async () => {
        try {
          await this.fetchHtmlWithProxy('https://api.ipify.org', { timeout: 5000 }, proxy);
          this.fastProxyManager!.reportSuccess(proxy, Date.now() - startTime);
        } catch (error) {
          this.fastProxyManager!.reportFailure(proxy, error.message);
        }
      })
    );
    
    await Promise.allSettled(warmupPromises);
    
    const duration = Date.now() - startTime;
    const summary = this.fastProxyManager.getHealthSummary();
    console.log(`✅ Warmup complete: ${summary.healthy} healthy proxies, avg ${summary.avgLatency.toFixed(0)}ms (${duration}ms total)`);
  }
  
  /**
   * Get proxy health summary
   */
  getProxyHealth(): any {
    if (!this.fastProxyManager) {
      return { available: false };
    }
    
    return {
      available: true,
      ...this.fastProxyManager.getHealthSummary()
    };
  }
  
  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.fastProxyManager) {
      this.fastProxyManager.destroy();
    }
  }
  
  /**
   * Enable/disable concurrent requests
   */
  setConcurrentRequests(enabled: boolean, maxConcurrency?: number): void {
    this.enableConcurrentRequests = enabled;
    if (maxConcurrency) {
      this.maxConcurrency = maxConcurrency;
      this.concurrencyLimit = pLimit(maxConcurrency);
    }
  }
  
  /**
   * Fetch apartments by URLs concurrently (compatibility method)
   * This method exists for backward compatibility with job processors
   */
  async fetchApartmentsByUrlsConcurrent(
    urls: string[],
    maxConcurrency?: number,
    progressCallback?: (progress: any) => void
  ): Promise<any> {
    console.log(`[${this.getName()}] Fetching ${urls.length} apartments concurrently`);
    
    // Override concurrency if specified
    if (maxConcurrency) {
      this.setConcurrentRequests(true, maxConcurrency);
    }
    
    const startTime = Date.now();
    const apartments: any[] = [];
    let completed = 0;
    let failed = 0;
    
    // Process URLs in batches using fetchHtmlBatch
    const batchSize = this.maxConcurrency;
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, Math.min(i + batchSize, urls.length));
      
      // Fetch HTML for this batch
      console.log(`[${this.getName()}] Fetching batch of ${batch.length} URLs`);
      const htmlResults = await this.fetchHtmlBatch(batch);
      console.log(`[${this.getName()}] Batch fetch completed, got ${htmlResults.length} results`);
      
      // Process each result
      for (let j = 0; j < htmlResults.length; j++) {
        const result = htmlResults[j];
        const url = batch[j];
        
        if (result.success && result.data) {
          try {
            // Parse the HTML and extract apartment data
            const $ = this.loadHtml(result.data);
            const apartmentData = await this.parseApartmentDetails($, url);
            
            if (apartmentData) {
              apartments.push(apartmentData);
              completed++;
            } else {
              failed++;
            }
            
            // Report progress after each apartment
            if (progressCallback) {
              try {
                progressCallback({
                  total: urls.length,
                  completed,
                  failed,
                  currentPage: 1,
                  totalPages: 1,
                  startedAt: new Date(startTime),
                  estimatedTimeRemaining: completed > 0 ? ((Date.now() - startTime) / completed) * (urls.length - completed) : 0,
                });
              } catch (progressError) {
                console.error(`[${this.getName()}] Progress callback error:`, progressError);
              }
            }
          } catch (error) {
            console.error(`Failed to parse apartment from ${url}:`, error);
            failed++;
          }
        } else {
          failed++;
        }
        
        // Update progress
        if (progressCallback) {
          const progress = {
            total: urls.length,
            completed,
            failed,
            currentItem: i + j + 1,
            estimatedTimeRemaining: ((Date.now() - startTime) / (i + j + 1)) * (urls.length - i - j - 1),
          };
          progressCallback(progress);
        }
      }
    }
    
    console.log(`[${this.getName()}] Fetched ${completed} apartments, ${failed} failed`);
    console.log(`[${this.getName()}] Returning ${apartments.length} apartments to processor`);
    console.log(`[${this.getName()}] About to return result object`);
    
    const returnValue = {
      success: true,
      data: apartments,
      metadata: {
        totalUrls: urls.length,
        completed,
        failed,
        duration: Date.now() - startTime,
      },
    };
    
    console.log(`[${this.getName()}] Returning now...`);
    return returnValue;
  }
  
  /**
   * Load HTML helper (for parsing)
   */
  protected loadHtml(html: string): any {
    return load(html);
  }
  
  /**
   * Parse apartment details from HTML (to be overridden by subclasses)
   */
  protected async parseApartmentDetails($: any, url: string): Promise<any> {
    // This should be overridden by specific scrapers
    throw new Error('parseApartmentDetails must be implemented by subclass');
  }
}