/**
 * Unified RealEstate.co.jp Scraper
 * Combines functionality from both RealEstateScraper and FastRealEstateScraper
 * Uses the unified architecture with strategy pattern
 */

import { BaseScraper } from '../base/unified-scraper';
import type { ScraperConfig, ScrapeParams, BaseApartment, StationInfo, ScraperSelectors } from '../base/unified-scraper';
import { RealEstateBase } from '../../../lib/scrapers/providers/realestate-base';
import { parseJapaneseAddress } from '../../../lib/scrapers/utils/address-parser';
import type { Root as CheerioAPI } from 'cheerio';

// RealEstate-specific apartment data
export interface RealEstateApartment extends BaseApartment {
  area?: string;
  ward?: string;
  city?: string;
  prefecture?: string;
  fetchedDetails?: boolean;
}

/**
 * Unified RealEstate Scraper
 */
export class UnifiedRealEstateScraper extends BaseScraper<RealEstateApartment> {
  private parser: RealEstateBase;
  private itemsPerPage = 15;
  
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
        proxy: false // Disable proxy by default since DISABLE_SCRAPERS_PROXY is true
      },
      overrides: {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9,ja;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'max-age=0',
          'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"macOS"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
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
        requests: 20,
        perSeconds: 1,
        burst: 10
      };
      defaultConfig.concurrency = 30;
      defaultConfig.requestTimeout = 10000;
      defaultConfig.maxRetries = 2;
    }
    
    super({ ...defaultConfig, ...config });
    
    // Create parser instance for parsing logic
    this.parser = new RealEstateParserHelper({
      name: 'RealEstateParser',
      baseUrl: 'https://realestate.co.jp',
      rateLimit: 1000,
      maxRetries: 3,
      timeout: 30000
    });
  }
  
  protected getScraperName(): string {
    return 'UnifiedRealEstate';
  }
  
  protected getSelectors(): ScraperSelectors {
    return {
      title: '.property-name',
      rent: '.price-value',
      size: '.size-value',
      layout: '.layout-value',
      buildingType: '.building-type',
      age: '.building-age',
      floor: '.floor-info',
      address: '.property-address',
      station: '.station-info',
      management: '.management-fee',
      deposit: '.deposit-amount',
      keyMoney: '.key-money'
    };
  }
  
  protected async buildUrls(params: ScrapeParams): Promise<string[]> {
    // Base search URL for Tokyo (prefecture=JP-13)
    console.log('[RealEstate] Building URL with full params:', {
      priceRange: params.priceRange,
      sizeRange: params.sizeRange,
      updatedWithin: params.updatedWithin,
      limit: params.limit
    });
    
    const searchParams = new URLSearchParams({
      prefecture: 'JP-13', // Tokyo
      city: params.city || '13000', // All Tokyo
      trainline: params.trainLines?.join(',') || '',
      district: '',
      search: 'Search',
      order: 'date_entered_ranking-desc', // Sort by newest entries first
    });

    // Add price filters - RealEstate.co.jp uses min_price and max_price
    if (params.priceRange) {
      if (params.priceRange.max) {
        searchParams.set('max_price', params.priceRange.max.toString());
      }
      if (params.priceRange.min) {
        searchParams.set('min_price', params.priceRange.min.toString());
      }
    }

    // Add size filters - RealEstate.co.jp uses min_meter and max_meter
    if (params.sizeRange) {
      if (params.sizeRange.min) {
        searchParams.set('min_meter', params.sizeRange.min.toString());
      }
      if (params.sizeRange.max) {
        searchParams.set('max_meter', params.sizeRange.max.toString());
      }
    }

    // Add updated within filter (14 or 30 days)
    console.log('[RealEstate] Checking updatedWithin:', params.updatedWithin);
    if (params.updatedWithin) {
      // RealEstate.co.jp uses 'updated_within' parameter
      searchParams.set('updated_within', params.updatedWithin.toString());
      console.log('[RealEstate] Added updated_within parameter:', params.updatedWithin);
    } else {
      console.log('[RealEstate] No updatedWithin parameter provided');
    }

    const baseUrl = `https://realestate.co.jp/en/rent?${searchParams.toString()}`;
    
    // Start from specified page or page 1
    const startPage = params.page || 1;
    const finalUrl = `${baseUrl}&page=${startPage}`;
    
    console.log('[RealEstate] Built search URL:', finalUrl);
    console.log('[RealEstate] Updated within days:', params.updatedWithin);
    console.log('[RealEstate] Full search params:', searchParams.toString());
    
    return [finalUrl];
  }
  
  protected extractListingUrls(html: string): string[] {
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);
    const urls: string[] = [];
    
    // Extract apartment URLs from search results
    $('.property-listing').each((_: number, element: any) => {
      const $item = $(element);
      const detailLink = $item.find('.property-name-link').attr('href') ||
                        $item.find('a[href*="/rent/view/"]').attr('href');
      
      if (detailLink) {
        const fullUrl = new URL(detailLink, 'https://realestate.co.jp').toString();
        urls.push(fullUrl);
      }
    });
    
    // Next page URLs will be discovered during the executeStrategy phase
    
    return urls;
  }
  
  protected extractApartmentData(html: string, url: string): RealEstateApartment {
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);
    
    // Check if this is a search page or detail page
    const isSearchPage = url.includes('/rent?') || url.includes('search=Search');
    
    if (isSearchPage) {
      // This is a search results page, extract listings
      const apartments: RealEstateApartment[] = [];
      
      $('.property-listing').each((_: number, element: any) => {
        try {
          const $item = $(element);
          const apartmentData = this.parseListingFromSearchPage($, $item);
          apartments.push(apartmentData);
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
  
  private parseListingFromSearchPage($: CheerioAPI, $item: any): RealEstateApartment {
    // Always use direct parsing for now since the base parser seems to have issues
    return this.parseListingDirectly($, $item);
  }
  
  // Fallback method to parse listing directly from HTML
  private parseListingDirectly($: CheerioAPI, $item: any): RealEstateApartment {
    
    // Extract URL - RealEstate.co.jp uses specific structure
    const link = $item.find('a[href*="/rent/view/"]').first().attr('href') || 
                 $item.find('.listing-title a').attr('href') ||
                 $item.find('.listing-body a').first().attr('href') ||
                 $item.find('a').first().attr('href');
    const url = link ? new URL(link, 'https://realestate.co.jp').toString() : '';
    
    // Extract title from the listing-title div structure
    let title = '';
    const listingTitle = $item.find('.listing-title');
    if (listingTitle.length > 0) {
      const titleType = listingTitle.find('.text-semi-strong').text().trim();
      const location = listingTitle.find('span').not('.text-semi-strong').text().trim();
      title = `${titleType} ${location}`.trim();
    }
    
    if (!title) {
      // Fallback title extraction
      title = $item.find('h3').text().trim() ||
              $item.find('.listing-item').first().text().trim() ||
              $item.find('a').first().text().trim() ||
              'Unknown Property';
    }
    
    // Extract price from "Monthly Costs" section
    let rent = 0;
    const priceItem = $item.find('.listing-item:contains("Monthly Costs")');
    if (priceItem.length > 0) {
      const priceText = priceItem.text();
      rent = this.parsePrice(priceText);
    } else {
      // Fallback price extraction
      const priceText = $item.find('[class*="price"]').text().trim() ||
                        $item.text().match(/¥[\d,]+/)?.[0] || '';
      rent = this.parsePrice(priceText);
    }
    
    // Extract size from "Size" section
    let size = 25;
    const sizeItem = $item.find('.listing-item:contains("Size")');
    if (sizeItem.length > 0) {
      const sizeText = sizeItem.text();
      const sizeMatch = sizeText.match(/([\d.]+)\s*m²/);
      if (sizeMatch) {
        size = parseFloat(sizeMatch[1]);
      }
    }
    
    // Extract layout (often in the title)
    const layoutMatch = title.match(/\b(\d+[LDK]+|1R|Studio)\b/i);
    const layout = layoutMatch ? layoutMatch[1] : '1K';
    
    // Extract address - often in the title after "in"
    let address = 'Tokyo';
    const addressMatch = title.match(/in\s+(.+)/i);
    if (addressMatch) {
      address = addressMatch[1];
    }
    
    // Extract image
    const imgSrc = $item.find('.listing-image').attr('src') || 
                   $item.find('img').first().attr('src') || 
                   $item.find('img').first().attr('data-src');
    const images = imgSrc ? [imgSrc] : [];
    
    // Extract agent
    const agent = this.extractAgentFromSearchListing($item) || 'RealEstate.co.jp';
    
    // Parse address components
    const addressComponents = parseJapaneseAddress(address);
    
    // Extract ID from URL consistently
    let apartmentId = this.generateId($);
    if (url) {
      const idMatch = url.match(/\/view\/(\d+)/);
      if (idMatch) {
        apartmentId = idMatch[1];
        console.log(`[RealEstate] Extracted ID ${apartmentId} from URL ${url}`);
      } else {
        // Fallback to last part of URL if pattern doesn't match
        apartmentId = url.split('/').pop() || this.generateId($);
        console.log(`[RealEstate] Using fallback ID extraction: ${apartmentId} from URL ${url}`);
      }
    }
    
    const apartment: RealEstateApartment = {
      id: apartmentId,
      url,
      title,
      rent,
      size,
      layout,
      buildingType: 'Apartment',
      age: 0,
      floor: '',
      address,
      station: {
        name: 'Unknown Station',
        line: 'Unknown Line',
        walkTime: 99
      },
      images,
      features: [],
      agent,
      scrapedAt: new Date(),
      source: 'realestate.co.jp',
      area: addressComponents.area,
      ward: addressComponents.ward,
      city: addressComponents.city,
      prefecture: addressComponents.prefecture
    };
    
    return apartment;
  }
  
  private parsePrice(text: string): number {
    if (!text) return 0;
    
    // Check for yen symbol and extract number
    const yenMatch = text.match(/¥\s*([\d,]+)/);
    if (yenMatch) {
      // Already in yen, just remove commas
      return parseInt(yenMatch[1].replace(/,/g, '')) || 0;
    }
    
    // Check for 万円 (man-en = 10,000 yen)
    const manMatch = text.match(/([\d,.]+)\s*万/);
    if (manMatch) {
      const value = parseFloat(manMatch[1].replace(/,/g, ''));
      return Math.round(value * 10000); // Convert from 万円 to yen
    }
    
    // Fallback: try to extract any number
    const match = text.match(/[\d,]+/);
    if (match) {
      const value = parseInt(match[0].replace(/,/g, ''));
      // If the number is small (< 1000), assume it's in 万円
      if (value < 1000) {
        return value * 10000;
      }
      return value || 0;
    }
    
    return 0;
  }
  
  private parseSize(text: string): number {
    const match = text.match(/[\d.]+/);
    if (match) {
      return parseFloat(match[0]);
    }
    return 25;
  }
  
  private parseDetailPage($: CheerioAPI, url: string): RealEstateApartment {
    // Use base class parser to extract comprehensive apartment data
    const apartmentData = this.parser.parseApartmentFromDetailPage($, url);
    
    // Parse address components
    const addressComponents = parseJapaneseAddress(apartmentData.address || '');
    
    // Extract ID from URL to ensure consistency
    const urlMatch = url.match(/\/view\/(\d+)/);
    const extractedId = urlMatch ? urlMatch[1] : (apartmentData.externalId || this.generateId($));
    
    // Convert to our apartment format
    const apartment: RealEstateApartment = {
      id: extractedId,
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
      agent: this.extractAgentFromDetailPage($) || 'RealEstate.co.jp',
      scrapedAt: new Date(),
      source: 'realestate.co.jp',
      area: addressComponents.area,
      ward: addressComponents.ward,
      city: addressComponents.city,
      prefecture: addressComponents.prefecture,
      fetchedDetails: true
    };
    
    return apartment;
  }
  
  private extractAgentFromSearchListing($item: any): string | null {
    try {
      // Based on the HTML structure provided:
      // The agent name is in .listing-logo small tag
      const agentText = $item.find('.listing-logo small').text().trim();
      if (agentText) {
        return agentText;
      }
      
      // Alternative selector if structure varies
      const altAgentText = $item.find('.listing-logo .text-xsmall').text().trim();
      if (altAgentText) {
        return altAgentText;
      }
      
      return null;
    } catch (error) {
      this.logger.debug('Could not extract agent from search listing', { error });
      return null;
    }
  }
  
  private extractAgentFromDetailPage($: CheerioAPI): string | null {
    try {
      // Based on actual HTML structure from debug files:
      // The agent name is in h3.text-base tag
      const agentText = $('h3.text-base a').text().trim();
      if (agentText) {
        return agentText;
      }
      
      // Fallback: sometimes it's just in the h3 without a link
      const h3Text = $('h3.text-base').text().trim();
      if (h3Text) {
        return h3Text;
      }
      
      // Additional fallback selectors based on variations
      const agentSelectors = [
        '.property-agent-name',
        '.listing-agent',
        '.agency-info .name',
        '.contact-agent-name',
        '.real-estate-agency'
      ];
      
      for (const selector of agentSelectors) {
        const text = $(selector).text().trim();
        if (text) {
          return text;
        }
      }
      
      return null;
    } catch (error) {
      this.logger.debug('Could not extract agent information from detail page', { error });
      return null;
    }
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
      // RealEstate.co.jp uses pagination with next button
      const nextLink = $('.paginator .pagination-next a').attr('href');
      
      if (nextLink) {
        // Convert relative URL to absolute if needed
        const nextUrl = new URL(nextLink, 'https://realestate.co.jp').toString();
        return nextUrl;
      }
      
      return null;
    } catch (error) {
      this.logger.error('Error getting next page URL:', error);
      return null;
    }
  }
  
  // Store params for access in executeStrategy
  private currentParams?: ScrapeParams;

  // Override scrape to store params
  async scrape(params: ScrapeParams): Promise<ScraperResult<RealEstateApartment>> {
    this.currentParams = params;
    // Reset progress tracker for each new scrape
    this.progressTracker.reset();
    return super.scrape(params);
  }
  

  // Override executeStrategy to handle search pages differently
  protected async executeStrategy(urls: string[]): Promise<RealEstateApartment[]> {
    const allApartments: RealEstateApartment[] = [];
    const processedUrls = new Set<string>();
    const urlQueue = [...urls];
    
    // Determine if we're in fetchAll mode by checking if limit is very high or undefined
    const isFetchAll = !this.currentParams?.limit || this.currentParams.limit > 100;
    const targetLimit = isFetchAll ? 999999 : (this.currentParams?.limit || 10);
    const maxPages = isFetchAll ? 100 : Math.min(Math.ceil(targetLimit / 15), 3); // Allow up to 100 pages in fetchAll mode
    let pagesProcessed = 0;
    
    console.log('[RealEstate] Starting executeStrategy with URLs:', urls);
    console.log('[RealEstate] Mode:', isFetchAll ? 'Fetch All' : 'Limited');
    console.log('[RealEstate] Target limit:', targetLimit, 'Max pages:', maxPages);
    console.log('[RealEstate] Updated within filter:', this.currentParams?.updatedWithin || 'None');
    
    // Ensure we start from page 1 if no page specified
    if (urls.length > 0 && !urls[0].includes('page=')) {
      urls[0] = urls[0] + '&page=1';
    }
    
    while (urlQueue.length > 0 && pagesProcessed < maxPages && allApartments.length < targetLimit) {
      const currentUrl = urlQueue.shift()!;
      
      if (processedUrls.has(currentUrl)) {
        console.log('[RealEstate] Skipping already processed URL:', currentUrl);
        continue;
      }
      processedUrls.add(currentUrl);
      pagesProcessed++;
      
      console.log(`[RealEstate] Processing page ${pagesProcessed}/${maxPages}: ${currentUrl}`);
      
      try {
        console.log('[RealEstate] Fetching URL:', currentUrl);
        const fetchStart = Date.now();
        const html = await this.fetchWithRetry(currentUrl);
        const fetchTime = Date.now() - fetchStart;
        console.log(`[RealEstate] Fetch completed in ${fetchTime}ms, HTML length: ${html?.length || 0}`);
        
        if (!html || html.length === 0) {
          console.error('[RealEstate] Empty HTML response, skipping');
          continue;
        }
        
        const cheerio = require('cheerio');
        const $ = cheerio.load(html);
        
        // Check if this is a search page
        if (currentUrl.includes('/rent?') || currentUrl.includes('search=Search')) {
          console.log('[RealEstate] Processing search results page');
          
          // Save HTML for debugging (only in test mode)
          if (process.env.SCRAPER_TEST_MODE === 'true') {
            const fs = require('fs').promises;
            const path = require('path');
            const debugDir = path.join(process.cwd(), 'debug', 'scraper-tests', 'realestate');
            await fs.mkdir(debugDir, { recursive: true });
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            // Include filter info in filename if present
            const filterInfo = this.currentParams?.updatedWithin ? `-updated${this.currentParams.updatedWithin}` : '';
            const filename = `search-page-${timestamp}${filterInfo}.html`;
            await fs.writeFile(path.join(debugDir, filename), html);
            console.log(`[RealEstate] Saved debug HTML to ${filename}`);
            
            // Also save the URL for reference
            const urlFilename = `search-url-${timestamp}${filterInfo}.txt`;
            await fs.writeFile(path.join(debugDir, urlFilename), currentUrl);
          }
          
          // Count listings on this page - check both possible selectors
          let listings = $('.property-listing');
          console.log(`[RealEstate] Found ${listings.length} listings with .property-listing selector`);
          
          // Also check within the container
          if (listings.length === 0) {
            const container = $('.rej-property-list');
            if (container.length > 0) {
              console.log('[RealEstate] Found .rej-property-list container');
              listings = container.find('.property-listing');
              console.log(`[RealEstate] Found ${listings.length} listings within container`);
            }
          }
          
          if (listings.length === 0) {
            console.log('[RealEstate] No listings found, checking for alternate selectors...');
            
            // Check for "no results" message
            const noResults = $('.no-results, .empty-results, .search-no-results, .no-properties-found').text().trim();
            if (noResults) {
              console.log('[RealEstate] No results message:', noResults);
            }
            
            // Try alternate selectors - more comprehensive list
            const altSelectors = [
              // RealEstate.co.jp specific patterns first
              '.rej-property-list > .property-listing',
              '.rej-property-list > div.property-listing',
              '.rej-property-list div.property-listing',
              '.property-item',
              '.listing-item', 
              '.search-result-item',
              '[class*="property"]',
              '.rej-property-list > div',
              '.property-list-item',
              '.rental-property',
              '.apartment-listing',
              'article.property',
              'div[data-property-id]',
              '.result-item',
              '.search-result',
              '.property-card',
              '.listing-card',
              'div.listing',
              'div.property'
            ];
            
            // Also check if there's a different container
            const containerSelectors = [
              '.property-list',
              '.listing-results',
              '.search-results',
              '#property-results',
              '.results-container'
            ];
            
            // First try to find listings in containers
            for (const containerSelector of containerSelectors) {
              const container = $(containerSelector);
              if (container.length > 0) {
                console.log(`[RealEstate] Found container: ${containerSelector}`);
                const containerListings = container.find('> div, > article, > li');
                if (containerListings.length > 0) {
                  console.log(`[RealEstate] Found ${containerListings.length} listings in container`);
                  containerListings.each((index: number, element: any) => {
                    if (allApartments.length >= targetLimit) {
                      return false;
                    }
                    
                    try {
                      const $item = $(element);
                      const apartment = this.parseListingFromSearchPage($, $item);
                      if (apartment && apartment.url) {
                        allApartments.push(apartment);
                      }
                    } catch (error) {
                      this.logger.debug('Error parsing listing from container', { error, containerSelector });
                    }
                  });
                  if (allApartments.length > 0) break;
                }
              }
            }
            
            // If still no results, try alternate selectors
            if (allApartments.length === 0) {
              for (const selector of altSelectors) {
                const altListings = $(selector);
                if (altListings.length > 0) {
                  console.log(`[RealEstate] Found ${altListings.length} listings with alternate selector: ${selector}`);
                  // Use these listings instead
                  altListings.each((index: number, element: any) => {
                    if (allApartments.length >= targetLimit) {
                      return false;
                    }
                    
                    try {
                      const $item = $(element);
                      const apartment = this.parseListingFromSearchPage($, $item);
                      if (apartment && apartment.url) {
                        allApartments.push(apartment);
                      }
                    } catch (error) {
                      this.logger.debug('Error parsing listing with alt selector', { error, selector });
                    }
                  });
                  if (allApartments.length > 0) break; // Found listings, stop checking other selectors
                }
              }
            }
            
            if (allApartments.length === 0) {
              console.log('[RealEstate] No listings found with any selector');
              
              // Debug: log some HTML structure to understand the page
              console.log('[RealEstate] Page title:', $('title').text());
              console.log('[RealEstate] Body classes:', $('body').attr('class'));
              console.log('[RealEstate] Main content structure:');
              console.log('  - Divs with id:', $('div[id]').map((i: number, el: any) => $(el).attr('id')).get().slice(0, 10));
              console.log('  - Divs with class containing "property":', $('div[class*="property"]').length);
              console.log('  - Divs with class containing "listing":', $('div[class*="listing"]').length);
              console.log('  - Articles:', $('article').length);
              
              // Check if we're on a different type of page
              const h1Text = $('h1').text();
              const h2Text = $('h2').text();
              console.log('[RealEstate] H1 text:', h1Text);
              console.log('[RealEstate] H2 text:', h2Text);
              
              // Check for error messages or redirects
              const errorMessages = $('.error, .alert, .warning, .message').text();
              if (errorMessages) {
                console.log('[RealEstate] Error/Alert messages found:', errorMessages);
              }
              
              // Check if we got redirected to a different page
              const currentPath = new URL(currentUrl).pathname;
              console.log('[RealEstate] Current URL path:', currentPath);
              
              // Log first 1000 chars of body content to understand the page
              const bodyText = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 1000);
              console.log('[RealEstate] Body text preview:', bodyText);
              
              break; // No more results, stop processing
            }
          }
          
          // Extract apartments from search page
          const pageApartments: RealEstateApartment[] = [];
          
          listings.each((index: number, element: any) => {
            // Stop if we've reached the limit
            if (allApartments.length >= targetLimit) {
              return false; // Break out of each loop
            }
            
            try {
              const $item = $(element);
              const apartment = this.parseListingFromSearchPage($, $item);
              if (apartment && apartment.url) {
                allApartments.push(apartment);
                pageApartments.push(apartment);
              }
            } catch (error) {
              // Silently skip failed listings
              this.logger.debug('Error parsing listing', { error, url: currentUrl });
            }
          });
          
          console.log(`[RealEstate] Total apartments so far: ${allApartments.length}/${targetLimit}`);
          
          // Save apartments from this page if we're in a job context
          if (process.env.SCRAPER_JOB_ID && pageApartments.length > 0) {
            try {
              console.log(`[RealEstate] Saving ${pageApartments.length} apartments from page ${pagesProcessed}`);
              
              // Import the necessary modules using relative paths
              const { ApartmentSaver } = await import('../../../lib/scrapers/utils/apartment-saver');
              const { db } = await import('../../../server/db');
              
              const saver = new ApartmentSaver(db);
              
              // Map apartments to the format expected by ApartmentSaver
              const apartmentsToSave = pageApartments.map(apt => ({
                externalId: apt.id,
                sourceSite: 'realestate.co.jp',
                sourceUrl: apt.url,
                title: apt.title,
                price: apt.rent,
                size: apt.size,
                layout: apt.layout,
                buildingType: apt.buildingType,
                buildingAge: apt.age,
                floor: apt.floor ? parseInt(apt.floor) || null : null,
                address: apt.address,
                nearestStation: apt.station.name,
                walkingTime: apt.station.walkTime,
                latitude: apt.coordinates?.latitude,
                longitude: apt.coordinates?.longitude,
                features: apt.features,
                images: apt.images.map((url, index) => ({
                  url,
                  caption: '',
                  order: index
                })),
                managementFee: apt.management,
                deposit: apt.deposit,
                keyMoney: apt.keyMoney,
                agent: apt.agent,
                availability: 'available' as const,
                fetchedDetails: apt.fetchedDetails || false,
                feesTotal: (apt.management || 0) + (apt.deposit || 0) + (apt.keyMoney || 0),
                feesJson: JSON.stringify({
                  management: apt.management,
                  deposit: apt.deposit,
                  keyMoney: apt.keyMoney
                })
              }));
              
              const result = await saver.saveApartments(apartmentsToSave, { 
                logger: this.logger
              });
              
              console.log(`[RealEstate] Save result - saved: ${result.saved}, updated: ${result.updated}, errors: ${result.errors}`);
            } catch (error) {
              console.error('[RealEstate] Error saving apartments from page:', error);
              // Don't fail the whole scrape if saving fails
            }
          }
          
          // Only get next page if we need more results and haven't reached page limit
          if (allApartments.length < targetLimit && pagesProcessed < maxPages) {
            const nextPageUrl = this.getNextPageUrl($, currentUrl);
            if (nextPageUrl && !processedUrls.has(nextPageUrl)) {
              console.log('[RealEstate] Found next page URL:', nextPageUrl);
              urlQueue.push(nextPageUrl);
            } else {
              console.log('[RealEstate] No next page found or already processed');
              break;
            }
          } else {
            console.log('[RealEstate] Reached target limit or max pages, stopping');
          }
        } else {
          // This is a detail page
          console.log('[RealEstate] Processing detail page');
          const apartment = this.parseDetailPage($, currentUrl);
          allApartments.push(apartment);
        }
        
        this.progressTracker.recordSuccess();
      } catch (error) {
        console.error('[RealEstate] Error processing URL:', {
          url: currentUrl,
          error: error instanceof Error ? error.message : error
        });
        this.logger.error('Error processing URL', { error, url: currentUrl });
        this.progressTracker.recordFailure();
        
        // Don't break on error, try next URL
      }
    }
    
    // Trim results to exact limit if we got more
    if (allApartments.length > targetLimit) {
      allApartments.splice(targetLimit);
    }
    
    console.log(`[RealEstate] Finished processing. Final apartments count: ${allApartments.length}`);
    return allApartments;
  }
}

/**
 * Helper class that extends RealEstateBase to access protected parsing methods
 */
class RealEstateParserHelper extends RealEstateBase {
  getName(): string {
    return 'RealEstateParserHelper';
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