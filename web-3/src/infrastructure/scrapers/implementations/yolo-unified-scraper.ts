/**
 * Unified YOLO Japan Scraper
 * Combines functionality from both YoloJapanScraper and FastYoloJapanScraper
 * Uses the unified architecture with strategy pattern
 */

import { BaseScraper } from '../base/unified-scraper';
import type { ScraperConfig, ScrapeParams, BaseApartment, StationInfo, ScraperSelectors } from '../base/unified-scraper';
import { YoloBase } from '../../../lib/scrapers/providers/yolo-base';
import { parseJapaneseAddress } from '../../../lib/scrapers/utils/address-parser';
import type { Root as CheerioAPI } from 'cheerio';

// YOLO-specific apartment data
export interface YoloApartment extends BaseApartment {
  area?: string;
  ward?: string;
  city?: string;
  prefecture?: string;
  fetchedDetails?: boolean;
}

/**
 * Unified YOLO Japan Scraper
 */
export class UnifiedYoloJapanScraper extends BaseScraper<YoloApartment> {
  private parser: YoloBase;
  private itemsPerPage = 50;
  
  constructor(config?: Partial<ScraperConfig>) {
    // Default configuration
    const defaultConfig: ScraperConfig = {
      mode: 'normal',
      strategy: 'sequential',
      rateLimit: {
        requests: 3,
        perSeconds: 1,
        burst: 5
      },
      maxRetries: 3,
      retryDelay: 1000,
      retryBackoff: 'exponential',
      concurrency: 1,
      requestTimeout: 30000,
      totalTimeout: 600000,
      features: {
        screenshots: false,
        cache: true,
        proxy: true
      },
      overrides: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
        }
      }
    };
    
    // Apply fast mode overrides if requested
    if (config?.mode === 'fast') {
      defaultConfig.strategy = 'concurrent';
      defaultConfig.strategyConfig = {
        rampUpDelay: 200
      };
      defaultConfig.rateLimit = {
        requests: 10,
        perSeconds: 1,
        burst: 5
      };
      defaultConfig.concurrency = 10;
      defaultConfig.requestTimeout = 10000;
      defaultConfig.maxRetries = 2;
    }
    
    super({ ...defaultConfig, ...config });
    
    // Create parser instance for parsing logic
    this.parser = new YoloParserHelper({
      name: 'YoloParser',
      baseUrl: 'https://home.yolo-japan.com',
      rateLimit: 1000,
      maxRetries: 3,
      timeout: 30000
    });
  }
  
  protected getScraperName(): string {
    return 'UnifiedYoloJapan';
  }
  
  protected getSelectors(): ScraperSelectors {
    return {
      title: '.property-title',
      rent: '.price-amount',
      size: '.area-value',
      layout: '.room-type',
      buildingType: '.building-type',
      age: '.building-age',
      floor: '.floor-number',
      address: '.property-address',
      station: '.station-access',
      management: '.management-fee',
      deposit: '.deposit-amount',
      keyMoney: '.key-money'
    };
  }
  
  protected async buildUrls(params: ScrapeParams): Promise<string[]> {
    // Base search URL for Tokyo
    const searchParams = new URLSearchParams({
      perPage: this.itemsPerPage.toString(),
    });

    // Add price filters (YOLO uses thousands, e.g., 160 for 160,000 yen)
    if (params.priceRange) {
      if (params.priceRange.max) {
        searchParams.set('priceTo', Math.floor(params.priceRange.max / 1000).toString());
      }
      if (params.priceRange.min) {
        searchParams.set('priceFrom', Math.floor(params.priceRange.min / 1000).toString());
      }
    }

    // Add size filters
    if (params.sizeRange) {
      if (params.sizeRange.min) {
        searchParams.set('areaFrom', Math.floor(params.sizeRange.min).toString());
      }
      if (params.sizeRange.max) {
        searchParams.set('areaTo', Math.floor(params.sizeRange.max).toString());
      }
    }

    const baseUrl = `https://home.yolo-japan.com/en/tokyo/list?${searchParams.toString()}`;
    
    // For dynamic pagination, start with page 1 and discover more pages
    return [`${baseUrl}&page=1`];
  }
  
  protected extractListingUrls(html: string): string[] {
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);
    const urls: string[] = [];
    
    // Extract apartment URLs from search results
    $('.property-item').each((_: number, element: any) => {
      const $item = $(element);
      const detailLink = $item.find('a[href*="/property/"]').first().attr('href');
      
      if (detailLink) {
        const fullUrl = new URL(detailLink, 'https://home.yolo-japan.com').toString();
        urls.push(fullUrl);
      }
    });
    
    // Next page URLs will be discovered during the executeStrategy phase
    
    return urls;
  }
  
  protected extractApartmentData(html: string, url: string): YoloApartment {
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);
    
    // Check if this is a search page or detail page
    const isSearchPage = url.includes('/list?') || url.includes('/tokyo/list');
    
    if (isSearchPage) {
      // This is a search results page, extract listings
      const apartments: YoloApartment[] = [];
      
      $('.property-item').each((_: number, element: any) => {
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
  
  private parseListingFromSearchPage($: CheerioAPI, $item: any): YoloApartment {
    // Use base class parser to extract apartment data
    const apartmentData = this.parser.parseListingFromSearchPage($, $item);
    
    // Extract basic fees if available
    const fees = this.parser.parseBasicFeesFromSearchPage($item);
    
    // Extract thumbnail
    const images = this.parser.parseThumbnailFromSearchPage($item);
    
    // Extract basic station info
    const nearestStations = this.parser.parseBasicStationInfoFromSearchPage($item);
    
    // Parse address components
    const addressComponents = parseJapaneseAddress(apartmentData.address || '');
    
    // Convert to our apartment format
    const apartment: YoloApartment = {
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
      station: this.parseStationInfo(nearestStations),
      images: images.map(img => img.url),
      features: [],
      management: fees.managementFee,
      deposit: fees.deposit,
      keyMoney: fees.keyMoney,
      agent: 'YOLO Japan',
      scrapedAt: new Date(),
      source: 'home.yolo-japan.com',
      area: addressComponents.area,
      ward: addressComponents.ward,
      city: addressComponents.city,
      prefecture: addressComponents.prefecture
    };
    
    return apartment;
  }
  
  private parseDetailPage($: CheerioAPI, url: string): YoloApartment {
    // Use base class parser to extract comprehensive apartment data
    const apartmentData = this.parser.parseApartmentFromDetailPage($, url);
    
    // Parse address components
    const addressComponents = parseJapaneseAddress(apartmentData.address || '');
    
    // Convert to our apartment format
    const apartment: YoloApartment = {
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
      agent: 'YOLO Japan',
      scrapedAt: new Date(),
      source: 'home.yolo-japan.com',
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
      // YOLO Japan uses pagination with page numbers
      const currentPageMatch = currentUrl.match(/[?&]page=(\d+)/);
      const currentPage = currentPageMatch ? parseInt(currentPageMatch[1]) : 1;
      
      // Check if there's a next page by looking for the next page link
      const nextPageLink = $(`a[href*="page=${currentPage + 1}"]`).first().attr('href');
      
      if (nextPageLink) {
        // Convert relative URL to absolute if needed
        const nextUrl = new URL(nextPageLink, 'https://home.yolo-japan.com').toString();
        return nextUrl;
      }
      
      // Alternative: Check if current page has full results
      const propertyCount = $('.property-item').length;
      if (propertyCount === this.itemsPerPage) {
        // Likely more pages exist
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
  protected async executeStrategy(urls: string[]): Promise<YoloApartment[]> {
    const allApartments: YoloApartment[] = [];
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
        if (currentUrl.includes('/list?') || currentUrl.includes('/tokyo/list')) {
          // Extract apartments from search page
          $('.property-item').each((_: number, element: any) => {
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
 * Helper class that extends YoloBase to access protected parsing methods
 */
class YoloParserHelper extends YoloBase {
  getName(): string {
    return 'YoloParserHelper';
  }
  
  // Make protected methods public for use by the unified scraper
  public parseListingFromSearchPage($: CheerioAPI, $item: any) {
    return super.parseListingFromSearchPage($, $item);
  }
  
  public parseBasicFeesFromSearchPage($item: any) {
    return super.parseBasicFeesFromSearchPage($item);
  }
  
  public parseThumbnailFromSearchPage($item: any) {
    return super.parseThumbnailFromSearchPage($item);
  }
  
  public parseBasicStationInfoFromSearchPage($item: any) {
    return super.parseBasicStationInfoFromSearchPage($item);
  }
  
  public parseApartmentFromDetailPage($: CheerioAPI, url: string) {
    return super.parseApartmentFromDetailPage($, url);
  }
}