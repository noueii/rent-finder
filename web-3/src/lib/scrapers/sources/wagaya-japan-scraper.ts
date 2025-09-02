import type * as cheerio from 'cheerio';
import { WagayaBase } from '../providers/wagaya-base';
import type {
  ScrapedApartmentData,
  ScraperSearchParams,
  ScraperConfig,
} from '~/types/scraper';

/**
 * Wagaya Japan normal scraper implementation
 * Uses WagayaBase for parsing logic
 * Handles both search results and detail page scraping
 * 
 * This scraper extracts apartment data directly from search results pages,
 * avoiding the need to fetch individual detail pages. All essential data
 * (price, size, location, etc.) is available in the search results HTML.
 * 
 * Search URL: https://wagaya-japan.com/en/rent/tokyo/list/?upperprice=160000&heibeimin=25&room_kei=0&sort=0
 * Detail URL: https://wagaya-japan.com/en/chintai_detail.php?id=123456
 */
export class UnifiedWagayaJapanScraper extends WagayaBase {
  constructor(config?: Partial<ScraperConfig>) {
    const defaultConfig: ScraperConfig = {
      name: 'Wagaya Japan',
      baseUrl: 'https://wagaya-japan.com',
      rateLimit: 5000, // 5 seconds between requests for Wagaya
      maxRetries: 3,
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
    };
    
    super({ ...defaultConfig, ...config });
  }

  getName(): string {
    return 'Wagaya Japan Scraper';
  }

  /**
   * Override robots.txt check to handle Wagaya's specific robots.txt rules
   * Wagaya allows scraping of /en/ paths
   */
  protected async checkRobotsTxt(): Promise<boolean> {
    try {
      const robotsUrl = new URL('/robots.txt', this.config.baseUrl).toString();
      const response = await fetch(robotsUrl);
      
      if (!response.ok) {
        // If we can't fetch robots.txt, assume it's okay to scrape
        return true;
      }
      
      const robotsTxt = await response.text();
      
      // Check if our user agent or * is allowed to access /en/ paths
      const lines = robotsTxt.split('\n');
      let currentUserAgent = '';
      let isAllowed = false;
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (trimmedLine.startsWith('User-agent:')) {
          currentUserAgent = trimmedLine.split(':')[1]?.trim() || '';
        } else if (currentUserAgent === '*' && trimmedLine.startsWith('Allow: /en/')) {
          isAllowed = true;
          break;
        }
      }
      
      if (!isAllowed) {
        console.warn(`[${this.config.name}] /en/ path not explicitly allowed in robots.txt`);
      }
      
      return isAllowed;
    } catch (error) {
      console.error(`[${this.config.name}] Error checking robots.txt:`, error);
      return true; // Default to allowing if we can't check
    }
  }


  /**
   * Build search URLs based on search parameters
   */
  protected async buildSearchUrls(params: ScraperSearchParams): Promise<string[]> {
    const urls: string[] = [];
    
    // Base search parameters
    const searchParams = new URLSearchParams({
      sort: '0', // Default sort order
      room_kei: '0', // All room types
    });

    // Add price filters
    if (params.maxPrice) {
      searchParams.set('upperprice', params.maxPrice.toString());
    }
    if (params.minPrice) {
      searchParams.set('lowerprice', params.minPrice.toString());
    }

    // Add size filters (heibeimin = minimum area in m²)
    if (params.minSize) {
      searchParams.set('heibeimin', params.minSize.toString());
    }
    if (params.maxSize) {
      searchParams.set('heibeimax', params.maxSize.toString());
    }

    // Map layout types to room_kei values
    if (params.layouts && params.layouts.length > 0) {
      const roomTypeMap: Record<string, string> = {
        '1R': '1',
        '1K': '2',
        '1DK': '3',
        '1LDK': '4',
        '2K': '5',
        '2DK': '6',
        '2LDK': '7',
        '3K': '8',
        '3DK': '9',
        '3LDK': '10',
        '4LDK': '11',
      };
      
      // If specific layouts are selected, use the first one
      const firstLayout = params.layouts[0];
      if (firstLayout && roomTypeMap[firstLayout]) {
        searchParams.set('room_kei', roomTypeMap[firstLayout]);
      }
    }

    // Handle pagination - Wagaya uses 'page' parameter
    const startPage = params.page ?? 1;
    
    // Check if we should fetch all pages or have no limit
    if (params.fetchAll || !params.limit) {
      console.log('🔄 Dynamic pagination enabled - will retrieve pages until no more found');
      // Just return the first page URL, dynamic pagination will handle the rest
      const firstPageParams = new URLSearchParams(searchParams.toString());
      if (startPage > 1) {
        firstPageParams.set('page', startPage.toString());
      }
      urls.push(`${this.config.baseUrl}/en/rent/tokyo/list/?${firstPageParams.toString()}`);
    } else {
      // Only use limit if explicitly provided
      const limit = params.limit;
      const itemsPerPage = 20; // Wagaya shows ~20 items per page
      const pagesNeeded = Math.ceil(limit / itemsPerPage);
      
      for (let p = startPage; p < startPage + pagesNeeded; p++) {
        const pageParams = new URLSearchParams(searchParams.toString());
        if (p > 1) {
          pageParams.set('page', p.toString());
        }
        urls.push(`${this.config.baseUrl}/en/rent/tokyo/list/?${pageParams.toString()}`);
      }
    }
    
    console.log(`Generated ${urls.length} search URLs for Wagaya Japan`);
    if (params.fetchAll || !params.limit) {
      console.log(`Dynamic pagination enabled - will continue until no more pages found`);
    }
    return urls;
  }

  /**
   * Build search URLs for all pages when fetchAll is enabled
   */
  private async buildAllSearchUrls(searchParams: URLSearchParams, startPage: number = 1): Promise<string[]> {
    const urls: string[] = [];
    
    // First, fetch page 1 to determine total pages
    const firstPageParams = new URLSearchParams(searchParams.toString());
    if (startPage > 1) {
      firstPageParams.set('page', startPage.toString());
    }
    const firstPageUrl = `${this.config.baseUrl}/en/rent/tokyo/list/?${firstPageParams.toString()}`;
    
    console.log('[Wagaya Japan] Fetching first page to determine total pages...');
    const result = await this.fetchAndParse(firstPageUrl);
    
    if (!result.success || !result.data) {
      console.error('[Wagaya Japan] Failed to fetch first page for pagination info');
      return [firstPageUrl]; // Return at least the first page
    }
    
    const $ = result.data;
    
    // Extract total pages from pagination
    let totalPages = 1;
    
    // Look for pagination elements
    const paginationLinks = $('.paging a, .pagination a, .page_navi a');
    let maxPage = 1;
    
    paginationLinks.each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      const text = $el.text().trim();
      
      // Check href for page parameter
      if (href) {
        const pageMatch = href.match(/page=(\d+)/);
        if (pageMatch) {
          const pageNum = parseInt(pageMatch[1], 10);
          if (pageNum > maxPage) {
            maxPage = pageNum;
          }
        }
      }
      
      // Check text for page numbers
      const textMatch = text.match(/^\d+$/);
      if (textMatch) {
        const pageNum = parseInt(text, 10);
        if (pageNum > maxPage) {
          maxPage = pageNum;
        }
      }
    });
    
    totalPages = maxPage;
    
    // Generate URLs for all pages
    for (let page = startPage; page <= totalPages; page++) {
      const pageParams = new URLSearchParams(searchParams.toString());
      if (page > 1) {
        pageParams.set('page', page.toString());
      }
      urls.push(`${this.config.baseUrl}/en/rent/tokyo/list/?${pageParams.toString()}`);
    }
    
    console.log(`[Wagaya Japan] FetchAll mode: Found ${totalPages} total pages`);
    console.log(`[Wagaya Japan] Will fetch pages ${startPage} to ${totalPages}`);
    
    return urls;
  }

  /**
   * Scrape a search results page and return apartment data directly
   */
  protected async scrapeSearchPage(
    url: string,
    _params: ScraperSearchParams
  ): Promise<ScrapedApartmentData[]> {
    console.log(`Scraping Wagaya Japan search page: ${url}`);
    
    const result = await this.fetchAndParse(url);
    
    if (!result.success || !result.data) {
      console.error(`Failed to fetch search page: ${url}`, result.error);
      return [];
    }
    
    const $ = result.data;
    const apartments: ScrapedApartmentData[] = [];
    
    // First, try to extract data from the JavaScript variable if available
    const scriptContent = $('script').text();
    const estateDataMatch = scriptContent.match(/var\s+estateDataFromPHP\s*=\s*(\[[\s\S]*?\]);/);
    
    if (estateDataMatch) {
      console.log('Found estateDataFromPHP JavaScript variable, extracting data from it');
      try {
        const estateData = JSON.parse(estateDataMatch[1]);
        console.log(`Found ${estateData.length} properties in JavaScript data`);
        
        // Convert the JavaScript data to our format
        for (let i = 0; i < estateData.length; i++) {
          const item = estateData[i];
          const apartment = this.convertEstateDataToApartment(item);
          if (apartment) {
            apartments.push(apartment);
          }
        }
        
        if (apartments.length > 0) {
          console.log(`Successfully extracted ${apartments.length} apartments from JavaScript data`);
          // Return the JavaScript data - it's more complete than HTML
          return apartments;
        }
      } catch (error) {
        console.error('Failed to parse estateDataFromPHP:', error);
      }
    }
    
    // Fallback to HTML parsing only if no JavaScript data found
    console.log('No JavaScript data found, using HTML parsing approach');
    
    // Wagaya uses li.pro-search-item for each listing
    let $listings = $('li.pro-search-item');
    
    if ($listings.length === 0) {
      console.log('No listings found with li.pro-search-item selector');
      // Fallback: look for lists-fluid-item
      $listings = $('li.lists-fluid-item');
      if ($listings.length > 0) {
        console.log(`Found ${$listings.length} listings using fallback selector`);
      }
    }
    
    console.log(`Processing ${$listings.length} listings from search page`);
    
    $listings.each((index, element) => {
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
        
        // Ensure required fields
        if (!apartmentData.title || !apartmentData.price || !apartmentData.size) {
          console.warn(`Listing ${index + 1}: Missing required fields, skipping`);
          return;
        }
        
        apartments.push(apartmentData as ScrapedApartmentData);
        
      } catch (error) {
        console.error(`Error extracting data from listing ${index + 1}:`, error);
      }
    });
    
    console.log(`Successfully extracted ${apartments.length} apartments from search page`);
    return apartments;
  }

  /**
   * Get apartment details from detail page
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
      console.warn(`[Wagaya] Listing appears to be removed: ${url}`, removalCheck);
      
      // Update database to mark apartment as removed
      const externalId = await this.extractIdFromUrl(url);
      if (externalId) {
        try {
          const { ApartmentRemovalHandler } = await import('../utils/apartment-removal-handler');
          await ApartmentRemovalHandler.handleRemovalCheck(
            externalId,
            'wagaya-japan.com',
            removalCheck
          );
        } catch (error) {
          console.error('[Wagaya] Error updating removal status in database:', error);
        }
      }
      
      // Return a special marker object to indicate removal
      if (process.env.SCRAPER_TEST_MODE === 'true') {
        return {
          externalId: externalId || 'unknown',
          sourceUrl: url,
          sourceSite: 'wagaya-japan.com',
          _isRemoved: true,
          _removalReason: removalCheck.reason,
          _removalConfidence: removalCheck.confidence,
          _rawHtml: html,
          _httpResponse: htmlResult.metadata,
        } as any;
      }
      return null;
    }
    
    try {
      console.log(`Extracting apartment data from detail page: ${url}`);
      
      // Use base class parser to extract comprehensive apartment data
      const apartmentData = this.parseApartmentFromDetailPage($, url);
      
      // Mark as having fetched details
      apartmentData.fetchedDetails = true;
      
      // If we're in test mode, attach the raw HTML to the result
      if (process.env.SCRAPER_TEST_MODE === 'true') {
        (apartmentData as any)._rawHtml = html;
        (apartmentData as any)._httpResponse = htmlResult.metadata;
      }
      
      console.log(`Successfully extracted apartment: ${apartmentData.externalId}`);
      return apartmentData;
    } catch (error) {
      console.error('Error extracting apartment data:', error);
      return null;
    }
  }

  /**
   * Check if a Wagaya listing has been removed
   * Override the base implementation with Wagaya-specific logic
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
    
    // Wagaya-specific checks
    if (html) {
      const $ = await import('cheerio').then(c => c.load(html));
      
      // Check for Wagaya's specific "404 // The post has been removed" pattern
      // This appears inside .ttl > .full-btn structure
      const fullBtnText = $('.full-btn').text().trim();
      const ttlFullBtnText = $('.ttl .full-btn').text().trim();
      
      // Check both selectors for the removal pattern
      if ((fullBtnText.includes('404') && fullBtnText.includes('The post has been removed')) ||
          (ttlFullBtnText.includes('404') && ttlFullBtnText.includes('The post has been removed'))) {
        return {
          isRemoved: true,
          reason: '404 - The post has been removed',
          confidence: 'high'
        };
      }
      
      // Alternative check for just the 404 text in full-btn
      if (fullBtnText === '404' || fullBtnText.startsWith('404') ||
          ttlFullBtnText === '404' || ttlFullBtnText.startsWith('404')) {
        return {
          isRemoved: true,
          reason: 'Property removed - 404 in full-btn element',
          confidence: 'high'
        };
      }
      
      // Check for "property not found" in Japanese
      const bodyText = $('body').text();
      if (bodyText.includes('物件が見つかりません') || bodyText.includes('該当する物件がありません')) {
        return {
          isRemoved: true,
          reason: 'Japanese "property not found" message detected',
          confidence: 'high'
        };
      }
      
      // Check if redirected to search page
      if (httpResponse.redirected && httpResponse.finalUrl.includes('/search')) {
        return {
          isRemoved: true,
          reason: 'Redirected to search page',
          confidence: 'high'
        };
      }
      
      // Check for empty detail container
      const hasDetails = $('.detail-box, .property-detail, .bukken-detail, .detail__main, .detail-content').length > 0;
      const hasPropertyInfo = $('.property-info, .detail__title, .detail__info').length > 0;
      
      // Debug logging in test mode
      if (process.env.SCRAPER_TEST_MODE === 'true') {
        console.log('[Wagaya] Removal detection debug:', {
          url,
          statusCode: httpResponse.statusCode,
          redirected: httpResponse.redirected,
          finalUrl: httpResponse.finalUrl,
          fullBtnText: fullBtnText || '(not found)',
          ttlFullBtnText: ttlFullBtnText || '(not found)',
          hasDetails,
          hasPropertyInfo,
          htmlLength: html?.length || 0
        });
      }
      
      if (!hasDetails && !hasPropertyInfo && httpResponse.statusCode === 200) {
        return {
          isRemoved: true,
          reason: 'Property detail container missing - page exists but property removed',
          confidence: 'high'
        };
      }
    }
    
    return baseCheck;
  }

  /**
   * Check if we've reached the last page of results
   * @param $ Cheerio instance of the current page
   * @param currentPageUrl The URL of the current page being scraped
   * @returns true if this is the last page, false otherwise
   */
  protected isLastScrapePage($: cheerio.CheerioAPI, currentPageUrl: string): boolean {
    // First check if there are any listings on the page
    const listingCount = $('.bukken_list_box').length || 
                        $('a[href*="chintai_detail.php"]').length ||
                        $('.property-item').length;
    
    if (listingCount === 0) {
      console.log('[Wagaya Japan] No listings found on page - reached the end');
      return true;
    }
    
    // Extract current page number from URL
    const urlMatch = currentPageUrl.match(/[?&]page=(\d+)/i);
    const currentPage = urlMatch ? parseInt(urlMatch[1], 10) : 1;
    
    // Check for pagination elements
    const paginationLinks = $('.paging a, .pagination a, .page_navi a');
    let maxPage = currentPage;
    let hasNextLink = false;
    
    paginationLinks.each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      const text = $el.text().trim();
      
      // Check for next page link
      if (text === '>' || text === '»' || text.toLowerCase() === 'next' || text === '次へ') {
        if (href && !$el.hasClass('disabled') && !$el.parent().hasClass('disabled')) {
          hasNextLink = true;
        }
      }
      
      if (href) {
        const pageMatch = href.match(/[?&]page=(\d+)/i);
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
    
    // For Wagaya Japan, we can also check if the total results is mentioned
    const resultsText = $('.search_result_count').text() || $('.total_count').text();
    const totalMatch = resultsText.match(/(\d+)/);
    if (totalMatch) {
      const totalResults = parseInt(totalMatch[1], 10);
      const resultsPerPage = 20; // Wagaya typically shows 20 results per page
      const expectedMaxPage = Math.ceil(totalResults / resultsPerPage);
      
      if (currentPage >= expectedMaxPage) {
        console.log(`[Wagaya Japan] Reached last page based on total results: ${totalResults}`);
        return true;
      }
    }
    
    const isLast = (currentPage >= maxPage && !hasNextLink) || listingCount === 0;
    
    console.log(`[Wagaya Japan] Page ${currentPage}: Found ${listingCount} listings, Max page: ${maxPage}, Has next: ${hasNextLink} - ${isLast ? 'LAST PAGE' : 'More pages available'}`);
    
    return isLast;
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
      const apartmentData = this.parseApartmentFromDetailPage($ as any, url);
      
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
   * Build apartment URL for Wagaya Japan
   * Wagaya Japan uses a slug-based URL with the property ID
   */
  protected async buildApartmentUrl(externalId: string): Promise<string | null> {
    // Wagaya Japan URL pattern: /property/{property-slug}/{id}
    // Since we only have the ID, we'll use a generic slug
    return `${this.config.baseUrl}/property/apartment-${externalId}/${externalId}`;
  }

  /**
   * Extract apartment ID from Wagaya Japan URL
   * URL patterns:
   * - https://wagaya-japan.com/property/{property-slug}/{id}
   * - https://wagaya-japan.com/en/property/{property-slug}/{id}
   */
  protected async extractIdFromUrl(url: string): Promise<string | null> {
    try {
      const patterns = [
        /\/property\/[^\/]+\/(\d+)(?:\/|$)/,
        /property_id=(\d+)/,
        /id=(\d+)/
      ];
      
      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }
      
      console.log(`[Wagaya Japan] Could not extract ID from URL: ${url}`);
      return null;
    } catch (error) {
      console.error('[Wagaya Japan] Error extracting ID from URL:', error);
      return null;
    }
  }

  /**
   * Get the next page URL if available
   * @param $ Cheerio instance of the current page
   * @param currentPageUrl The URL of the current page being scraped
   * @returns The next page URL or null if no next page exists
   */
  protected getNextPageUrl($: cheerio.CheerioAPI, currentPageUrl: string): string | null {
    try {
      // Wagaya Japan uses a pagination structure like:
      // <ul class="pagination">
      //   <li class="page-item prev disabled"><a href="#" class="page-link">&lt;</a></li>
      //   <li class="page-item active"><a href="#" class="page-link">1</a></li>
      //   <li class="page-item"><a href="#" class="page-link">2</a></li>
      //   <li class="page-item next"><a href="#" class="page-link">&gt;</a></li>
      // </ul>
      
      // Extract current page number from URL
      const urlObj = new URL(currentPageUrl);
      const currentPage = parseInt(urlObj.searchParams.get('page') || '1');
      
      // Check if we have any listings on the current page
      // First check JavaScript data
      const scriptContent = $('script').text();
      const estateDataMatch = scriptContent.match(/var\s+estateDataFromPHP\s*=\s*(\[[\s\S]*?\]);/);
      
      let hasListings = false;
      
      if (estateDataMatch) {
        try {
          const estateData = JSON.parse(estateDataMatch[1]);
          hasListings = estateData.length > 0;
          console.log(`[Wagaya Japan] Page ${currentPage} has ${estateData.length} apartments in JavaScript data`);
        } catch (error) {
          console.error('[Wagaya Japan] Failed to parse estate data:', error);
        }
      }
      
      // If no JavaScript data, check HTML listings as fallback
      if (!hasListings) {
        const htmlListings = $('li.pro-search-item, li.lists-fluid-item').length;
        hasListings = htmlListings > 0;
        if (hasListings) {
          console.log(`[Wagaya Japan] Page ${currentPage} has ${htmlListings} apartments in HTML`);
        }
      }
      
      // If current page has listings, try the next page
      if (hasListings) {
        const nextPage = currentPage + 1;
        urlObj.searchParams.set('page', nextPage.toString());
        const nextUrl = urlObj.toString();
        console.log(`[Wagaya Japan] Found listings, checking page ${nextPage}`);
        return nextUrl;
      } else {
        console.log(`[Wagaya Japan] No listings found on page ${currentPage}, stopping pagination`);
        return null;
      }
      
    } catch (error) {
      console.error('[Wagaya Japan] Error getting next page URL:', error);
      return null;
    }
  }
}