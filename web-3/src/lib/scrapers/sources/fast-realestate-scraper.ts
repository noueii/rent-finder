import { FastBaseScraperQueue } from '../fast-base-scraper-queue';
import { RealEstateBase } from '../providers/realestate-base';
import type { Apartment, SearchParams } from '~/types/apartment';
import type { ScrapeResult } from '~/types/scraper';
import type * as cheerio from 'cheerio';

/**
 * Fast RealEstate.co.jp Scraper - Uses simple queue-based concurrency
 * Uses composition to combine FastBaseScraperQueue for fetching and RealEstateBase for parsing
 */
export class UnifiedRealEstateScraper extends FastBaseScraperQueue {
  private parser: RealEstateBase;
  
  constructor(config?: any) {
    super({
      name: 'FastRealEstate',
      baseUrl: 'https://realestate.co.jp',
      rateLimit: 200, // Reduced from 1000ms to 200ms for 5x speed
      maxRetries: 2,
      timeout: 10000,
      headers: {
        'Accept-Language': 'en,ja;q=0.9',
        'Referer': 'https://realestate.co.jp/',
      },
      ...config,
    });
    
    // Create parser instance for parsing logic
    this.parser = new RealEstateParserHelper(this.config);
    
    this.scraperType = 'realestate-fast';
    this.bypassRobotsTxt = true; // RealEstate blocks most paths
    this.maxConcurrency = 30; // Increased from 20 to 30 workers
    this.enableConcurrentRequests = true;
  }
  
  getName(): string {
    return 'Fast RealEstate.co.jp';
  }
  
  async search(params: SearchParams): Promise<ScrapeResult<Apartment[]>> {
    try {
      // Warm up proxies for better performance
      if (this.fastProxyManager && params.warmupProxies !== false) {
        await this.warmupProxies(10);
      }
      
      const { prefecture = 'tokyo', maxPrice, minSize, limit = 100 } = params;
      
      // Build search URL for Tokyo rentals
      const firstPageUrl = this.buildSearchUrl({ 
        prefecture, 
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
      const pagesToFetch = Math.min(totalPages, Math.ceil(limit / 30)); // 30 items per page
      
      // Fetch all pages concurrently
      const pageUrls = Array.from({ length: pagesToFetch }, (_, i) => 
        this.buildSearchUrl({ prefecture, maxPrice, minSize, page: i + 1 })
      );
      
      const startTime = Date.now();
      
      const pageResults = await this.fetchHtmlBatch(pageUrls);
      const fetchDuration = Date.now() - startTime;
      
      // Parse all successful pages using the base class parser
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
    // RealEstate.co.jp URL structure
    const searchParams = new URLSearchParams({
      prefecture: 'JP-13', // Tokyo
      city: '13000', // All Tokyo
      trainline: '',
      district: '',
      search: 'Search',
      order: 'date_entered_ranking-desc', // Sort by newest entries first
      page: params.page?.toString() || '1',
    });

    // Add price filters
    if (params.maxPrice) {
      searchParams.set('max_rent', params.maxPrice.toString());
    }
    if (params.minSize) {
      searchParams.set('min_area', params.minSize.toString());
    }

    return `${this.config.baseUrl}/en/rent?${searchParams.toString()}`;
  }
  
  private getTotalPages($: cheerio.Root): number {
    try {
      // Look for pagination
      const lastPageLink = $('.pagination a:last-child').attr('href');
      if (lastPageLink) {
        const pageMatch = lastPageLink.match(/page=(\d+)/);
        if (pageMatch) {
          return parseInt(pageMatch[1], 10);
        }
      }
      
      // Alternative: check result count
      const resultText = $('.search-result-header').text();
      const totalMatch = resultText.match(/(\d+)\s*properties/i);
      if (totalMatch) {
        const total = parseInt(totalMatch[1], 10);
        return Math.ceil(total / 30);
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
    
    // Find all property listings on the page
    const propertyListings = $('.property-listing');
    
    propertyListings.each((_, element) => {
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
        
        // Convert to Apartment type for compatibility
        const apartment: Apartment = {
          id: apartmentData.externalId || '',
          title: apartmentData.title || '',
          price: apartmentData.price || 0,
          size: apartmentData.size || 25,
          layout: apartmentData.layout,
          location: apartmentData.address || 'Tokyo',
          address: apartmentData.address || '',
          floor: apartmentData.floor?.toString(),
          buildingType: apartmentData.layout,
          age: apartmentData.buildingAge,
          imageUrl: images[0]?.url,
          sourceUrl: apartmentData.sourceUrl || '',
          scrapedAt: new Date(),
          scrapedFrom: 'realestate',
          stationInfo: nearestStations.map(s => `${s.name} (${s.walkingMinutes} min)`),
        };
        
        apartments.push(apartment);
        
      } catch (error) {
        console.error('Error parsing apartment:', error);
      }
    });
    
    return apartments;
  }
  
  // Add methods for warmup and proxy health if they don't exist in parent
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
 * Helper class that extends RealEstateBase to access protected parsing methods
 */
class RealEstateParserHelper extends RealEstateBase {
  getName(): string {
    return 'RealEstateParserHelper';
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
}