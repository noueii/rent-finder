import { FastBaseScraperQueue } from '../fast-base-scraper-queue';
import { YoloBase } from '../providers/yolo-base';
import type { Apartment, SearchParams } from '~/types/apartment';
import type { ScrapeResult } from '~/types/scraper';
import type * as cheerio from 'cheerio';
import { geocodingService } from '~/lib/geocoding/geocoding-service';

/**
 * Fast YOLO Japan Scraper - Uses queue-based concurrency
 * Uses composition to combine FastBaseScraperQueue for fetching and YoloBase for parsing
 */
export class UnifiedYoloJapanScraper extends FastBaseScraperQueue {
  private parser: YoloBase;
  
  constructor(config?: any) {
    super({
      name: 'FastYoloJapan',
      baseUrl: 'https://home.yolo-japan.com',
      rateLimit: 200,
      maxRetries: 2,
      timeout: 10000,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ja;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Referer': 'https://home.yolo-japan.com/en/',
        'Origin': 'https://home.yolo-japan.com',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      ...config,
    });
    
    // Create parser instance for parsing logic
    this.parser = new YoloParserHelper(this.config);
    
    this.scraperType = 'yolo-fast';
    this.bypassRobotsTxt = false;
    this.maxConcurrency = 10; // Moderate concurrency
    this.enableConcurrentRequests = true;
  }
  
  getName(): string {
    return 'Fast YOLO Japan';
  }
  
  async search(params: SearchParams): Promise<ScrapeResult<Apartment[]>> {
    try {
      // Warm up proxies for better performance (only if proxies are enabled)
      if (this.fastProxyManager && params.warmupProxies !== false && 
          process.env.DISABLE_SCRAPERS_PROXY !== 'true' && 
          process.env.USE_PROXY !== 'false') {
        await this.warmupProxies(10);
      }
      
      const { prefecture = 'tokyo', maxPrice, minSize, limit = 100 } = params;
      
      // Get first page to determine total pages
      const firstPageUrl = this.buildSearchUrl({ maxPrice, minSize, page: 1 });
      const firstPageResult = await this.fetchAndParse(firstPageUrl);
      
      if (!firstPageResult.success || !firstPageResult.data) {
        return firstPageResult as any;
      }
      
      const $ = firstPageResult.data;
      const totalPages = this.getTotalPages($);
      const pagesToFetch = Math.min(totalPages, Math.ceil(limit / 20));
      
      // Fetch all pages concurrently
      const pageUrls = Array.from({ length: pagesToFetch }, (_, i) => 
        this.buildSearchUrl({ maxPrice, minSize, page: i + 1 })
      );
      
      console.log(`Fetching ${pageUrls.length} pages concurrently...`);
      const startTime = Date.now();
      
      const pageResults = await this.fetchHtmlBatch(pageUrls);
      const fetchDuration = Date.now() - startTime;
      
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
      
      const results = allApartments.slice(0, limit);
      
      return {
        success: true,
        data: results,
        metadata: {
          ...firstPageResult.metadata,
          totalResults: results.length,
          pagesFetched: pagesToFetch,
          fetchDuration,
          proxyHealth: this.getProxyHealth(),
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
  
  private buildSearchUrl(params: any): string {
    const queryParams = new URLSearchParams({
      perPage: '50',  // YOLO supports up to 50 items per page
      page: params.page?.toString() || '1',
    });
    
    // Add price filters (YOLO uses thousands, e.g., 160 for 160,000 yen)
    if (params.maxPrice) {
      queryParams.set('priceTo', Math.floor(params.maxPrice / 1000).toString());
    }
    if (params.minPrice) {
      queryParams.set('priceFrom', Math.floor(params.minPrice / 1000).toString());
    }
    
    // Add size filters
    if (params.minSize) {
      queryParams.set('areaFrom', Math.floor(params.minSize).toString());
    }
    if (params.maxSize) {
      queryParams.set('areaTo', Math.floor(params.maxSize).toString());
    }
    
    return `${this.config.baseUrl}/en/tokyo/list?${queryParams}`;
  }
  
  private getTotalPages($: cheerio.Root): number {
    try {
      const paginationText = $('.pagination').text();
      const pageNumbers = paginationText.match(/\d+/g);
      if (pageNumbers && pageNumbers.length > 0) {
        return Math.max(...pageNumbers.map(Number));
      }
      return 1;
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
    
    // YOLO groups apartments by building with class="property-wrapper"
    $('.property-wrapper').each((_, buildingWrapper) => {
      const $building = $(buildingWrapper);
      
      // Extract individual apartments within this building
      $building.find('.property-item').each((_, apartmentElement) => {
        try {
          const $item = $(apartmentElement);
          
          // Use parser from base class to extract data
          const apartmentData = this.parser.parseListingFromSearchPage($, $item);
          
          // Extract thumbnail
          const images = this.parser.parseThumbnailFromSearchPage($item);
          
          // Extract basic station info
          const nearestStations = this.parser.parseBasicStationInfoFromSearchPage($item);
          
          // Convert to Apartment type
          const apartment: Apartment = {
            id: apartmentData.externalId || `yolo-${Date.now()}-${Math.random()}`,
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
            scrapedFrom: 'yolo-japan',
            stationInfo: nearestStations.map(s => `${s.name} (${s.walkingMinutes} min)`),
          };
          
          apartments.push(apartment);
        } catch (error) {
          console.error('Error parsing apartment:', error);
        }
      });
    });
    
    return apartments;
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
    const apartment = await this.parseApartmentDetails($, url);
    
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
    
    const results = await Promise.all(htmlResults.map(async (htmlResult, index) => {
      if (!htmlResult.success || !htmlResult.data) {
        return htmlResult as any;
      }
      
      const $ = this.loadHtml(htmlResult.data);
      const apartment = await this.parseApartmentDetails($, urls[index]);
      
      return {
        success: true,
        data: apartment,
        metadata: htmlResult.metadata,
      };
    }));
    
    const duration = Date.now() - startTime;
    console.log(`Fetched ${urls.length} apartment details in ${duration}ms (${(duration / urls.length).toFixed(0)}ms per apartment)`);
    
    return results;
  }
  
  /**
   * Parse apartment details from a detail page
   * Override for compatibility with FastBaseScraper
   */
  protected async parseApartmentDetails($: cheerio.Root, url: string): Promise<any> {
    try {
      // Use parser from base class to get comprehensive apartment data
      const detailData = this.parser.parseApartmentFromDetailPage($, url);
      
      // Enhance with geocoding if coordinates are missing
      if (!detailData.latitude && !detailData.longitude && detailData.address) {
        console.log(`[YOLO Japan] No coordinates found, attempting to geocode address: ${detailData.address}`);
        try {
          const geocodeResult = await geocodingService.geocodeAddress(detailData.address);
          if (geocodeResult && geocodeResult.confidence > 0.6) {
            detailData.latitude = geocodeResult.latitude;
            detailData.longitude = geocodeResult.longitude;
            console.log(`[YOLO Japan] Successfully geocoded coordinates: ${detailData.latitude}, ${detailData.longitude} (confidence: ${geocodeResult.confidence})`);
          }
        } catch (error) {
          console.error(`[YOLO Japan] Error during geocoding:`, error);
        }
      }
      
      // Mark as having fetched details
      detailData.fetchedDetails = true;
      
      return detailData;
    } catch (error) {
      console.error(`Error parsing apartment details from ${url}:`, error);
      return null;
    }
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
 * Helper class that extends YoloBase to access protected parsing methods
 */
class YoloParserHelper extends YoloBase {
  getName(): string {
    return 'YoloParserHelper';
  }
  
  // Make protected methods public for use by the fast scraper
  public parseListingFromSearchPage($: cheerio.Root, $item: cheerio.Cheerio) {
    return super.parseListingFromSearchPage($, $item);
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