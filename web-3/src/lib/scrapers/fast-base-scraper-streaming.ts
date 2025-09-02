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
 * Fast Base Scraper with Streaming - Processes URLs as they complete
 */
export abstract class FastBaseScraperStreaming extends BaseScraper {
  protected fastProxyManager?: FastProxyManager;
  protected concurrencyLimit: any;
  protected maxConcurrency: number = 10;
  protected enableConcurrentRequests: boolean = true;

  constructor(config: ScraperConfig) {
    super(config);
    
    // Check for scraper-specific proxy configuration
    const proxyConfig = getScraperProxyConfig(config.name);
    
    if (proxyConfig) {
      console.log(`[${config.name}] Loading ${proxyConfig.type} proxies from ${proxyConfig.file}`);
      
      // Load proxies from the specified file
      let proxies = ProxyManager.loadFromFile(proxyConfig.file);
      
      if (proxies.length > 0) {
        
        // Set the protocol for each proxy based on the config type
        proxies.forEach(proxy => {
          proxy.protocol = proxyConfig.type === 'http' ? 'http' : 'socks5';
          if (proxyConfig.username) proxy.username = proxyConfig.username;
          if (proxyConfig.password) proxy.password = proxyConfig.password;
        });
        
        // Limit proxy pool for faster startup
        const maxProxies = 200;
        if (proxies.length > maxProxies) {
          console.log(`[${config.name}] Limiting proxy pool from ${proxies.length} to ${maxProxies} for faster startup`);
          proxies.length = maxProxies;
        }
        
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
   * Main entry point - fetches apartments concurrently with streaming
   */
  async fetchApartmentsByUrlsConcurrent(
    urls: string[],
    maxConcurrency?: number,
    progressCallback?: (progress: any) => void
  ): Promise<any> {
    console.log(`[${this.getName()}] Fetching ${urls.length} apartments with streaming concurrency`);
    
    // Use provided concurrency or default
    const concurrency = maxConcurrency || this.maxConcurrency || 10;
    const limit = pLimit(concurrency);
    
    const startTime = Date.now();
    const apartments: any[] = [];
    let completed = 0;
    let failed = 0;
    
    // Get all proxies upfront (we'll rotate through them)
    const proxyPool = this.fastProxyManager?.getProxyBatch(Math.min(urls.length, 50)) || [];
    let proxyIndex = 0;
    
    console.log(`[${this.getName()}] Starting ${urls.length} requests with concurrency: ${concurrency}`);
    
    // Create all promises at once - they'll be limited by p-limit
    const allPromises = urls.map((url, index) => 
      limit(async () => {
        const taskStartTime = Date.now();
        
        try {
          // Get a proxy (rotate through pool)
          const proxy = proxyPool.length > 0 ? proxyPool[proxyIndex % proxyPool.length] : undefined;
          proxyIndex++;
          
          // Fetch HTML
          const fetchResult = await this.fetchHtmlWithProxy(url, {
            timeout: this.config.timeout || 10000
          }, proxy);
          
          if (fetchResult.success && fetchResult.data) {
            // Parse immediately after successful fetch
            try {
              const $ = this.loadHtml(fetchResult.data);
              const apartmentData = await this.parseApartmentDetails($, url);
              
              if (apartmentData) {
                console.log(`[${this.getName()}] ✓ Completed ${url} (${Date.now() - taskStartTime}ms)`);
                apartments.push(apartmentData);
                completed++;
              } else {
                console.log(`[${this.getName()}] ✗ Parse failed for ${url}`);
                failed++;
              }
            } catch (parseError) {
              console.error(`[${this.getName()}] Parse error for ${url}:`, parseError);
              failed++;
            }
          } else {
            console.log(`[${this.getName()}] ✗ Fetch failed for ${url}: ${fetchResult.error?.message}`);
            failed++;
          }
          
          // Report progress immediately after each completion
          const processed = completed + failed;
          if (progressCallback && processed > 0) {
            const elapsed = Date.now() - startTime;
            const avgTime = elapsed / processed;
            const remaining = urls.length - processed;
            
            progressCallback({
              total: urls.length,
              completed,
              failed,
              currentPage: 1,
              totalPages: 1,
              startedAt: new Date(startTime),
              estimatedTimeRemaining: remaining * avgTime,
            });
          }
          
          // Log progress every 10 completions
          if (processed % 10 === 0 || processed === urls.length) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`[${this.getName()}] Progress: ${processed}/${urls.length} (${elapsed}s, ${completed} success, ${failed} failed)`);
          }
          
        } catch (error) {
          console.error(`[${this.getName()}] Error processing ${url}:`, error);
          failed++;
        }
      })
    );
    
    // Wait for all to complete
    console.log(`[${this.getName()}] Waiting for all ${urls.length} requests to complete...`);
    await Promise.allSettled(allPromises);
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[${this.getName()}] All requests completed in ${totalTime}s`);
    console.log(`[${this.getName()}] Results: ${completed} success, ${failed} failed, ${apartments.length} apartments`);
    
    return {
      success: true,
      data: apartments,
      metadata: {
        totalUrls: urls.length,
        completed,
        failed,
        duration: Date.now() - startTime,
      },
    };
  }

  /**
   * Fetch with specific proxy (from base class)
   */
  private async fetchHtmlWithProxy(
    url: string,
    config?: AxiosRequestConfig,
    proxy?: any
  ): Promise<ScrapeResult<string>> {
    // For RealEstate, use direct axios approach
    if (url.includes('realestate.co.jp') && proxy) {
      try {
        const httpsProxyAgent = await import('https-proxy-agent');
        const { HttpsProxyAgent } = httpsProxyAgent.default || httpsProxyAgent;
        const agent = new HttpsProxyAgent(`http://${proxy.host}:${proxy.port}`);
        
        const directResponse = await axios.get(url, {
          httpsAgent: agent,
          timeout: config?.timeout || 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en,ja;q=0.9',
          }
        });
        
        return {
          success: true,
          data: directResponse.data,
          metadata: {
            url,
            scrapedAt: new Date(),
            duration: 0,
            retries: 0,
            proxy: `${proxy.host}:${proxy.port}`,
          },
        };
      } catch (error: any) {
        return {
          success: false,
          error: {
            code: error.code || 'FETCH_ERROR',
            message: error.message,
            details: error,
            retryable: true,
          },
          metadata: {
            url,
            scrapedAt: new Date(),
            duration: 0,
            retries: 0,
          },
        };
      }
    }
    
    // Normal flow for other sites
    return this.fetchHtml(url, config);
  }

  /**
   * Load HTML helper
   */
  protected loadHtml(html: string): any {
    return load(html);
  }

  /**
   * Parse apartment details (to be implemented by subclasses)
   */
  protected abstract parseApartmentDetails($: any, url: string): Promise<any>;
}