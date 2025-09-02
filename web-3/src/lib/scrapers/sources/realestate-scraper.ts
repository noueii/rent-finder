import type { Root as CheerioAPI } from 'cheerio';
import { RealEstateBase } from '../providers/realestate-base';
import { parseJapaneseAddress } from '../utils/address-parser';
import type {
  ScrapedApartmentData,
  ScraperSearchParams,
  ScraperConfig,
} from '~/types/scraper';

/**
 * RealEstate.co.jp normal scraper implementation
 * Uses RealEstateBase for parsing logic
 * Handles both search results and detail page scraping
 * 
 * Search URL: https://realestate.co.jp/en/rent?prefecture=JP-13&city=13000&trainline=&district=&max_rent=160000&search=Search
 * Detail URL: https://realestate.co.jp/en/rent/view/1249374
 */
export class UnifiedRealEstateScraper extends RealEstateBase {
  private itemsPerPage = 15; // RealEstate.co.jp shows 15 items per page
  
  constructor(config?: Partial<ScraperConfig>) {
    const defaultConfig: ScraperConfig = {
      name: 'RealEstate.co.jp',
      baseUrl: 'https://realestate.co.jp',
      rateLimit: 300, // 0.3 seconds between requests (with proxies)
      maxRetries: 3,
      timeout: 30000,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en,ja;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Referer': 'https://realestate.co.jp/',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    };
    
    super({ ...defaultConfig, ...config });
  }

  getName(): string {
    return 'RealEstate.co.jp Scraper';
  }

  /**
   * Build search URLs based on search parameters
   */
  protected async buildSearchUrls(params: ScraperSearchParams): Promise<string[]> {
    // Base search URL for Tokyo (prefecture=JP-13)
    const searchParams = new URLSearchParams({
      prefecture: 'JP-13', // Tokyo
      city: '13000', // All Tokyo
      trainline: '',
      district: '',
      search: 'Search',
      order: 'date_entered_ranking-desc', // Sort by newest entries first
    });

    // Add price filters
    if (params.maxPrice) {
      searchParams.set('max_rent', params.maxPrice.toString());
    }
    if (params.minPrice) {
      searchParams.set('min_rent', params.minPrice.toString());
    }

    // Add size filters (if supported by the site)
    if (params.minSize) {
      searchParams.set('min_area', params.minSize.toString());
    }
    if (params.maxSize) {
      searchParams.set('max_area', params.maxSize.toString());
    }

    // TODO: Map layout types to site-specific values
    // TODO: Map station names to site-specific values

    const baseUrl = `${this.config.baseUrl}/en/rent?${searchParams.toString()}`;
    
    // Check if we should use dynamic pagination
    if (params.fetchAll || !params.limit) {
      console.log('🔄 Dynamic pagination enabled - will retrieve pages until no more found');
      return [`${baseUrl}&page=1`];
    }
    
    // If limit is specified, calculate pages needed
    const limit = params.limit;
    const pagesNeeded = Math.ceil(limit / this.itemsPerPage);
    const urls: string[] = [];
    
    for (let page = 1; page <= pagesNeeded; page++) {
      urls.push(`${baseUrl}&page=${page}`);
    }
    
    console.log(`Generated ${urls.length} search URLs for RealEstate.co.jp`);
    return urls;
  }

  /**
   * Extract total apartment count from search results page
   */
  private extractTotalCount($: CheerioAPI): number | null {
    console.log('[RealEstate] Extracting total count from page...');
    try {
      // RealEstate.co.jp specific selectors
      // Look for pagination info or result count
      const selectors = [
        '.pagination-info',
        '.search-results-count',
        '.result-count',
        '.total-results',
        'h2:contains("Properties")',
        'h3:contains("Properties")',
        '.property-count',
        '.results-summary',
      ];
      
      // First, try to find direct count displays
      for (const selector of selectors) {
        const elements = $(selector);
        elements.each((_, el) => {
          const text = $(el).text();
          console.log(`Checking text for count: "${text.trim()}"`);
          
          // Look for patterns like:
          // "234 Properties found"
          // "Showing 1-15 of 234 results"
          // "234 results"
          const patterns = [
            /(\d+)\s+(?:Properties|properties|results?|apartments?)/i,
            /of\s+(\d+)\s+(?:results?|properties|apartments?)/i,
            /(\d+)\s+total/i,
            /total:\s*(\d+)/i,
          ];
          
          for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
              const total = parseInt(match[1]);
              console.log(`Found total count: ${total} apartments`);
              return total;
            }
          }
        });
      }
      
      // Alternative: Check pagination to infer total
      // Look for the last page number
      const lastPageLink = $('.pagination a:last-child, .page-numbers a:last-child').last();
      const lastPageHref = lastPageLink.attr('href');
      if (lastPageHref) {
        const pageMatch = lastPageHref.match(/page=(\d+)/);
        if (pageMatch && pageMatch[1]) {
          const lastPage = parseInt(pageMatch[1]);
          // Estimate total based on last page (assuming 15 per page)
          const estimatedTotal = lastPage * this.itemsPerPage;
          console.log(`Estimated total from pagination: ${estimatedTotal} apartments (${lastPage} pages)`);
          return estimatedTotal;
        }
      }
      
      // If no total found, return null
      console.log('[RealEstate] Could not extract total apartment count from page');
      return null;
    } catch (error) {
      console.error('Error extracting total count:', error);
      return null;
    }
  }

  /**
   * Build search URLs for all pages based on total count
   */
  async buildAllSearchUrls(baseSearchUrl: string): Promise<string[]> {
    const urls: string[] = [];
    let currentPage = 1;
    let hasMorePages = true;
    
    console.log(`\n📊 DYNAMIC PAGINATION - Checking for next page button`);
    
    while (hasMorePages) {
      const currentUrl = `${baseSearchUrl}&page=${currentPage}`;
      
      // Only add the URL if we haven't checked this page yet
      urls.push(currentUrl);
      
      // Fetch the page to check if there's a next button
      console.log(`Checking page ${currentPage} for next button...`);
      const result = await this.fetchAndParse(currentUrl);
      
      if (!result.success || !result.data) {
        console.error(`Failed to fetch page ${currentPage}, stopping pagination`);
        break;
      }
      
      const $ = result.data;
      
      // Extract total count on first page
      if (currentPage === 1) {
        const totalCount = this.extractTotalCount($);
        if (totalCount > 0) {
          console.log(`- Total apartments found: ${totalCount}`);
        }
      }
      
      // Check if this is the last page using our existing method
      const isLastPage = this.isLastScrapePage($, currentUrl);
      
      if (isLastPage) {
        console.log(`✅ Page ${currentPage} is the last page - no more pages to fetch`);
        hasMorePages = false;
      } else {
        console.log(`➡️ Page ${currentPage} has a next button - will fetch page ${currentPage + 1}`);
        currentPage++;
      }
      
      // Safety limit to prevent infinite loops
      if (currentPage > 100) {
        console.warn('⚠️ Reached safety limit of 100 pages, stopping');
        break;
      }
    }
    
    console.log(`\n📋 PAGINATION COMPLETE:`);
    console.log(`- Total pages to scrape: ${urls.length}`);
    console.log(`- URLs:`, urls);
    
    return urls;
  }

  /**
   * Override to extract apartments directly from search results page
   */
  protected async scrapeSearchPage(
    url: string,
    params: ScraperSearchParams
  ): Promise<ScrapedApartmentData[]> {
    console.log(`\n\n========== REALESTATE SEARCH PAGE SCRAPE ==========`);
    console.log(`URL: ${url}`);
    console.log(`Method: scrapeSearchPage (returns ScrapedApartmentData[])`);
    console.log(`=================================================\n`);
    
    const result = await this.fetchAndParse(url);
    
    if (!result.success || !result.data) {
      console.error(`Failed to fetch search page: ${url}`, result.error);
      return [];
    }
    
    const $ = result.data;
    const apartments: ScrapedApartmentData[] = [];
    
    // Find all property listings on the page
    const propertyListings = $('.property-listing');
    console.log(`Found ${propertyListings.length} property listings on page`);
    
    propertyListings.each((_, element) => {
      try {
        const $item = $(element);
        
        // Use base class parser to extract apartment data
        const apartmentData = this.parseListingFromSearchPage($, $item);
        
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
        
        // Extract basic station info
        apartmentData.nearestStations = this.parseBasicStationInfoFromSearchPage($item);
        
        // Parse address components from location
        const addressComponents = parseJapaneseAddress(apartmentData.address || '');
        apartmentData.area = addressComponents.area;
        apartmentData.ward = addressComponents.ward;
        apartmentData.city = addressComponents.city;
        apartmentData.prefecture = addressComponents.prefecture;
        
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
        console.error('Error extracting listing:', error);
      }
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
      console.warn(`[RealEstate] Listing appears to be removed: ${url}`, removalCheck);
      
      // Update database to mark apartment as removed
      const externalId = this.extractExternalId(url);
      if (externalId) {
        try {
          const { ApartmentRemovalHandler } = await import('../utils/apartment-removal-handler');
          await ApartmentRemovalHandler.handleRemovalCheck(
            externalId,
            'realestate.co.jp',
            removalCheck
          );
        } catch (error) {
          console.error('[RealEstate] Error updating removal status in database:', error);
        }
      }
      
      // Return a special marker object to indicate removal
      if (process.env.SCRAPER_TEST_MODE === 'true') {
        return {
          externalId: externalId || 'unknown',
          sourceUrl: url,
          sourceSite: 'realestate.co.jp',
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
  
  /**
   * Extract apartment data from a detail page
   */
  protected async extractApartmentData(
    $: CheerioAPI,
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
   * Check if a RealEstate listing has been removed
   * RealEstate.co.jp returns 404 status code for removed listings
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
    // RealEstate.co.jp ONLY returns 404 for removed listings
    if (httpResponse.statusCode === 404) {
      return {
        isRemoved: true,
        reason: 'HTTP 404 - Property not found',
        confidence: 'high'
      };
    }
    
    // Not removed - RealEstate keeps the page up even if data is incomplete
    return {
      isRemoved: false,
      confidence: 'high'
    };
  }

  /**
   * Extract external ID from URL
   */
  private extractExternalId(url: string): string | null {
    // URL pattern: https://realestate.co.jp/en/rent/view/1249374
    const match = url.match(/\/view\/(\d+)/);
    if (match && match[1]) {
      return match[1];
    }
    
    // Fallback: use URL hash
    const { createHash } = require('crypto');
    return createHash('md5').update(url).digest('hex').substring(0, 12);
  }

  /**
   * Parse station information from text
   */
  private parseStationInfo(text: string): ScrapedApartmentData['nearestStations'][0] | null {
    const cleanedText = this.cleanText(text);
    if (!cleanedText) return null;
    
    // Look for station name
    const stationMatch = cleanedText.match(/([^\s]+\s*Station|[^\s]+駅)/i);
    if (!stationMatch) return null;
    
    const stationName = stationMatch[1];
    
    // Extract walking minutes
    const walkingMinutes = this.parseWalkingMinutes(cleanedText) || 99;
    
    // Extract train lines if mentioned
    const lines: string[] = [];
    const lineMatch = cleanedText.match(/([^\s]+\s*Line|[^\s]+線)/i);
    if (lineMatch) {
      lines.push(lineMatch[1]);
    }
    
    return {
      name: stationName,
      walkingMinutes,
      lines: lines.length > 0 ? lines : undefined,
    };
  }

  /**
   * Check if we've reached the last page of results
   * @param $ Cheerio instance of the current page
   * @param currentPageUrl The URL of the current page being scraped
   * @returns true if this is the last page, false otherwise
   */
  protected isLastScrapePage($: CheerioAPI, currentPageUrl: string): boolean {
    // Extract current page number from URL
    const urlMatch = currentPageUrl.match(/[?&]page=(\d+)/i);
    const currentPage = urlMatch ? parseInt(urlMatch[1], 10) : 1;
    
    // RealEstate.co.jp uses a specific paginator structure
    // Check if "next" button exists and is not invisible/disabled
    const nextButton = $('.paginator .pagination-next');
    const hasNextLink = nextButton.find('a[href]').length > 0;
    const isNextInvisible = nextButton.hasClass('invisible');
    
    // Also check the last page link to get total pages
    const lastPageLink = $('.paginator .pagination-last a').attr('href');
    let totalPages = currentPage;
    
    if (lastPageLink) {
      const lastPageMatch = lastPageLink.match(/[?&]page=(\d+)/i);
      if (lastPageMatch) {
        totalPages = parseInt(lastPageMatch[1], 10);
      }
    }
    
    // Extract result count from paginator text (e.g., "1 - 15 of 16637")
    const paginatorText = $('.paginator').text();
    const countMatch = paginatorText.match(/\d+\s*-\s*\d+\s*of\s*(\d+)/i);
    let totalResults = 0;
    
    if (countMatch) {
      totalResults = parseInt(countMatch[1], 10);
      console.log(`[RealEstate] Found ${totalResults} total results`);
    }
    
    // We're on the last page if:
    // 1. Next button is invisible/disabled
    // 2. Current page >= total pages
    // 3. No next link exists
    const isLast = isNextInvisible || !hasNextLink || currentPage >= totalPages;
    
    console.log(`[RealEstate] Page check: Current page ${currentPage} of ${totalPages}, Total results: ${totalResults}, Has next: ${hasNextLink && !isNextInvisible} - ${isLast ? 'LAST PAGE' : 'More pages available'}`);
    
    return isLast;
  }

  /**
   * Get the next page URL if available
   * @param $ Cheerio instance of the current page
   * @param currentPageUrl The URL of the current page being scraped
   * @returns The next page URL or null if no next page exists
   */
  protected getNextPageUrl($: CheerioAPI, currentPageUrl: string): string | null {
    try {
      // RealEstate.co.jp uses pagination with next button
      // Look for the next page link in the paginator
      const nextLink = $('.paginator .pagination-next a').attr('href');
      
      if (nextLink) {
        // Convert relative URL to absolute if needed
        const nextUrl = new URL(nextLink, this.config.baseUrl).toString();
        console.log(`[RealEstate] Found next page: ${nextUrl}`);
        return nextUrl;
      }
      
      console.log('[RealEstate] No next page link found');
      return null;
    } catch (error) {
      console.error('[RealEstate] Error getting next page URL:', error);
      return null;
    }
  }

  /**
   * Build apartment URL for RealEstate
   * RealEstate uses the property ID in their URL structure
   */
  protected async buildApartmentUrl(externalId: string): Promise<string | null> {
    // RealEstate URL pattern: /rentals/{id}
    return `${this.config.baseUrl}/rentals/${externalId}`;
  }

  /**
   * Extract apartment ID from RealEstate URL
   * URL patterns:
   * - https://realestate.co.jp/rentals/{id}
   * - https://realestate.co.jp/en/rentals/{id}
   */
  protected async extractIdFromUrl(url: string): Promise<string | null> {
    try {
      // URL pattern: https://realestate.co.jp/en/rent/view/1249374
      const match = url.match(/\/view\/(\d+)/);
      if (match && match[1]) {
        return match[1];
      }
      
      console.log(`[RealEstate] Could not extract ID from URL: ${url}`);
      return null;
    } catch (error) {
      console.error('[RealEstate] Error extracting ID from URL:', error);
      return null;
    }
  }
}