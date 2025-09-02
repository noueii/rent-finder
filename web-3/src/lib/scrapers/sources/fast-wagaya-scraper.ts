import { FastBaseScraperQueue } from '../fast-base-scraper-queue';
import { WagayaBase } from '../providers/wagaya-base';
import type { Apartment, SearchParams } from '~/types/apartment';
import type { ScrapeResult } from '~/types/scraper';
import type * as cheerio from 'cheerio';

/**
 * Fast Wagaya Japan Scraper - Uses queue-based concurrency
 * Uses composition to combine FastBaseScraperQueue for fetching and WagayaBase for parsing
 */
export class FastWagayaJapanScraper extends FastBaseScraperQueue {
  private parser: WagayaBase;
  
  constructor(config?: any) {
    super({
      name: 'FastWagayaJapan',
      baseUrl: 'https://wagaya-japan.com',
      rateLimit: 5000, // 5 seconds between requests for Wagaya
      maxRetries: 2,
      timeout: 15000, // 15 second timeout for Wagaya
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ja;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Referer': 'https://wagaya-japan.com/en/',
        'Origin': 'https://wagaya-japan.com',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      ...config,
    });
    
    // Create parser instance for parsing logic
    this.parser = new WagayaParserHelper(this.config);
    
    this.scraperType = 'wagaya-fast';
    this.bypassRobotsTxt = false;
    
    // Enable fast mode
    this.maxConcurrency = 10; // Moderate concurrency
    this.enableConcurrentRequests = true;
  }
  
  getName(): string {
    return 'Fast Wagaya Japan';
  }
  
  /**
   * Fast search with concurrent page fetching
   */
  async search(params: SearchParams): Promise<ScrapeResult<Apartment[]>> {
    try {
      // Warm up proxies for better performance
      if (this.fastProxyManager && params.warmupProxies !== false) {
        await this.warmupProxies(10);
      }
      
      const { prefecture = 'tokyo', maxPrice, minSize, limit = 100 } = params;
      
      // First, get the first page to determine total pages
      const firstPageUrl = this.buildSearchUrl(prefecture, { 
        maxPrice, 
        minSize, 
        page: 1 
      });
      
      const firstPageResult = await this.fetchAndParse(firstPageUrl);
      if (!firstPageResult.success || !firstPageResult.data) {
        return firstPageResult as any;
      }
      
      const $ = firstPageResult.data;
      const totalPages = this.getTotalPages($);
      
      console.log(`Found ${totalPages} pages of results`);
      
      // Calculate how many pages we need to fetch
      const pagesToFetch = Math.min(totalPages, Math.ceil(limit / 20)); // 20 items per page
      
      // Fetch all pages concurrently
      const pageUrls = Array.from({ length: pagesToFetch }, (_, i) => 
        this.buildSearchUrl(prefecture, { maxPrice, minSize, page: i + 1 })
      );
      
      console.log(`Fetching ${pageUrls.length} pages concurrently...`);
      const startTime = Date.now();
      
      // Use batch fetching for maximum speed
      const pageResults = await this.fetchHtmlBatch(pageUrls);
      
      const fetchDuration = Date.now() - startTime;
      console.log(`Fetched ${pageUrls.length} pages in ${fetchDuration}ms (${(fetchDuration / pageUrls.length).toFixed(0)}ms per page)`);
      
      // Parse all successful pages
      const allApartments: Apartment[] = [];
      
      for (const pageResult of pageResults) {
        if (pageResult.success && pageResult.data) {
          const $ = this.loadHtml(pageResult.data);
          const apartments = this.parseSearchResults($);
          allApartments.push(...apartments);
          
          if (allApartments.length >= limit) {
            break;
          }
        }
      }
      
      // Trim to requested limit
      const results = allApartments.slice(0, limit);
      
      // Get proxy health summary
      const proxyHealth = this.getProxyHealth();
      
      return {
        success: true,
        data: results,
        metadata: {
          ...firstPageResult.metadata,
          totalResults: results.length,
          pagesFetched: pagesToFetch,
          fetchDuration,
          proxyHealth,
        },
      };
      
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error),
        metadata: {
          url: '',
          scrapedAt: new Date(),
          duration: 0,
          retries: 0,
        },
      };
    }
  }
  
  /**
   * Fast apartment details fetching
   */
  async getApartmentDetails(url: string): Promise<ScrapeResult<Apartment>> {
    const result = await this.fetchAndParse(url);
    
    if (!result.success || !result.data) {
      return result as any;
    }
    
    const $ = result.data;
    const apartment = this.parseApartmentDetails($, url);
    
    return {
      success: true,
      data: apartment,
      metadata: result.metadata,
    };
  }
  
  /**
   * Batch fetch apartment details
   */
  async getApartmentDetailsBatch(urls: string[]): Promise<ScrapeResult<Apartment>[]> {
    console.log(`Fetching ${urls.length} apartment details concurrently...`);
    const startTime = Date.now();
    
    const htmlResults = await this.fetchHtmlBatch(urls);
    
    const results = htmlResults.map((htmlResult, index) => {
      if (!htmlResult.success || !htmlResult.data) {
        return htmlResult as any;
      }
      
      const $ = this.loadHtml(htmlResult.data);
      const apartment = this.parseApartmentDetails($, urls[index]);
      
      return {
        success: true,
        data: apartment,
        metadata: htmlResult.metadata,
      };
    });
    
    const duration = Date.now() - startTime;
    console.log(`Fetched ${urls.length} apartment details in ${duration}ms (${(duration / urls.length).toFixed(0)}ms per apartment)`);
    
    return results;
  }
  
  private buildSearchUrl(prefecture: string, params: any): string {
    const queryParams = new URLSearchParams({
      sort: '0',
      room_kei: '0',
      upperprice: params.maxPrice?.toString() || '999999',
      heibeimin: params.minSize?.toString() || '0',
      page: params.page?.toString() || '1',
    });
    
    return `${this.config.baseUrl}/en/rent/${prefecture}/list/?${queryParams}`;
  }
  
  private getTotalPages($: cheerio.Root): number {
    try {
      // Look for pagination
      const paginationText = $('.pagination').text();
      const pageNumbers = paginationText.match(/\d+/g);
      if (pageNumbers && pageNumbers.length > 0) {
        return Math.max(...pageNumbers.map(Number));
      }
      
      // Alternative: count total results and divide by items per page
      const totalText = $('.search-result-count').text();
      const totalMatch = totalText.match(/(\d+)\s*results?/i);
      if (totalMatch) {
        const total = parseInt(totalMatch[1], 10);
        return Math.ceil(total / 20); // Assuming 20 items per page
      }
      
      return 1; // Default to 1 page
    } catch {
      return 1;
    }
  }
  
  private loadHtml(html: string): cheerio.Root {
    const { load } = require('cheerio');
    return load(html);
  }
  
  private parseSearchResults($: cheerio.Root): Apartment[] {
    const apartments: Apartment[] = [];
    
    $('.property-list-item, .estate-card, [data-property-id]').each((_, element) => {
      try {
        const $item = $(element);
        
        // Use parser from base class to extract data
        const apartmentData = this.parser.parseListingFromSearchPage($, $item);
        
        // Extract basic fees if available
        const fees = this.parser.parseBasicFeesFromSearchPage($item);
        
        // Extract thumbnail
        const images = this.parser.parseThumbnailFromSearchPage($item);
        
        // Extract basic station info
        const nearestStations = this.parser.parseBasicStationInfoFromSearchPage($item);
        
        // Convert to Apartment type
        const apartment: Apartment = {
          id: apartmentData.externalId || `wagaya-${Date.now()}-${Math.random()}`,
          title: apartmentData.title || '',
          price: apartmentData.price || 0,
          size: apartmentData.size || 25,
          layout: apartmentData.layout,
          location: apartmentData.address || 'Tokyo',
          address: apartmentData.address || '',
          floor: apartmentData.floor?.toString(),
          buildingType: undefined,
          age: apartmentData.buildingAge,
          imageUrl: images[0]?.url,
          sourceUrl: apartmentData.sourceUrl || '',
          scrapedAt: new Date(),
          scrapedFrom: 'wagaya',
          stationInfo: nearestStations.map(s => `${s.name} (${s.walkingMinutes} min)`),
        };
        
        apartments.push(apartment);
      } catch (error) {
        console.error('Error parsing apartment:', error);
      }
    });
    
    return apartments;
  }
  
  private parseApartmentDetails($: cheerio.Root, url: string): Apartment {
    // Use parser from base class
    const detailData = this.parser.parseApartmentFromDetailPage($, url);
    
    // Convert to Apartment type
    return {
      id: detailData.externalId || `wagaya-${Date.now()}`,
      title: detailData.title || 'Unknown',
      price: detailData.price || 0,
      size: detailData.size || 25,
      layout: detailData.layout,
      location: detailData.address || 'Tokyo',
      address: detailData.address || '',
      sourceUrl: url,
      scrapedAt: new Date(),
      scrapedFrom: 'wagaya',
    };
  }
  
  // Proxy management methods
  private async warmupProxies(count: number): Promise<void> {
    if (!this.fastProxyManager) return;
    
    console.log(`Warming up ${count} proxies...`);
    const testUrls = Array(count).fill(this.config.baseUrl);
    await this.fetchHtmlBatch(testUrls);
  }
  
  private getProxyHealth(): any {
    if (!this.fastProxyManager) return { healthy: 0, total: 0 };
    
    return {
      healthy: this.fastProxyManager.getHealthyCount?.() || 0,
      total: this.fastProxyManager.getTotalCount?.() || 0,
    };
  }
}

/**
 * Helper class that extends WagayaBase to access protected parsing methods
 */
class WagayaParserHelper extends WagayaBase {
  getName(): string {
    return 'WagayaParserHelper';
  }
  
  // Make protected methods public for use by the fast scraper
  public parseListingFromSearchPage($: cheerio.Root, $item: cheerio.Cheerio) {
    return super.parseListingFromSearchPage($, $item);
  }
  
  public parseBasicFeesFromSearchPage($item: cheerio.Cheerio) {
    return super.parseBasicFeesFromSearchPage($item);
  }
  
  public parseThumbnailFromSearchPage($item: cheerio.Cheerio) {
    return super.parseThumbnailFromSearchPage($item);
  }
  
  public parseBasicStationInfoFromSearchPage($item: cheerio.Cheerio) {
    return super.parseBasicStationInfoFromSearchPage($item);
  }
  
  public parseApartmentFromDetailPage($: cheerio.Root, url: string) {
    return super.parseApartmentFromDetailPage($, url);
  }
}