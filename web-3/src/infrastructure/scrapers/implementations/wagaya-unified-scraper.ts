/**
 * Unified Wagaya Japan Scraper
 * Combines functionality from both WagayaJapanScraper and FastWagayaScraper
 * Uses the unified architecture with strategy pattern
 */

import { BaseScraper } from '../base/unified-scraper';
import type { ScraperConfig, ScrapeParams, BaseApartment, StationInfo, ScraperSelectors } from '../base/unified-scraper';
import { WagayaBase } from '../../../lib/scrapers/providers/wagaya-base';
import { parseJapaneseAddress } from '../../../lib/scrapers/utils/address-parser';
import type { Root as CheerioAPI } from 'cheerio';

// Wagaya-specific apartment data
export interface WagayaApartment extends BaseApartment {
  area?: string;
  ward?: string;
  city?: string;
  prefecture?: string;
  fetchedDetails?: boolean;
}

/**
 * Unified Wagaya Japan Scraper
 */
export class UnifiedWagayaJapanScraper extends BaseScraper<WagayaApartment> {
  private parser: WagayaBase;
  
  constructor(config?: Partial<ScraperConfig>) {
    // Default configuration
    const defaultConfig: ScraperConfig = {
      mode: 'normal',
      strategy: 'sequential',
      rateLimit: {
        requests: 1,
        perSeconds: 5,  // 1 request per 5 seconds (Wagaya is strict)
        burst: 1
      },
      maxRetries: 3,
      retryDelay: 2000,
      retryBackoff: 'exponential',
      concurrency: 1,
      requestTimeout: 15000,
      totalTimeout: 600000,
      features: {
        screenshots: false,
        cache: true,
        proxy: true  // Wagaya benefits from proxies
      },
      overrides: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
        }
      }
    };
    
    // Apply fast mode overrides if requested
    if (config?.mode === 'fast') {
      defaultConfig.strategy = 'concurrent';
      defaultConfig.strategyConfig = {
        rampUpDelay: 500  // Slower ramp-up for Wagaya
      };
      defaultConfig.rateLimit = {
        requests: 5,
        perSeconds: 1,
        burst: 3
      };
      defaultConfig.concurrency = 5;  // Lower concurrency for Wagaya
      defaultConfig.requestTimeout = 10000;
      defaultConfig.maxRetries = 2;
    }
    
    super({ ...defaultConfig, ...config });
    
    // Create parser instance for parsing logic
    this.parser = new WagayaParserHelper({
      name: 'WagayaParser',
      baseUrl: 'https://wagaya-japan.com',
      rateLimit: 5000,
      maxRetries: 3,
      timeout: 15000
    });
  }
  
  protected getScraperName(): string {
    return 'UnifiedWagayaJapan';
  }
  
  protected getSelectors(): ScraperSelectors {
    return {
      title: '.bukken_name',
      rent: '.price',
      size: '.menseki',
      layout: '.madori',
      buildingType: '.type',
      age: '.chikunen',
      floor: '.floor',
      address: '.address',
      station: '.eki',
      management: '.kanri',
      deposit: '.shikikin',
      keyMoney: '.reikin'
    };
  }
  
  protected async buildUrls(params: ScrapeParams): Promise<string[]> {
    // Base search parameters
    const searchParams = new URLSearchParams({
      'sort': '0', // Default sort
      'room_kei': '0', // All room types
    });

    // Add price filters
    if (params.priceRange) {
      if (params.priceRange.max) {
        searchParams.set('upperprice', params.priceRange.max.toString());
      }
      if (params.priceRange.min) {
        searchParams.set('lowerprice', params.priceRange.min.toString());
      }
    }

    // Add size filters (heibei = square meters)
    if (params.sizeRange) {
      if (params.sizeRange.min) {
        searchParams.set('heibeimin', params.sizeRange.min.toString());
      }
      if (params.sizeRange.max) {
        searchParams.set('heibeimax', params.sizeRange.max.toString());
      }
    }

    // Wagaya requires POST requests for search, but we can use GET for initial page
    const baseUrl = `https://wagaya-japan.com/en/rent/tokyo/list/?${searchParams.toString()}`;
    
    // For dynamic pagination, start with page 1
    return [baseUrl];
  }
  
  protected extractListingUrls(html: string): string[] {
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);
    const urls: string[] = [];
    
    // Extract apartment URLs from search results
    $('.bukken_box').each((_: number, element: any) => {
      const $item = $(element);
      const detailLink = $item.find('a[href*="chintai_detail.php"]').first().attr('href');
      
      if (detailLink) {
        const fullUrl = new URL(detailLink, 'https://wagaya-japan.com').toString();
        urls.push(fullUrl);
      }
    });
    
    // Next page URLs will be discovered during the executeStrategy phase
    
    return urls;
  }
  
  protected extractApartmentData(html: string, url: string): WagayaApartment {
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);
    
    // Check if this is a search page or detail page
    const isSearchPage = url.includes('/list/') || url.includes('/rent/tokyo/list');
    
    if (isSearchPage) {
      // This is a search results page, extract listings
      const apartments: WagayaApartment[] = [];
      
      $('.bukken_box').each((_: number, element: any) => {
        try {
          const $item = $(element);
          const apartment = this.parseListingFromSearchPage($, $item);
          apartments.push(apartment);
        } catch (error) {
          this.logger.error('Error parsing listing', { error, url });
        }
      });
      
      // For search pages, we'll need to handle this differently
      // Return the first apartment or throw an error
      if (apartments.length > 0 && apartments[0]) {
        return apartments[0];
      }
      throw new Error('No apartments found on search page');
    } else {
      // This is a detail page
      return this.parseDetailPage($, url);
    }
  }
  
  private parseListingFromSearchPage($: CheerioAPI, $item: any): WagayaApartment {
    // Use base class parser to extract apartment data
    const apartmentData = this.parser.parseListingFromSearchPage($, $item);
    
    // Parse address components
    const addressComponents = parseJapaneseAddress(apartmentData.address || '');
    
    // Convert to our apartment format
    const apartment: WagayaApartment = {
      id: apartmentData.externalId || this.generateId($),
      url: apartmentData.sourceUrl || '',
      title: apartmentData.title || '',
      rent: apartmentData.price || 0,
      size: apartmentData.size || 25,
      layout: apartmentData.layout || '1K',
      buildingType: apartmentData.buildingType || 'Apartment',
      age: apartmentData.buildingAge || 0,
      floor: apartmentData.floor?.toString() || '',
      address: apartmentData.address || '',
      station: this.parseStationInfo(apartmentData.nearestStations),
      images: apartmentData.images?.map(img => img.url) || [],
      features: apartmentData.features || [],
      management: apartmentData.managementFee,
      deposit: apartmentData.deposit,
      keyMoney: apartmentData.keyMoney,
      agent: 'Wagaya Japan',
      scrapedAt: new Date(),
      source: 'wagaya-japan.com',
      area: addressComponents.area,
      ward: addressComponents.ward,
      city: addressComponents.city,
      prefecture: addressComponents.prefecture
    };
    
    return apartment;
  }
  
  private parseDetailPage($: CheerioAPI, url: string): WagayaApartment {
    // Use base class parser to extract comprehensive apartment data
    const apartmentData = this.parser.parseApartmentFromDetailPage($, url);
    
    // Parse address components
    const addressComponents = parseJapaneseAddress(apartmentData.address || '');
    
    // Convert to our apartment format
    const apartment: WagayaApartment = {
      id: apartmentData.externalId || this.generateId($),
      url: apartmentData.sourceUrl || url,
      title: apartmentData.title || '',
      rent: apartmentData.price || 0,
      size: apartmentData.size || 25,
      layout: apartmentData.layout || '1K',
      buildingType: apartmentData.buildingType || 'Apartment',
      age: apartmentData.buildingAge || 0,
      floor: apartmentData.floor?.toString() || '',
      address: apartmentData.address || '',
      station: this.parseStationInfo(apartmentData.nearestStations),
      coordinates: apartmentData.coordinates,
      images: apartmentData.images?.map(img => img.url) || [],
      features: apartmentData.features || [],
      management: apartmentData.managementFee,
      deposit: apartmentData.deposit,
      keyMoney: apartmentData.keyMoney,
      agent: 'Wagaya Japan',
      scrapedAt: new Date(),
      source: 'wagaya-japan.com',
      area: addressComponents.area,
      ward: addressComponents.ward,
      city: addressComponents.city,
      prefecture: addressComponents.prefecture,
      fetchedDetails: true
    };
    
    return apartment;
  }
  
  private parseStationInfo(stations: any[]): StationInfo {
    if (!stations || stations.length === 0) {
      return {
        name: 'Unknown Station',
        line: 'Unknown Line',
        walkTime: 99
      };
    }
    
    const nearest = stations[0];
    return {
      name: nearest.name || 'Unknown Station',
      line: nearest.lines?.[0] || 'Unknown Line',
      walkTime: nearest.walkingMinutes || 99
    };
  }
  
  private getNextPageUrl($: CheerioAPI, currentUrl: string): string | null {
    try {
      // Wagaya uses form-based pagination
      // Look for the next page button/link
      const nextButton = $('a:contains("次へ"), a:contains("Next")').first();
      const nextHref = nextButton.attr('href');
      
      if (nextHref) {
        // Convert relative URL to absolute if needed
        const nextUrl = new URL(nextHref, 'https://wagaya-japan.com').toString();
        return nextUrl;
      }
      
      // Alternative: Check for page numbers
      const currentPageMatch = currentUrl.match(/[?&]page=(\d+)/);
      const currentPage = currentPageMatch ? parseInt(currentPageMatch[1]) : 1;
      
      // Check if there are more page links
      const pageLinks = $('.pagination a, .pager a');
      let hasNextPage = false;
      
      pageLinks.each((_: number, el: any) => {
        const pageText = $(el).text();
        const pageNum = parseInt(pageText);
        if (!isNaN(pageNum) && pageNum > currentPage) {
          hasNextPage = true;
        }
      });
      
      if (hasNextPage) {
        // Build next page URL
        const urlObj = new URL(currentUrl);
        urlObj.searchParams.set('page', (currentPage + 1).toString());
        return urlObj.toString();
      }
      
      return null;
    } catch (error) {
      this.logger.error('Error getting next page URL:', error);
      return null;
    }
  }
  
  // Override executeStrategy to handle search pages differently
  protected async executeStrategy(urls: string[]): Promise<WagayaApartment[]> {
    const allApartments: WagayaApartment[] = [];
    const processedUrls = new Set<string>();
    const urlQueue = [...urls];
    
    while (urlQueue.length > 0) {
      const currentUrl = urlQueue.shift()!;
      
      if (processedUrls.has(currentUrl)) {
        continue;
      }
      processedUrls.add(currentUrl);
      
      try {
        const html = await this.fetchWithRetry(currentUrl);
        const cheerio = require('cheerio');
        const $ = cheerio.load(html);
        
        // Check if this is a search page
        if (currentUrl.includes('/list/') || currentUrl.includes('/rent/tokyo/list')) {
          // Extract apartments from search page
          $('.bukken_box').each((_: number, element: any) => {
            try {
              const $item = $(element);
              const apartment = this.parseListingFromSearchPage($, $item);
              allApartments.push(apartment);
            } catch (error) {
              this.logger.error('Error parsing listing', { error, url: currentUrl });
            }
          });
          
          // Check for next page
          const nextPageUrl = this.getNextPageUrl($, currentUrl);
          if (nextPageUrl && !processedUrls.has(nextPageUrl)) {
            urlQueue.push(nextPageUrl);
          }
        } else {
          // This is a detail page
          const apartment = this.parseDetailPage($, currentUrl);
          allApartments.push(apartment);
        }
        
        this.progressTracker.recordSuccess();
      } catch (error) {
        this.logger.error('Error processing URL', { error, url: currentUrl });
        this.progressTracker.recordFailure();
      }
    }
    
    return allApartments;
  }
}

/**
 * Helper class that extends WagayaBase to access protected parsing methods
 */
class WagayaParserHelper extends WagayaBase {
  getName(): string {
    return 'WagayaParserHelper';
  }
  
  // Make protected methods public for use by the unified scraper
  public parseListingFromSearchPage($: CheerioAPI, $item: any) {
    return super.parseListingFromSearchPage($, $item);
  }
  
  public parseApartmentFromDetailPage($: CheerioAPI, url: string) {
    return super.parseApartmentFromDetailPage($, url);
  }
}