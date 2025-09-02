import { BaseScraper } from './base-scraper';
import type { ScraperConfig, ScrapeResult } from '~/types/scraper';
import type { AxiosRequestConfig } from 'axios';
import axios from 'axios';
import { FastProxyManager } from './utils/fast-proxy-manager';
import { getScraperProxyConfig } from './config/proxy-config';
import { ProxyManager } from './utils/proxy-manager';
import { load } from 'cheerio';

/**
 * Fast Base Scraper with Simple Queue - Uses worker pool pattern
 */
export abstract class FastBaseScraperQueue extends BaseScraper {
  protected fastProxyManager?: FastProxyManager;
  protected maxConcurrency: number = 20; // 20 concurrent workers for better performance

  constructor(config: ScraperConfig) {
    super(config);
    
    // Load scraper-specific proxies
    // Try multiple variations of the scraper name
    const nameVariations = [
      config.name,
      config.name.toLowerCase(),
      this.getName(),
      this.getName().toLowerCase(),
      this.scraperType,
    ].filter(Boolean);
    
    console.log(`[${this.getName()}] Checking proxy config for variations:`, nameVariations);
    
    let proxyConfig = null;
    
    // Check if proxies are disabled globally
    if (process.env.DISABLE_SCRAPERS_PROXY === 'true' || process.env.USE_PROXY === 'false') {
      console.log(`[${this.getName()}] Proxies are disabled via environment variables`);
      proxyConfig = null;
    } else {
      // Hardcode HTTP proxies for Wagaya and YOLO
      if (this.getName().toLowerCase().includes('wagaya') || this.getName().toLowerCase().includes('yolo')) {
        console.log(`[${this.getName()}] Hardcoding HTTP proxies for Wagaya/YOLO`);
        proxyConfig = {
          type: 'http' as const,
          file: 'src/lib/scrapers/data/proxyscrape_premium_http_proxies.txt'
        };
      } else {
        for (const name of nameVariations) {
          proxyConfig = getScraperProxyConfig(name);
          if (proxyConfig) {
            console.log(`[${this.getName()}] Found proxy config for: ${name}`);
            console.log(`[${this.getName()}] Proxy config:`, {
              type: proxyConfig.type,
              file: proxyConfig.file,
              fromEnv: name.toUpperCase() + '_PROXY_TYPE exists: ' + !!process.env[`${name.toUpperCase()}_PROXY_TYPE`]
            });
            break;
          }
        }
      }
    }
    
    if (proxyConfig) {
      console.log(`[${config.name}] Loading ${proxyConfig.type} proxies from ${proxyConfig.file}`);
      let proxies = ProxyManager.loadFromFile(proxyConfig.file);
      
      if (proxies.length > 0) {
        // Limit proxy pool for faster startup
        const maxProxies = 200;
        if (proxies.length > maxProxies) {
          console.log(`[${config.name}] Limiting proxy pool from ${proxies.length} to ${maxProxies}`);
          proxies.length = maxProxies;
        }
        
        // Set protocol based on config
        proxies.forEach(proxy => {
          proxy.protocol = proxyConfig.type === 'http' ? 'http' : 'socks5';
        });
        
        // Create fast proxy manager
        this.fastProxyManager = new FastProxyManager({
          proxies,
          rotationStrategy: 'performance',
          maxFailures: 2,
        });
        this.proxyManager = this.fastProxyManager;
        
        console.log(`[${config.name}] Loaded ${proxies.length} ${proxyConfig.type} proxies`);
      }
    }
  }

  /**
   * Main entry point - Simple queue-based concurrent fetching
   */
  async fetchApartmentsByUrlsConcurrent(
    urls: string[],
    maxConcurrency?: number,
    progressCallback?: (progress: any) => void,
    onApartmentReady?: (apartment: any) => Promise<void>
  ): Promise<any> {
    const concurrency = maxConcurrency || this.maxConcurrency || 10; // Reduced default concurrency
    console.log(`[${this.getName()}] Fetching ${urls.length} apartments with queue (concurrency: ${concurrency})`);
    
    const startTime = Date.now();
    const apartments: any[] = [];
    let completed = 0;
    let failed = 0;
    let urlIndex = 0;
    
    // Get proxy pool
    const proxyPool = this.fastProxyManager?.getProxyBatch(50) || [];
    let proxyIndex = 0;
    
    // Active workers tracking
    const activeWorkers = new Map<number, Promise<void>>();
    
    // Worker function with rate limiting
    const processUrl = async (workerId: number) => {
      console.log(`[${this.getName()}] JOB -> WORKER ${workerId}: STATUS: START`);
      
      while (urlIndex < urls.length) {
        const currentIndex = urlIndex++;
        const url = urls[currentIndex];
        
        if (!url) break;
        
        // Extract external ID from URL if possible
        const externalIdMatch = url.match(/\/([\d]+)(?:\?|$)|id=([\d]+)|property\/([\d]+)/);
        const externalId = externalIdMatch ? (externalIdMatch[1] || externalIdMatch[2] || externalIdMatch[3]) : 'UNKNOWN';
        
        console.log(`[${this.getName()}] JOB -> WORKER ${workerId}: STATUS: START FETCH APT ${externalId}`);
        const taskStart = Date.now();
        let proxy = proxyPool.length > 0 ? proxyPool[proxyIndex++ % proxyPool.length] : undefined;
        let retryCount = 0;
        const maxRetries = 2;
        
        while (retryCount <= maxRetries) {
          try {
          // Fetch HTML with hard timeout wrapper
          const fetchPromise = this.fetchHtmlWithProxy(url, {
            timeout: 30000 // Increased to 30s
          }, proxy);
          
          // Create timeout promise - increased to 45 seconds
          const timeoutPromise = new Promise<any>((_, reject) => {
            setTimeout(() => reject(new Error('Worker timeout after 45 seconds')), 45000);
          });
          
          // Race between fetch and timeout
          const result = await Promise.race([fetchPromise, timeoutPromise]);
          
          if (result.success && result.data) {
            // Parse immediately
            const $ = this.loadHtml(result.data);
            const apartmentData = await this.parseApartmentDetails($, url);
            
            if (apartmentData) {
              apartments.push(apartmentData);
              completed++;
              console.log(`[${this.getName()}] JOB -> WORKER ${workerId}: STATUS: FINISH FETCH APT ${apartmentData.externalId || externalId}`);
              
              // Fire and forget - don't wait for DB update
              if (onApartmentReady) {
                console.log(`[${this.getName()}] JOB -> DB: STATUS: START UPDATE APT ${apartmentData.externalId || externalId}`);
                onApartmentReady(apartmentData).catch(err => 
                  console.error(`[${this.getName()}] JOB -> DB: STATUS: FAIL UPDATE APT ${apartmentData.externalId || externalId}: ${err.message}`)
                );
              }
            } else {
              failed++;
              console.log(`[${this.getName()}] JOB -> WORKER ${workerId}: STATUS: FAIL PARSE APT ${externalId}`);
            }
            break; // Success, exit retry loop
          } else {
            throw new Error('Fetch failed - no data returned');
          }
          
        } catch (error: any) {
          retryCount++;
          if (error.message?.includes('timeout')) {
            console.error(`[${this.getName()}] JOB -> WORKER ${workerId}: STATUS: TIMEOUT FETCH APT ${externalId} (attempt ${retryCount}/${maxRetries + 1})`);
            // Blacklist the proxy that timed out
            if (proxy && this.fastProxyManager) {
              this.fastProxyManager.reportFailure(proxy, 'Timeout');
              console.log(`[${this.getName()}] JOB -> PROXY: STATUS: BLACKLIST ${proxy.host}:${proxy.port}`);
              // Get a new proxy for retry
              proxy = proxyPool.length > 0 ? proxyPool[proxyIndex++ % proxyPool.length] : undefined;
            }
          } else {
            console.error(`[${this.getName()}] JOB -> WORKER ${workerId}: STATUS: ERROR FETCH APT ${externalId} (attempt ${retryCount}/${maxRetries + 1}): ${error.message}`);
          }
          
          if (retryCount > maxRetries) {
            failed++;
            console.log(`[${this.getName()}] JOB -> WORKER ${workerId}: STATUS: FAIL FETCH APT ${externalId} (after ${maxRetries + 1} attempts)`);
            break; // Exit retry loop
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
        }
        }
        
        // Report progress after each URL (success or failure)
        const processed = completed + failed;
          if (progressCallback) {
            progressCallback({
              total: urls.length,
              completed,
              failed,
              currentPage: 1,
              totalPages: 1,
              startedAt: new Date(startTime),
              estimatedTimeRemaining: processed > 0 ? ((Date.now() - startTime) / processed) * (urls.length - processed) : 0,
            });
          }
          
        // Log every 10 completions
        if (processed % 10 === 0) {
          console.log(`[${this.getName()}] Progress: ${processed}/${urls.length} (${completed} success, ${failed} failed)`);
        }
        
        // Rate limiting - wait before processing next URL
        const elapsed = Date.now() - taskStart;
        const minDelay = this.config.rateLimit || 50; // Default 50ms
        
        if (elapsed < minDelay) {
          await new Promise(resolve => setTimeout(resolve, minDelay - elapsed));
        }
      }
      
      console.log(`[${this.getName()}] JOB -> WORKER ${workerId}: STATUS: FINISH`);
    };
    
    // Start workers one by one with staggered startup
    console.log(`[${this.getName()}] Starting ${concurrency} workers with staggered startup...`);
    for (let i = 0; i < concurrency; i++) {
      console.log(`[${this.getName()}] Starting worker ${i}...`);
      activeWorkers.set(i, processUrl(i));
      
      // Wait 500ms before starting the next worker to reduce initial load
      if (i < concurrency - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Wait for all workers to complete
    await Promise.all(activeWorkers.values());
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[${this.getName()}] Completed in ${duration}s: ${completed} success, ${failed} failed`);
    
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
   * Fetch with specific proxy
   */
  private async fetchHtmlWithProxy(
    url: string,
    config?: AxiosRequestConfig,
    proxy?: any
  ): Promise<ScrapeResult<string>> {
    // Option to disable proxies via environment variable
    if (process.env.DISABLE_SCRAPERS_PROXY === 'true') {
      proxy = undefined;
    }
    
    // Special handling for sites that need HTTP proxy agent
    if ((url.includes('realestate.co.jp') || url.includes('wagaya-japan.com') || url.includes('yolo-japan.com')) && proxy) {
      try {
        const httpsProxyAgent = await import('https-proxy-agent');
        const { HttpsProxyAgent } = httpsProxyAgent.default || httpsProxyAgent;
        const agent = new HttpsProxyAgent(`http://${proxy.host}:${proxy.port}`);
        
        const response = await axios.get(url, {
          httpsAgent: agent,
          timeout: 5000, // Increased back to 5s - 3s might be too aggressive
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en,ja;q=0.9',
          }
        });
        
        return {
          success: true,
          data: response.data,
          metadata: {
            url,
            scrapedAt: new Date(),
            duration: 0,
            retries: 0,
          },
        };
      } catch (error: any) {
        console.error(`[${this.getName()}] Direct axios error for ${url}:`, {
          code: error.code,
          message: error.message,
          response: error.response?.status,
          proxy: proxy ? `${proxy.host}:${proxy.port}` : 'none'
        });
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
    
    // Use base scraper for other sites
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