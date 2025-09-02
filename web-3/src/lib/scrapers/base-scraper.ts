import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosError } from 'axios';
import { load } from 'cheerio';
import type * as cheerio from 'cheerio';
import type {
  ScraperConfig,
  ScrapeResult,
  ScraperError,
  ScrapeMetadata,
  ProxyConfig,
} from '~/types/scraper';
import { ScraperErrorCode } from '~/types/scraper';
import { UserAgentRotator } from './utils/user-agent-rotator';
import { ProxyManager } from './utils/proxy-manager';
import { createProxyAgents } from './utils/proxy-agent-helper';

export abstract class BaseScraper {
  protected config: ScraperConfig;
  protected axiosInstance: AxiosInstance;
  private lastRequestTime: number = 0;
  private requestQueue: Array<() => Promise<void>> = [];
  private isProcessingQueue: boolean = false;
  public scraperType?: string;
  protected bypassRobotsTxt: boolean = false;
  protected userAgentRotator: UserAgentRotator;
  protected enableUserAgentRotation: boolean = true;
  protected proxyManager: ProxyManager;
  protected enableProxyRotation: boolean = process.env.DISABLE_SCRAPERS_PROXY !== 'true';

  constructor(config: ScraperConfig) {
    this.config = config;
    // Initialize user agent rotator with 5-minute rotation interval
    this.userAgentRotator = new UserAgentRotator(300000);
    // Initialize proxy manager (will use environment variables or config proxies)
    this.proxyManager = config.proxies ? new ProxyManager({ 
      proxies: config.proxies,
      rotationStrategy: 'round-robin'
    }) : ProxyManager.fromEnv();
    this.axiosInstance = this.createAxiosInstance();
  }

  /**
   * Create an axios instance with the scraper configuration
   */
  private createAxiosInstance(): AxiosInstance {
    // Get initial headers from user agent rotator if enabled
    const baseHeaders = this.enableUserAgentRotation 
      ? this.userAgentRotator.buildHeaders(undefined, true)
      : {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9,ja;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'max-age=0',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
        };
    
    return axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        ...baseHeaders,
        ...this.config.headers, // Allow scraper-specific headers to override
      },
    });
  }

  /**
   * Apply rate limiting to requests with optional jitter
   */
  private async applyRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    // Add jitter to rate limit if user agent rotation is enabled
    const rateLimit = this.enableUserAgentRotation 
      ? UserAgentRotator.addJitter(this.config.rateLimit, 500)
      : this.config.rateLimit;
    
    if (timeSinceLastRequest < rateLimit) {
      const delay = rateLimit - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Process the request queue with rate limiting
   */
  private async processRequestQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    
    this.isProcessingQueue = true;
    
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        await this.applyRateLimit();
        await request();
      }
    }
    
    this.isProcessingQueue = false;
  }

  /**
   * Add a request to the queue
   */
  protected async queueRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      void this.processRequestQueue();
    });
  }

  /**
   * Get a proxy configuration if available
   */
  protected getProxy(): ProxyConfig | undefined {
    if (!this.enableProxyRotation || !this.proxyManager.hasProxies()) {
      return undefined;
    }
    
    // Use proxy manager for intelligent proxy selection
    return this.proxyManager.getNextProxy();
  }

  /**
   * Create axios config with proxy if available and rotated headers
   */
  protected getRequestConfig(config?: AxiosRequestConfig, url?: string): AxiosRequestConfig {
    const proxy = this.getProxy();
    
    // Get fresh headers if user agent rotation is enabled
    const headers = this.enableUserAgentRotation
      ? {
          ...this.userAgentRotator.buildHeaders(undefined, true),
          ...this.config.headers, // Preserve scraper-specific headers
          ...(config?.headers || {}), // Preserve request-specific headers
        }
      : {
          ...this.config.headers,
          ...(config?.headers || {}),
        };
    
    // Log headers for debugging (only in development)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[${this.config.name}] Request headers:`, {
        'User-Agent': headers['User-Agent']?.substring(0, 50) + '...',
        'Accept': headers['Accept'],
        'Accept-Language': headers['Accept-Language'],
        'Referer': headers['Referer'],
        'Origin': headers['Origin'],
      });
    }
    
    const baseConfig: AxiosRequestConfig = {
      ...config,
      headers,
      timeout: config?.timeout || this.config.timeout || 10000, // Ensure timeout is always set
      // Don't throw on 4xx/5xx responses so we can handle them properly for removal detection
      validateStatus: (status) => true,
    };
    
    if (!proxy) {
      return baseConfig;
    }
    
    // Use proxy agents for HTTPS sites instead of axios's built-in proxy
    if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
      const proxyAgentConfig = createProxyAgents(url, proxy);
      return {
        ...baseConfig,
        ...proxyAgentConfig,
      };
    }
    
    // Fallback to axios's built-in proxy config
    return {
      ...baseConfig,
      proxy: {
        host: proxy.host,
        port: proxy.port,
        auth: proxy.username && proxy.password
          ? { username: proxy.username, password: proxy.password }
          : undefined,
        protocol: proxy.protocol || 'http',
      },
    };
  }


  /**
   * Fetch HTML content with retry logic
   */
  protected async fetchHtml(
    url: string,
    config?: AxiosRequestConfig,
    retryCount: number = 0
  ): Promise<ScrapeResult<string>> {
    const startTime = Date.now();
    const requestConfig = this.getRequestConfig(config, url);
    const currentProxy = this.getProxy(); // Get the proxy directly since we're using agents now
    
    // Debug proxy usage
    if (currentProxy) {
      console.log(`🌐 Using proxy: ${currentProxy.protocol}://${currentProxy.host}:${currentProxy.port}`);
      if (this.getName().toLowerCase().includes('realestate')) {
        console.log(`[DEBUG] RealEstate proxy details:`, {
          protocol: currentProxy.protocol,
          host: currentProxy.host,
          port: currentProxy.port,
          hasAuth: !!(currentProxy.username && currentProxy.password)
        });
        console.log(`[DEBUG] Request config:`, {
          url,
          timeout: requestConfig.timeout,
          hasHttpsAgent: !!requestConfig.httpsAgent,
          hasHttpAgent: !!requestConfig.httpAgent,
        });
      }
    } else {
      console.log('🌐 No proxy being used');
    }
    
    try {
      if (this.getName().toLowerCase().includes('realestate')) {
        console.log(`[DEBUG] About to make axios request to: ${url}`);
      }
      
      const response = await this.queueRequest(() => {
        if (this.getName().toLowerCase().includes('realestate')) {
          console.log(`[DEBUG] Inside queueRequest, making actual HTTP call...`);
          console.log(`[DEBUG] Axios timeout: ${this.axiosInstance.defaults.timeout}ms`);
          console.log(`[DEBUG] Request timeout: ${requestConfig.timeout}ms`);
        }
        return this.axiosInstance.get<string>(url, requestConfig);
      });
      
      const duration = Date.now() - startTime;
      
      // Report proxy success if used
      if (currentProxy && this.enableProxyRotation) {
        this.proxyManager.reportSuccess(currentProxy, duration);
      }
      
      return {
        success: true,
        data: response.data,
        metadata: {
          url,
          scrapedAt: new Date(),
          duration,
          retries: retryCount,
          proxy: currentProxy ? `${currentProxy.host}:${currentProxy.port}` : undefined,
          statusCode: response.status,
          statusText: response.statusText,
          headers: response.headers,
          contentLength: response.data?.length || 0,
          contentType: response.headers['content-type'],
          // Check if the final URL is different from the requested URL (redirect happened)
          finalUrl: response.request?.res?.responseUrl || response.request?._currentUrl || url,
          redirected: (response.request?.res?.responseUrl || response.request?._currentUrl) !== url,
          // Axios follows redirects by default, so we check the request object
          redirectCount: response.request?._redirectable?._redirectCount || 0,
        },
      };
    } catch (error) {
      const scraperError = this.handleError(error);
      
      // Enhanced debug for RealEstate
      if (this.getName().toLowerCase().includes('realestate')) {
        console.error(`[DEBUG] RealEstate request failed:`, {
          url,
          proxy: currentProxy ? `${currentProxy.protocol}://${currentProxy.host}:${currentProxy.port}` : 'none',
          error: error.message,
          code: error.code,
          isTimeout: error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT',
          axiosError: error.isAxiosError,
          response: error.response?.status,
          stack: error.stack?.split('\n').slice(0, 3).join('\n')
        });
        
        // For RealEstate timeout, try direct axios as fallback
        if (currentProxy && error.code === 'ETIMEOUT' && scraperError.retryable) {
          console.log(`[DEBUG] Attempting RealEstate direct axios fallback...`);
          try {
            const httpsProxyAgent = await import('https-proxy-agent');
            const { HttpsProxyAgent } = httpsProxyAgent.default || httpsProxyAgent;
            const agent = new HttpsProxyAgent(`http://${currentProxy.host}:${currentProxy.port}`);
            
            const directResponse = await axios.get(url, {
              httpsAgent: agent,
              timeout: 5000,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en,ja;q=0.9',
              }
            });
            
            console.log(`[DEBUG] Direct axios SUCCESS for RealEstate!`);
            return {
              success: true,
              data: directResponse.data,
              metadata: {
                url,
                scrapedAt: new Date(),
                duration: Date.now() - startTime,
                retries: retryCount,
                proxy: `${currentProxy.host}:${currentProxy.port}`,
              },
            };
          } catch (directError: any) {
            console.error(`[DEBUG] Direct axios also failed:`, directError.message);
            // Continue with normal error flow
          }
        }
      }
      
      // Report proxy failure if used
      if (currentProxy && this.enableProxyRotation) {
        this.proxyManager.reportFailure(currentProxy, scraperError.message);
      }
      
      // Retry logic
      if (scraperError.retryable && retryCount < this.config.maxRetries) {
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return this.fetchHtml(url, config, retryCount + 1);
      }
      
      return {
        success: false,
        error: scraperError,
        metadata: {
          url,
          scrapedAt: new Date(),
          duration: Date.now() - startTime,
          retries: retryCount,
        },
      };
    }
  }

  /**
   * Fetch and parse HTML content
   */
  protected async fetchAndParse(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<ScrapeResult<cheerio.Root>> {
    // Add dynamic referer header
    const configWithReferer = {
      ...config,
      headers: {
        ...config?.headers,
        'Referer': config?.headers?.['Referer'] || this.lastRequestUrl || this.config.baseUrl + '/',
      }
    };
    
    const htmlResult = await this.fetchHtml(url, configWithReferer);
    
    if (!htmlResult.success || !htmlResult.data) {
      return {
        success: false,
        error: htmlResult.error,
        metadata: htmlResult.metadata,
      };
    }
    
    try {
      const $ = load(htmlResult.data);
      return {
        success: true,
        data: $,
        metadata: htmlResult.metadata,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: ScraperErrorCode.PARSE_ERROR,
          message: 'Failed to parse HTML',
          details: error,
          retryable: false,
        },
        metadata: htmlResult.metadata,
      };
    }
  }

  /**
   * Handle errors and convert to ScraperError
   */
  protected handleError(error: unknown): ScraperError {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      
      if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
        return {
          code: ScraperErrorCode.TIMEOUT,
          message: 'Request timed out',
          details: error,
          retryable: true,
        };
      }
      
      if (axiosError.response) {
        const status = axiosError.response.status;
        
        if (status === 429) {
          return {
            code: ScraperErrorCode.RATE_LIMIT,
            message: 'Rate limit exceeded',
            details: error,
            retryable: true,
          };
        }
        
        if (status === 403 || status === 401) {
          return {
            code: ScraperErrorCode.BLOCKED,
            message: 'Access blocked or unauthorized',
            details: error,
            retryable: false,
          };
        }
        
        if (status === 404) {
          return {
            code: ScraperErrorCode.NOT_FOUND,
            message: 'Page not found',
            details: error,
            retryable: false,
          };
        }
        
        if (status >= 500) {
          return {
            code: ScraperErrorCode.NETWORK_ERROR,
            message: `Server error: ${status}`,
            details: error,
            retryable: true,
          };
        }
      }
      
      return {
        code: ScraperErrorCode.NETWORK_ERROR,
        message: axiosError.message || 'Network error',
        details: error,
        retryable: true,
      };
    }
    
    return {
      code: ScraperErrorCode.UNKNOWN,
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error,
      retryable: false,
    };
  }

  /**
   * Check if we should respect robots.txt (basic implementation)
   */
  protected async checkRobotsTxt(): Promise<boolean> {
    // Bypass robots.txt check if flag is set (use with caution and proper authorization)
    if (this.bypassRobotsTxt) {
      console.warn(`[${this.config.name}] Bypassing robots.txt check - ensure you have proper authorization`);
      return true;
    }
    
    try {
      const robotsUrl = new URL('/robots.txt', this.config.baseUrl).toString();
      const response = await this.axiosInstance.get(robotsUrl, {
        timeout: 5000,
      });
      
      const robotsTxt = response.data as string;
      const userAgentBlock = this.parseRobotsTxt(robotsTxt);
      
      // Basic check - in production, use a proper robots.txt parser
      return !userAgentBlock.includes('Disallow: /');
    } catch {
      // If we can't fetch robots.txt, assume it's okay to scrape
      return true;
    }
  }

  /**
   * Enable or disable robots.txt bypass (use with caution)
   */
  public setBypassRobotsTxt(bypass: boolean): void {
    this.bypassRobotsTxt = bypass;
    if (bypass) {
      console.warn(`[${this.config.name}] Robots.txt bypass enabled - ensure you have proper authorization`);
    }
  }

  /**
   * Basic robots.txt parser (simplified)
   */
  private parseRobotsTxt(robotsTxt: string): string {
    const lines = robotsTxt.split('\n');
    let inOurBlock = false;
    let rules = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('User-agent:')) {
        inOurBlock = trimmed.includes('*') || trimmed.toLowerCase().includes('bot');
      } else if (inOurBlock && trimmed.startsWith('Disallow:')) {
        rules += trimmed + '\n';
      }
    }
    
    return rules;
  }

  /**
   * Abstract method that must be implemented by specific scrapers
   */
  abstract getName(): string;

  /**
   * Check if a listing has been removed based on HTTP response and HTML content
   * This method can be overridden by specific scrapers for custom logic
   * 
   * @param url The URL that was requested
   * @param httpResponse The HTTP response metadata
   * @param html The HTML content (optional, may be null for some status codes)
   * @returns Object indicating if removed and the reason
   */
  protected async checkIfListingRemoved(
    url: string,
    httpResponse: {
      statusCode: number;
      statusText: string;
      headers: any;
      finalUrl: string;
      redirected: boolean;
      redirectCount: number;
    },
    html?: string
  ): Promise<{
    isRemoved: boolean;
    reason?: string;
    confidence: 'high' | 'medium' | 'low';
  }> {
    // Default implementation - check common HTTP status codes
    if (httpResponse.statusCode === 404) {
      return {
        isRemoved: true,
        reason: 'HTTP 404 - Page not found',
        confidence: 'high'
      };
    }
    
    if (httpResponse.statusCode === 410) {
      return {
        isRemoved: true,
        reason: 'HTTP 410 - Gone (permanently removed)',
        confidence: 'high'
      };
    }
    
    // Check for redirects to home page or error page (common pattern)
    if (httpResponse.redirected && httpResponse.finalUrl) {
      const originalPath = new URL(url).pathname;
      const finalPath = new URL(httpResponse.finalUrl).pathname;
      
      if (finalPath === '/' || finalPath.includes('/error') || finalPath.includes('/404')) {
        return {
          isRemoved: true,
          reason: `Redirected to ${finalPath} (likely removed)`,
          confidence: 'medium'
        };
      }
    }
    
    // Default: not removed
    return {
      isRemoved: false,
      confidence: 'low'
    };
  }
}