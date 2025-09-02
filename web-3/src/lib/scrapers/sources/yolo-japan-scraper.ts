import type * as cheerio from 'cheerio';
import { YoloBase } from '../providers/yolo-base';
import { parseJapaneseAddress } from '../utils/address-parser';
import type {
  ScrapedApartmentData,
  ScraperSearchParams,
  ScraperConfig,
} from '~/types/scraper';

/**
 * YOLO Japan normal scraper implementation
 * Uses YoloBase for parsing logic
 * Handles both search results and detail page scraping
 * 
 * Search URL: https://home.yolo-japan.com/en/tokyo/list?priceTo=160&areaFrom=25&perPage=50&page=1
 * Detail URL: https://home.yolo-japan.com/en/property/1411616
 */
export class UnifiedYoloJapanScraper extends YoloBase {
  public scraperType = 'yolo-japan';
  private itemsPerPage = 50; // YOLO Japan supports up to 50 items per page
  private totalApartmentCount: number | null = null; // Cache total count across pages
  private averageApartmentsPerPage: number = 75; // Default estimate based on observed data
  private shouldStopFetchAll: boolean = false; // Flag to stop fetchAll when last page is reached
  
  constructor(config?: Partial<ScraperConfig>) {
    const defaultConfig: ScraperConfig = {
      name: 'YOLO Japan Home',
      baseUrl: 'https://home.yolo-japan.com',
      rateLimit: 300, // 0.3 seconds between requests (with proxies)
      maxRetries: 3,
      timeout: 30000,
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
    };
    
    super({ ...defaultConfig, ...config });
  }

  getName(): string {
    return 'YOLO Japan Scraper';
  }

  /**
   * Build search URLs based on search parameters
   */
  protected async buildSearchUrls(params: ScraperSearchParams): Promise<string[]> {
    const urls: string[] = [];
    
    // Base search URL for Tokyo
    const searchParams = new URLSearchParams({
      perPage: this.itemsPerPage.toString(),
    });

    // Add price filters (YOLO uses thousands, e.g., 160 for 160,000 yen)
    if (params.maxPrice) {
      searchParams.set('priceTo', Math.floor(params.maxPrice / 1000).toString());
    }
    if (params.minPrice) {
      searchParams.set('priceFrom', Math.floor(params.minPrice / 1000).toString());
    }

    // Add size filters
    if (params.minSize) {
      searchParams.set('areaFrom', Math.floor(params.minSize).toString());
    }
    if (params.maxSize) {
      searchParams.set('areaTo', Math.floor(params.maxSize).toString());
    }

    // TODO: Map layout types to YOLO's room type parameters
    // TODO: Map station names to YOLO's location parameters

    const baseUrl = `${this.config.baseUrl}/en/tokyo/list?${searchParams.toString()}`;
    
    // Handle pagination
    const startPage = params.page || 1;
    
    // Check if we should fetch all pages or have no limit
    if (params.fetchAll || !params.limit) {
      console.log('🔄 Dynamic pagination enabled - will retrieve pages until no more found');
      // Just return the first page URL, dynamic pagination will handle the rest
      const firstPageUrl = `${baseUrl}&page=${startPage}`;
      return [firstPageUrl];
    }
    
    // Fetch first page to get total count if we don't have it cached
    if (this.totalApartmentCount === null) {
      console.log('[YOLO Japan] Fetching first page to get total apartment count...');
      const firstPageResult = await this.fetchAndParse(`${baseUrl}&page=1`);
      
      if (firstPageResult.success && firstPageResult.data) {
        const $ = firstPageResult.data;
        const totalCount = this.extractTotalCount($);
        if (totalCount) {
          this.totalApartmentCount = totalCount;
          console.log(`[YOLO Japan] Total apartments available: ${totalCount}`);
        }
      }
    }
    
    // Only proceed with limit logic if limit is provided
    const limit = params.limit || 100; // Default for backwards compatibility
    const pagesNeeded = Math.ceil(limit / this.itemsPerPage);
    const totalPages = this.totalApartmentCount ? Math.ceil(this.totalApartmentCount / this.itemsPerPage) : pagesNeeded;
    
    // Calculate expected total based on actual data
    let expectedTotal: number = this.totalApartmentCount || (pagesNeeded * this.itemsPerPage);
    
    // Report expected total to progress callback if available
    if (this.progressCallback) {
      this.progressCallback({
        total: expectedTotal,
        completed: 0,
        failed: 0,
        currentPage: 0,
        totalPages: pagesNeeded,
        startedAt: new Date(),
      });
      console.log(`[YOLO Japan] Reported expected total: ${expectedTotal} apartments (from ${this.totalApartmentCount || 'estimated'} total)`);
    }
    
    for (let p = startPage; p < startPage + pagesNeeded; p++) {
      const pageUrl = `${baseUrl}&page=${p}`;
      urls.push(pageUrl);
    }
    
    console.log(`\n🔍 YOLO JAPAN PAGINATION PLAN:`);
    console.log(`- Requested limit: ${limit} apartments`);
    console.log(`- Items per page: ${this.itemsPerPage}`);
    console.log(`- Pages to fetch: ${urls.length}`);
    console.log(`- Expected total: ${expectedTotal} apartments`);
    console.log(`- URLs:`, urls);
    console.log('');
    
    return urls;
  }

  /**
   * Build all search URLs by detecting total pages from first page
   * This method fetches the first page to determine the exact number of pages
   */
  private async buildAllSearchUrls(baseUrl: string): Promise<string[]> {
    console.log('[YOLO Japan] FetchAll mode - Fetching first page to determine total pages...');
    
    const firstPageUrl = `${baseUrl}&page=1`;
    const result = await this.fetchAndParse(firstPageUrl);
    
    if (!result.success || !result.data) {
      console.error('[YOLO Japan] Failed to fetch first page for pagination info');
      return [firstPageUrl]; // Return at least the first page
    }
    
    const $ = result.data;
    
    // Extract total pages from the first page
    let totalPages = 1;
    const paginationLinks = $('.pagination a, .page-link, .pager a');
    let maxPage = 1;
    
    paginationLinks.each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      const text = $el.text().trim();
      
      if (href) {
        const pageMatch = href.match(/page=(\d+)/i);
        if (pageMatch) {
          const pageNum = parseInt(pageMatch[1], 10);
          if (pageNum > maxPage) {
            maxPage = pageNum;
          }
        }
      }
      
      const textMatch = text.match(/^\d+$/);
      if (textMatch) {
        const pageNum = parseInt(text, 10);
        if (pageNum > maxPage) {
          maxPage = pageNum;
        }
      }
    });
    
    // Check for "Last" or ">>" button
    const lastPageLink = $('.pagination a:contains("Last"), .pagination a:contains(">>"), .pagination a:last').attr('href');
    if (lastPageLink) {
      const pageMatch = lastPageLink.match(/page=(\d+)/i);
      if (pageMatch) {
        const lastPage = parseInt(pageMatch[1], 10);
        if (lastPage > maxPage) {
          maxPage = lastPage;
        }
      }
    }
    
    totalPages = maxPage;
    
    // Also extract total count for accurate progress reporting
    const totalItems = this.extractTotalCount($);
    
    // Build URLs for all pages
    const urls: string[] = [];
    for (let page = 1; page <= totalPages; page++) {
      urls.push(`${baseUrl}&page=${page}`);
    }
    
    console.log(`[YOLO Japan] FetchAll mode: Found ${totalPages} total pages`);
    if (totalItems) {
      console.log(`[YOLO Japan] Total apartments: ${totalItems} (avg ${this.averageApartmentsPerPage} per page)`);
    }
    
    return urls;
  }

  /**
   * Scrape a search results page and return apartment data directly
   * YOLO Japan groups apartments by building, so we extract all data from search results
   */
  protected async scrapeSearchPage(
    url: string,
    params: ScraperSearchParams
  ): Promise<ScrapedApartmentData[]> {
    console.log(`\n\n========== YOLO JAPAN SEARCH PAGE SCRAPE ==========`);
    console.log(`URL: ${url}`);
    console.log(`Method: scrapeSearchPage (returns ScrapedApartmentData[])`);
    console.log(`==================================================\n`);
    
    const result = await this.fetchAndParse(url);
    
    if (!result.success || !result.data) {
      console.error(`Failed to fetch search page: ${url}`, result.error);
      return [];
    }
    
    const $ = result.data;
    const apartments: ScrapedApartmentData[] = [];
    
    // YOLO groups apartments by building with class="property-wrapper"
    $('.property-wrapper').each((_, buildingWrapper) => {
      const $building = $(buildingWrapper);
      
      // Extract building-level information from .propery-preview section (note the typo in their class name)
      const $preview = $building.find('.propery-preview');
      const buildingName = this.cleanText($preview.find('.info-preview h5 a').text());
      const stationInfo = this.cleanText($preview.find('.info-preview .txt-info.mb-3 .getTransportation').text());
      const locationInfo = this.cleanText($preview.find('.info-preview .txt-info').last().text());
      
      // Parse building address from the location info
      let buildingAddress = 'Tokyo';
      let area: string | undefined;
      let ward: string | undefined;
      let city: string | undefined;
      let prefecture: string | undefined;
      
      if (locationInfo) {
        // YOLO format: "Tokyo Shinjuku Ku早稲田鶴巻町"
        buildingAddress = locationInfo.split('/')[0].trim();
        
        // Parse address components
        const addressParts = parseJapaneseAddress(buildingAddress);
        area = addressParts.area;
        ward = addressParts.ward;
        city = addressParts.city;
        prefecture = addressParts.prefecture;
      }
      
      // Parse station information
      const nearestStations: ScrapedApartmentData['nearestStations'] = [];
      if (stationInfo) {
        const stationLines = stationInfo.split('\n').filter(line => line.trim());
        stationLines.forEach(line => {
          const stationData = this.parseStationInfo(line);
          if (stationData) {
            nearestStations.push(stationData);
          }
        });
      }
      
      // Extract individual apartments within this building
      $building.find('.property-item').each((_, apartmentElement) => {
        try {
          const $item = $(apartmentElement);
          
          // Use base class parser to extract apartment data
          const apartmentData = this.parseListingFromSearchPage($, $item);
          
          // Override with building-level data
          apartmentData.address = buildingAddress;
          apartmentData.area = area;
          apartmentData.ward = ward;
          apartmentData.city = city;
          apartmentData.prefecture = prefecture;
          
          // Use building-level station info if not found on apartment
          if (!apartmentData.nearestStations || apartmentData.nearestStations.length === 0) {
            apartmentData.nearestStations = nearestStations;
          }
          
          // Extract basic fees if available
          const fees = this.parseBasicFeesFromSearchPage($item);
          if (fees.feesTotal && fees.feesTotal > 0) {
            apartmentData.feesTotal = fees.feesTotal;
            apartmentData.feesJson = {
              deposit: fees.deposit || 0,
              keyMoney: fees.keyMoney || 0,
            };
          }
          
          // Extract thumbnail
          const images = this.parseThumbnailFromSearchPage($item);
          apartmentData.images = images;
          
          // Ensure required fields
          if (!apartmentData.title || !apartmentData.price || !apartmentData.size) {
            console.log('Missing required fields for listing:', { 
              title: apartmentData.title, 
              price: apartmentData.price, 
              size: apartmentData.size 
            });
            return;
          }
          
          apartments.push(apartmentData as ScrapedApartmentData);
          
          console.log(`\n========== EXTRACTED APARTMENT ==========`);
          console.log(`ID: ${apartmentData.externalId}`);
          console.log(`Title: ${apartmentData.title}`);
          console.log(`Price: ¥${apartmentData.price?.toLocaleString()}`);
          console.log(`Size: ${apartmentData.size}m²`);
          console.log(`==========================================\n`);
          
        } catch (error) {
          console.error('Error extracting apartment:', error);
        }
      });
    });
    
    console.log(`\n========== SCRAPING SUMMARY ==========`);
    console.log(`Total apartments extracted: ${apartments.length}`);
    console.log(`======================================\n`);
    
    return apartments;
  }

  /**
   * Extract apartment data from a detail page
   * This method can be called when fetching apartment details
   */
  async getApartmentDetails(url: string): Promise<ScrapedApartmentData | null> {
    const htmlResult = await this.fetchHtml(url);
    
    if (!htmlResult.success || !htmlResult.data) {
      console.error(`Failed to fetch detail page: ${url}`, htmlResult.error);
      return null;
    }
    
    const html = htmlResult.data;
    const cheerio = await import('cheerio');
    const $ = cheerio.load(html);
    
    // Save HTML for debugging if enabled
    if (this.debugMode) {
      await this.saveHtmlDebug(url, html);
    }
    
    // Check if listing has been removed
    const removalCheck = await this.checkIfListingRemoved(url, htmlResult.metadata as any, html);
    if (removalCheck.isRemoved) {
      console.warn(`[YOLO] Listing appears to be removed: ${url}`, removalCheck);
      
      // Update database to mark apartment as removed
      const externalId = this.extractIdFromUrl(url);
      if (externalId) {
        try {
          const { ApartmentRemovalHandler } = await import('../utils/apartment-removal-handler');
          await ApartmentRemovalHandler.handleRemovalCheck(
            externalId,
            'home.yolo-japan.com',
            removalCheck
          );
        } catch (error) {
          console.error('[YOLO] Error updating removal status in database:', error);
        }
      }
      
      // Return a special marker object to indicate removal
      if (process.env.SCRAPER_TEST_MODE === 'true') {
        return {
          externalId: externalId || 'unknown',
          sourceUrl: url,
          sourceSite: 'home.yolo-japan.com',
          _isRemoved: true,
          _removalReason: removalCheck.reason,
          _removalConfidence: removalCheck.confidence,
          _rawHtml: html,
          _httpResponse: htmlResult.metadata,
        } as any;
      }
      return null;
    }
    
    const apartmentData = await this.extractApartmentData($, url);
    
    // If we're in test mode, attach the raw HTML to the result
    if (apartmentData && process.env.SCRAPER_TEST_MODE === 'true') {
      (apartmentData as any)._rawHtml = html;
      (apartmentData as any)._httpResponse = htmlResult.metadata;
    }
    
    return apartmentData;
  }
  
  private extractIdFromUrl(url: string): string | null {
    const match = url.match(/property\/(\d+)/);
    return match ? match[1] : null;
  }
  
  /**
   * Check if a YOLO listing has been removed
   * Override the base implementation with YOLO-specific logic
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
    // First check base conditions (404, 410, etc.)
    const baseCheck = await super.checkIfListingRemoved(url, httpResponse, html);
    if (baseCheck.isRemoved && baseCheck.confidence === 'high') {
      return baseCheck;
    }
    
    // YOLO-specific: ANY redirect means the listing is deleted
    if (httpResponse.redirected) {
      return {
        isRemoved: true,
        reason: `Property deleted - redirected to ${httpResponse.finalUrl}`,
        confidence: 'high'
      };
    }
    
    // Additional YOLO-specific checks if not redirected
    if (html) {
      const $ = await import('cheerio').then(c => c.load(html));
      
      // Check for error messages
      const errorMessage = $('.error-message, .property-not-found').text().toLowerCase();
      if (errorMessage.includes('not found') || errorMessage.includes('no longer available')) {
        return {
          isRemoved: true,
          reason: 'Property not found message detected',
          confidence: 'high'
        };
      }
      
      // Check if main property container exists
      const hasPropertyDetails = $('.property-details, .detail-content, .property-info').length > 0;
      if (!hasPropertyDetails && httpResponse.statusCode === 200) {
        return {
          isRemoved: true,
          reason: 'Property details container missing',
          confidence: 'medium'
        };
      }
    }
    
    return baseCheck;
  }

  /**
   * Extract apartment data from a detail page
   */
  protected async extractApartmentData(
    $: cheerio.CheerioAPI,
    url: string
  ): Promise<ScrapedApartmentData | null> {
    try {
      console.log(`Extracting apartment data from detail page: ${url}`);
      
      // Use base class parser to extract comprehensive apartment data
      const apartmentData = this.parseApartmentFromDetailPage($, url);
      
      // Mark as having fetched details
      apartmentData.fetchedDetails = true;
      
      console.log(`Successfully extracted apartment: ${apartmentData.externalId}`);
      return apartmentData;
    } catch (error) {
      console.error('Error extracting apartment data:', error);
      return null;
    }
  }

  /**
   * Extract total pages and calculate estimated apartment count
   */
  private extractTotalCount($: CheerioAPI): number | null {
    let totalApartments: number | null = null;
    let totalPages = 1;
    
    // Look for total apartment count in various formats
    // Common patterns: "76 properties found", "Total: 76", "76 件", etc.
    const totalSelectors = [
      '.list-filter__left .total',
      '.search-results-count',
      '.total-count',
      '.results-summary',
      '.property-count',
      '.search-total'
    ];
    
    for (const selector of totalSelectors) {
      const text = $(selector).text();
      // Updated regex to handle comma-separated numbers
      const match = text.match(/(\d{1,3}(?:,\d{3})*)\s*(?:properties|apartments|results|件|物件)/i);
      if (match) {
        // Remove commas before parsing
        totalApartments = parseInt(match[1].replace(/,/g, ''), 10);
        console.log(`[YOLO Japan] Found total apartments: ${totalApartments} from "${text.trim()}"`);
        break;
      }
    }
    
    // If not found in specific elements, search in page text
    if (!totalApartments) {
      const pageText = $('.search-results, .results-header, .page-header').text();
      const match = pageText.match(/(\d{1,3}(?:,\d{3})*)\s*(?:properties|apartments|results|件|物件)\s*(?:found|total|検索結果)/i);
      if (match) {
        totalApartments = parseInt(match[1].replace(/,/g, ''), 10);
        console.log(`[YOLO Japan] Found total apartments in page text: ${totalApartments}`);
      }
    }
    
    // Extract total pages from pagination
    const paginationLinks = $('.pagination a, .page-link, .pager a');
    let maxPage = 1;
    
    paginationLinks.each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      const text = $el.text().trim();
      
      // Check href for page numbers
      if (href) {
        const pageMatch = href.match(/page=(\d+)/i);
        if (pageMatch) {
          const pageNum = parseInt(pageMatch[1], 10);
          if (pageNum > maxPage) {
            maxPage = pageNum;
          }
        }
      }
      
      // Also check text content for page numbers
      const textMatch = text.match(/^\d+$/);
      if (textMatch) {
        const pageNum = parseInt(text, 10);
        if (pageNum > maxPage) {
          maxPage = pageNum;
        }
      }
    });
    
    // Check for "Last" or ">>" button
    const lastPageLink = $('.pagination a:contains("Last"), .pagination a:contains(">>"), .pagination a:last').attr('href');
    if (lastPageLink) {
      const pageMatch = lastPageLink.match(/page=(\d+)/i);
      if (pageMatch) {
        const lastPage = parseInt(pageMatch[1], 10);
        if (lastPage > maxPage) {
          maxPage = lastPage;
        }
      }
    }
    
    totalPages = maxPage;
    console.log(`[YOLO Japan] Found ${totalPages} total pages`);
    
    // Calculate average apartments per page if we have both values
    if (totalApartments && totalPages > 0) {
      this.averageApartmentsPerPage = Math.ceil(totalApartments / totalPages);
      console.log(`[YOLO Japan] Calculated average: ${this.averageApartmentsPerPage} apartments/page (${totalApartments} total ÷ ${totalPages} pages)`);
      return totalApartments;
    }
    
    // Fallback: count current page apartments and estimate
    const apartmentsOnPage = $('.property-wrapper .property-item').length;
    if (apartmentsOnPage > 0) {
      this.averageApartmentsPerPage = apartmentsOnPage;
      const estimatedTotal = totalPages * apartmentsOnPage;
      console.log(`[YOLO Japan] Fallback estimate: ${estimatedTotal} apartments (${totalPages} pages × ${apartmentsOnPage} on current page)`);
      return estimatedTotal;
    }
    
    // Last resort: use default average
    const defaultEstimate = totalPages * this.averageApartmentsPerPage;
    console.log(`[YOLO Japan] Using default estimate: ${defaultEstimate} apartments`);
    return defaultEstimate;
  }

  /**
   * Parse station information from YOLO format
   * Example: "Tokyo Metro-Tozai line Waseda 6 minutes on foot"
   */
  private parseStationInfo(text: string): ScrapedApartmentData['nearestStations'][0] | null {
    const cleanedText = this.cleanText(text);
    if (!cleanedText) return null;
    
    // YOLO format: "Line name Station name X minutes on foot"
    // More flexible regex to handle variations
    const match = cleanedText.match(/^(.+?line)\s+(\S+)\s+(\d+)\s+minutes?\s+on\s+foot$/i);
    if (!match) return null;
    
    const [, lineName, stationName, minutes] = match;
    
    return {
      name: stationName + ' Station',
      walkingMinutes: parseInt(minutes, 10),
      lines: [lineName.trim()],
    };
  }

  /**
   * Check if we've reached the last page of results
   * @param $ Cheerio instance of the current page
   * @param currentPageUrl The URL of the current page being scraped
   * @returns true if this is the last page, false otherwise
   */
  protected isLastScrapePage($: cheerio.CheerioAPI, currentPageUrl: string): boolean {
    // Extract current page number from URL
    const urlMatch = currentPageUrl.match(/page=(\d+)/i);
    if (!urlMatch) {
      console.log('[YOLO Japan] Could not extract page number from URL, assuming first page');
      return false;
    }
    
    const currentPage = parseInt(urlMatch[1], 10);
    
    // Extract total pages from the HTML (same logic as extractTotalCount)
    const paginationLinks = $('.pagination a, .page-link, .pager a');
    let maxPage = 1;
    
    paginationLinks.each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      const text = $el.text().trim();
      
      if (href) {
        const pageMatch = href.match(/page=(\d+)/i);
        if (pageMatch) {
          const pageNum = parseInt(pageMatch[1], 10);
          if (pageNum > maxPage) {
            maxPage = pageNum;
          }
        }
      }
      
      const textMatch = text.match(/^\d+$/);
      if (textMatch) {
        const pageNum = parseInt(text, 10);
        if (pageNum > maxPage) {
          maxPage = pageNum;
        }
      }
    });
    
    // Check for "Last" or ">>" button
    const lastPageLink = $('.pagination a:contains("Last"), .pagination a:contains(">>"), .pagination a:last').attr('href');
    if (lastPageLink) {
      const pageMatch = lastPageLink.match(/page=(\d+)/i);
      if (pageMatch) {
        const lastPage = parseInt(pageMatch[1], 10);
        if (lastPage > maxPage) {
          maxPage = lastPage;
        }
      }
    }
    
    const totalPages = maxPage;
    const isLast = currentPage >= totalPages;
    
    console.log(`[YOLO Japan] Page check: Current page ${currentPage} of ${totalPages} - ${isLast ? 'LAST PAGE' : 'More pages available'}`);
    
    return isLast;
  }


  /**
   * Build apartment URL for Yolo Japan
   * Yolo Japan uses the property ID in their URL structure
   */
  protected async buildApartmentUrl(externalId: string): Promise<string | null> {
    // Yolo Japan URL pattern: /properties/{id}
    return `${this.config.baseUrl}/properties/${externalId}`;
  }

  /**
   * Extract apartment ID from Yolo Japan URL
   * URL patterns:
   * - https://yolo-japan.com/properties/{id}
   * - https://yolo-japan.com/en/properties/{id}
   */
  protected async extractIdFromUrl(url: string): Promise<string | null> {
    try {
      const patterns = [
        /\/property\/(\d+)(?:\/|$)/,    // Updated: property (singular)
        /\/properties\/(\d+)(?:\/|$)/,  // Keep for backward compatibility
        /property_id=(\d+)/,
        /id=(\d+)/
      ];
      
      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }
      
      console.log(`[Yolo Japan] Could not extract ID from URL: ${url}`);
      return null;
    } catch (error) {
      console.error('[Yolo Japan] Error extracting ID from URL:', error);
      return null;
    }
  }

  /**
   * Get the next page URL if available
   * @param $ Cheerio instance of the current page
   * @param currentPageUrl The URL of the current page being scraped
   * @returns The next page URL or null if no next page exists
   */
  protected getNextPageUrl($: CheerioAPI, currentPageUrl: string): string | null {
    try {
      // Yolo Japan uses a pagination structure like:
      // <div class="pagination el-pagination is-background">
      //   <button type="button" disabled="disabled" class="btn-prev"><i class="el-icon el-icon-arrow-left"></i></button>
      //   <ul class="el-pager">
      //     <li class="number active">1</li>
      //     <li class="number">2</li>
      //     <li class="number">3</li>
      //   </ul>
      //   <button type="button" class="btn-next"><i class="el-icon el-icon-arrow-right"></i></button>
      // </div>
      
      // Check if the next button is disabled
      const isNextDisabled = $('.pagination .btn-next').attr('disabled') === 'disabled';
      
      if (isNextDisabled) {
        console.log('[Yolo Japan] Next button is disabled - no more pages');
        return null;
      }
      
      // Extract current page number from URL
      const urlMatch = currentPageUrl.match(/[?&]page=(\d+)/i);
      const currentPage = urlMatch ? parseInt(urlMatch[1], 10) : 1;
      
      // Build the next page URL
      const urlObj = new URL(currentPageUrl);
      urlObj.searchParams.set('page', (currentPage + 1).toString());
      const nextUrl = urlObj.toString();
      
      console.log(`[Yolo Japan] Found next page: ${nextUrl}`);
      return nextUrl;
      
    } catch (error) {
      console.error('[Yolo Japan] Error getting next page URL:', error);
      return null;
    }
  }
}