import { ApartmentScraper } from '../apartment-scraper';
import type {
  ScrapedApartmentData,
  ScraperSearchParams,
  ScraperConfig,
  ScrapeResult,
} from '~/types/scraper';
import type { Root as CheerioAPI } from 'cheerio';

/**
 * E-Housing scraper implementation
 * Uses E-Housing's JSON API for apartment listings
 * 
 * API URL: https://api.e-housing.jp/rent/properties
 * Detail URL: https://e-housing.jp/rent/tokyo/sumida/isle-premium-oshiage-nord/505
 */
export class EHousingScraper extends ApartmentScraper {
  private apiUrl = 'https://api.e-housing.jp/rent/properties';
  private totalPagesCache: number | null = null;
  
  constructor(config?: Partial<ScraperConfig>) {
    const defaultConfig: ScraperConfig = {
      name: 'E-Housing',
      baseUrl: 'https://e-housing.jp',
      rateLimit: 1000, // 1 second between requests
      maxRetries: 3,
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:139.0) Gecko/20100101 Firefox/139.0',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.5',
        'Content-Type': 'application/json',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache'
      },
    };
    
    super({ ...defaultConfig, ...config });
  }

  getName(): string {
    return 'E-Housing Scraper';
  }

  /**
   * Override search method to handle fetchAll mode with dynamic pagination
   */
  async search(
    params: ScraperSearchParams,
    progressCallback?: ScrapeProgressCallback,
    onApartmentReady?: (apartment: ScrapedApartmentData) => Promise<void>
  ): Promise<ScrapeResult<ScrapedApartmentData[]>> {
    if (!params.fetchAll) {
      // For normal mode, use the base implementation
      return super.search(params, progressCallback, onApartmentReady);
    }

    // For fetchAll mode, handle pagination dynamically
    console.log('[E-Housing] FetchAll mode - fetching all available apartments');
    const apartments: ScrapedApartmentData[] = [];
    const errors: Array<{ url: string; error: unknown }> = [];
    const startTime = Date.now();
    
    try {
      // Check robots.txt before scraping
      const canScrape = await this.checkRobotsTxt();
      if (!canScrape) {
        return {
          success: false,
          error: {
            code: ScraperErrorCode.BLOCKED,
            message: 'Scraping not allowed by robots.txt',
            retryable: false,
            details: null,
          },
        };
      }
      
      let currentPage = 1;
      let totalPages = 1;
      let hasMorePages = true;
      
      const progress: ScrapeProgress = {
        total: 0,
        completed: 0,
        failed: 0,
        currentPage: 0,
        totalPages: 0,
        startedAt: new Date(),
      };
      
      while (hasMorePages && currentPage <= totalPages) {
        console.log(`[E-Housing] Fetching page ${currentPage}...`);
        
        // Add 1 second delay between pages to avoid overloading the API
        if (currentPage > 1) {
          const delay = 1000; // 1 second
          console.log(`[E-Housing] Waiting ${delay}ms before next page...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        try {
          // Fetch the page
          const pageApartments = await this.fetchApiPageWithMeta(currentPage, params);
          
          if (pageApartments.meta) {
            totalPages = pageApartments.meta.last_page;
            progress.total = pageApartments.meta.total;
            progress.totalPages = totalPages;
            
            console.log(`[E-Housing] Page ${currentPage}/${totalPages}, Total apartments: ${pageApartments.meta.total}`);
          }
          
          // Add apartments from this page
          apartments.push(...pageApartments.apartments);
          
          // Call onApartmentReady for each apartment if provided
          if (onApartmentReady) {
            for (const apartment of pageApartments.apartments) {
              onApartmentReady(apartment).catch(err => {
                console.error(`[E-Housing] Error in onApartmentReady for ${apartment.externalId}:`, err);
              });
            }
          }
          
          progress.completed += pageApartments.apartments.length;
          progress.currentPage = currentPage;
          
          // Update progress
          if (progressCallback) {
            progressCallback(progress);
          }
          
          // Check if we have more pages
          hasMorePages = currentPage < totalPages;
          currentPage++;
          
        } catch (error) {
          console.error(`[E-Housing] Error fetching page ${currentPage}:`, error);
          errors.push({ url: `api-page-${currentPage}`, error });
          progress.failed++;
          hasMorePages = false; // Stop on error
        }
      }
      
      console.log(`[E-Housing] FetchAll complete. Total apartments fetched: ${apartments.length}`);
      
      return {
        success: true,
        data: apartments,
        metadata: {
          total: apartments.length,
          scraped: apartments.length,
          failed: errors.length,
          duration: Date.now() - startTime,
          errors: errors.length > 0 ? errors : undefined,
        },
      };
      
    } catch (error) {
      console.error('[E-Housing] Search error:', error);
      return {
        success: false,
        error: {
          code: ScraperErrorCode.FETCH_ERROR,
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          retryable: true,
          details: error,
        },
      };
    }
  }

  /**
   * Build search URLs based on search parameters
   * For E-Housing, we'll return dummy URLs since we use the API directly
   */
  protected async buildSearchUrls(params: ScraperSearchParams): Promise<string[]> {
    // E-Housing uses an API, so we'll just return a single "URL" to trigger the search
    
    if (params.fetchAll || !params.limit) {
      // For fetchAll or no limit, we need to determine total pages from API
      // We'll create URLs dynamically in scrapeSearchPage based on API response
      console.log('[E-Housing] Dynamic pagination enabled - will fetch all available pages');
      
      // Return a special marker that tells scrapeSearchPage to handle pagination dynamically
      return ['api-fetchall-mode'];
    }
    
    const limit = params.limit;
    const perPage = 50;
    const totalPages = Math.ceil(limit / perPage);
    
    // Return an array with one URL per page we need to fetch
    return Array.from({ length: totalPages }, (_, i) => `api-page-${i + 1}`);
  }

  /**
   * Scrape search page - for API, we fetch data directly
   */
  protected async scrapeSearchPage(
    pageUrl: string, 
    params: ScraperSearchParams
  ): Promise<ScrapedApartmentData[]> {
    // Extract page number from our dummy URL
    const pageMatch = pageUrl.match(/api-page-(\d+)/);
    const page = pageMatch ? parseInt(pageMatch[1], 10) : 1;
    
    // Fetch apartments from the API
    const apartments = await this.fetchApiPage(page, params);
    
    // For API-based scraper, we return the apartment data directly
    // instead of URLs since we already have all the data
    return apartments;
  }

  /**
   * Extract apartment data - for API-based scraper, this won't be used
   * since we return apartment data directly from scrapeSearchPage
   */
  protected async extractApartmentData(
    $: CheerioAPI,
    url: string
  ): Promise<ScrapedApartmentData | null> {
    // This method won't be called for API-based scraping
    // since we return ScrapedApartmentData[] from scrapeSearchPage
    return null;
  }

  /**
   * Check if this is the last page
   */
  protected isLastScrapePage($: CheerioAPI, currentPageUrl: string): boolean {
    // For API-based scraping, we determine this based on response data
    // This method isn't really used in our flow
    return true;
  }

  /**
   * Fetch a single page from the API
   */
  private async fetchApiPage(page: number, params: ScraperSearchParams): Promise<ScrapedApartmentData[]> {
    // Default Tokyo area bounding box
    const tokyoBounds = [
      '139.5816585897043,35.514082964298694',
      '139.5816585897043,35.79533792183815',
      '139.88731007682898,35.79533792183815',
      '139.88731007682898,35.514082964298694'
    ];
    
    const requestBody = {
      search_params: ['address', 'address_ja', 'name', 'name_ja'],
      location_point: tokyoBounds,
      per_page: 50,
      page: page,
      rent_amounts_from: (params.minPrice ?? 0).toString(),
      rent_amounts_to: (params.maxPrice ?? 160000).toString(),
      amount_from: (params.minPrice ?? 0).toString(),
      amount_to: (params.maxPrice ?? 160000).toString(),
      sale_prices_from: '0',
      sale_prices_to: '160000',
      area_from: (params.minSize ?? 25).toString(),
      area_to: params.maxSize ?? 9999999999,
      sort_column: 'popularity',
      price_from: (params.minPrice ?? 0).toString(),
      price_to: (params.maxPrice ?? 160000).toString(),
      reins_partial: '',
      require_latlong: true
    };
    
    console.log('[E-Housing API] Request body:', JSON.stringify(requestBody, null, 2));
    
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: this.config.headers,
      body: JSON.stringify(requestBody),
      credentials: 'omit',
      mode: 'cors' as RequestMode,
    });
    
    console.log('[E-Housing API] Response status:', response.status, response.statusText);
    console.log('[E-Housing API] Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[E-Housing API] Error response:', errorText);
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    const responseData = await response.json();
    
    console.log('[E-Housing API] Response type:', typeof responseData);
    console.log('[E-Housing API] Response keys:', Object.keys(responseData));
    
    // Check if response has the expected structure
    if (!responseData || typeof responseData !== 'object') {
      console.error('[E-Housing API] Invalid response format - expected object');
      return [];
    }
    
    // Extract the data array from the response
    const data = responseData.data;
    const meta = responseData.meta;
    
    if (meta) {
      console.log('[E-Housing API] Meta info:', {
        total: meta.total,
        per_page: meta.per_page,
        current_page: meta.current_page,
        last_page: meta.last_page
      });
    }
    
    if (!data || !Array.isArray(data)) {
      console.error('[E-Housing API] Invalid data format - expected array in data field');
      return [];
    }
    
    console.log('[E-Housing API] Data length:', data.length);
    
    // Log first item structure if available
    if (data.length > 0) {
      console.log('[E-Housing API] First item keys:', Object.keys(data[0]));
      console.log('[E-Housing API] Sample fields from first item:', {
        id: data[0].id,
        name: data[0].name,
        rent_amount: data[0].rent_amount,
        size_sqm: data[0].size_sqm,
        layout: data[0].layout,
        address: data[0].address
      });
    }
    
    return data.map(item => this.transformApiData(item)).filter(apt => apt !== null) as ScrapedApartmentData[];
  }

  /**
   * Fetch a single page from the API with metadata
   */
  private async fetchApiPageWithMeta(page: number, params: ScraperSearchParams): Promise<{
    apartments: ScrapedApartmentData[];
    meta?: {
      total: number;
      per_page: number;
      current_page: number;
      last_page: number;
    };
  }> {
    // Default Tokyo area bounding box
    const tokyoBounds = [
      '139.5816585897043,35.514082964298694',
      '139.5816585897043,35.79533792183815',
      '139.88731007682898,35.79533792183815',
      '139.88731007682898,35.514082964298694'
    ];
    
    const requestBody = {
      search_params: ['address', 'address_ja', 'name', 'name_ja'],
      location_point: tokyoBounds,
      per_page: 50,
      page: page,
      rent_amounts_from: (params.minPrice ?? 0).toString(),
      rent_amounts_to: (params.maxPrice ?? 160000).toString(),
      amount_from: (params.minPrice ?? 0).toString(),
      amount_to: (params.maxPrice ?? 160000).toString(),
      sale_prices_from: '0',
      sale_prices_to: '160000',
      area_from: (params.minSize ?? 25).toString(),
      area_to: params.maxSize ?? 9999999999,
      sort_column: 'popularity',
      price_from: (params.minPrice ?? 0).toString(),
      price_to: (params.maxPrice ?? 160000).toString(),
      reins_partial: '',
      require_latlong: true
    };
    
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: this.config.headers,
      body: JSON.stringify(requestBody),
      credentials: 'omit',
      mode: 'cors' as RequestMode,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[E-Housing API] Error response:', errorText);
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    const responseData = await response.json();
    
    // Extract the data array and metadata
    const data = responseData.data || [];
    const meta = responseData.meta;
    
    const apartments = data.map((item: any) => this.transformApiData(item)).filter((apt: any) => apt !== null) as ScrapedApartmentData[];
    
    return { apartments, meta };
  }

  /**
   * Transform API data to our standard format
   */
  private transformApiData(apiData: any): ScrapedApartmentData | null {
    try {
      console.log('[E-Housing Transform] Processing item with keys:', Object.keys(apiData));
      
      // Extract basic information
      const externalId = apiData.id?.toString() || apiData.property_id?.toString();
      if (!externalId) {
        console.error('[E-Housing Transform] No ID found in API data:', apiData);
        return null;
      }
      
      // Build source URL
      const sourceUrl = this.buildDetailUrl(apiData);
      
      // Extract apartment details
      const title = apiData.name || apiData.name_en || apiData.building_name || 'Unknown Property';
      console.log('[E-Housing Transform] Title:', title);
      
      // Log price extraction - API uses rent_amount
      console.log('[E-Housing Transform] Price fields - rent_amount:', apiData.rent_amount, 'rent:', apiData.rent, 'price:', apiData.price, 'management_fee:', apiData.management_fee);
      const baseRent = this.extractNumber(apiData.rent_amount || apiData.rent || apiData.price);
      const managementFee = this.extractNumber(apiData.management_fee || apiData.common_service_fee) || 0;
      const price = baseRent + managementFee; // Total monthly cost = rent + management fee
      console.log('[E-Housing Transform] Extracted price:', price, '(base rent:', baseRent, '+ management fee:', managementFee, ')');
      
      // Log size extraction - API uses size_sqm
      console.log('[E-Housing Transform] Size fields - size_sqm:', apiData.size_sqm, 'area:', apiData.area, 'size:', apiData.size);
      const size = this.extractNumber(apiData.size_sqm || apiData.area || apiData.size);
      console.log('[E-Housing Transform] Extracted size:', size);
      
      if (!price || !size) {
        console.error('[E-Housing Transform] Missing required fields - price:', price, 'size:', size);
        return null;
      }
      
      // Extract layout
      const layout = apiData.layout || apiData.floor_plan || apiData.room_type || undefined;
      
      // Extract floor information
      const floor = apiData.floor ? parseInt(apiData.floor.toString(), 10) : undefined;
      const totalFloors = apiData.total_floors ? parseInt(apiData.total_floors.toString(), 10) : undefined;
      
      // Extract building age - API provides age directly
      let buildingAge: number | undefined;
      if (apiData.age !== undefined && apiData.age !== null) {
        buildingAge = parseInt(apiData.age.toString(), 10);
      } else if (apiData.built_year || apiData.construction_year || apiData.build_date) {
        // Try to parse from build date
        const buildDate = apiData.build_date || apiData.built_year || apiData.construction_year;
        if (buildDate) {
          const year = new Date(buildDate).getFullYear();
          if (!isNaN(year)) {
            buildingAge = new Date().getFullYear() - year;
          }
        }
      }
      
      // Extract fee information
      let feesTotal: number | undefined;
      let feesJson: ScrapedApartmentData['feesJson'] | undefined;
      
      // E-Housing API provides various fee fields
      this.logger.info('[E-Housing] Raw fee fields from API:', {
        security_deposit: apiData.security_deposit,
        deposit_fee: apiData.deposit_fee,
        key_money: apiData.key_money,
        agency_fee: apiData.agency_fee,
        guarantor_fee: apiData.guarantor_fee,
        insurance_fee: apiData.insurance_fee,
      });
      
      const deposit = this.extractNumber(apiData.security_deposit || apiData.deposit || apiData.deposit_fee);
      const keyMoney = this.extractNumber(apiData.key_money || apiData.reikin);
      const agencyFee = this.extractNumber(apiData.agency_fee || apiData.advertising_fee);
      const guarantorFee = this.extractNumber(apiData.guarantor_fee || apiData.guarantor_company_fee);
      const insurance = this.extractNumber(apiData.insurance_fee || apiData.fire_insurance);
      
      // Build fees JSON if we have any fee data
      if (deposit || keyMoney || agencyFee || guarantorFee || insurance) {
        feesJson = {
          deposit,
          keyMoney,
          agencyFee,
          guarantorFee,
          insurance,
          // Note: managementFee is not included here as it's part of monthly rent
        };
        
        // Check for other fees
        if (apiData.other_initial_costs) {
          // Extract total amount from strings like "Total: 16,500 yen (breakdown: ...)"
          let otherCosts: number | undefined;
          
          if (typeof apiData.other_initial_costs === 'string') {
            // Look for "Total:" pattern first
            const totalMatch = apiData.other_initial_costs.match(/Total:\s*([\d,]+)/i);
            if (totalMatch) {
              otherCosts = this.extractNumber(totalMatch[1]);
            } else {
              // Fallback: extract first number found
              const firstNumberMatch = apiData.other_initial_costs.match(/([\d,]+)\s*yen/i);
              if (firstNumberMatch) {
                otherCosts = this.extractNumber(firstNumberMatch[1]);
              }
            }
          } else {
            otherCosts = this.extractNumber(apiData.other_initial_costs);
          }
          
          if (otherCosts && otherCosts < 1000000) { // Sanity check - initial costs should be less than 1M yen
            feesJson.other = {
              'initial_costs': otherCosts
            };
          }
        }
        
        // Calculate total initial fees (excluding monthly management fee)
        feesTotal = (deposit || 0) + (keyMoney || 0) + (agencyFee || 0) + 
                   (guarantorFee || 0) + (insurance || 0);
        
        // Add other initial costs to total if present
        if (feesJson.other?.initial_costs) {
          feesTotal += feesJson.other.initial_costs;
        }
      }
      
      this.logger.info('[E-Housing] Calculated fee values:', {
        deposit,
        keyMoney,
        agencyFee,
        guarantorFee,
        insurance,
        otherInitialCosts: feesJson?.other?.initial_costs,
        feesTotal,
        feesJson,
        note: 'Management fee excluded from initial fees - added to monthly rent'
      });
      
      // Extract address components
      const address = apiData.address || apiData.address_en || '';
      
      if (!address) {
        console.error('[E-Housing Transform] No address found');
        return null;
      }
      
      // Extract ward, area, city from the API response
      let ward: string | undefined;
      let area: string | undefined;
      let city: string | undefined = 'Tokyo'; // Default to Tokyo
      let prefecture: string | undefined = 'Tokyo';
      
      // Ward information from the ward object
      if (apiData.ward && typeof apiData.ward === 'object') {
        ward = apiData.ward.name || apiData.ward.name_ja;
        console.log('[E-Housing Transform] Ward from object:', ward);
      }
      
      // Try to parse area from address
      // Japanese address format examples:
      // "3-38-15 Ebisu, Shibuya-ku, Tokyo"
      // "3-5-5 Shimo Ochiai, Shinjuku-ku, Tokyo"
      const addressParts = address.split(',').map(part => part.trim());
      if (addressParts.length >= 2) {
        // First part contains the street address and possibly area name
        const firstPart = addressParts[0];
        
        // Try different patterns to extract area
        // Pattern 1: "3-38-15 Ebisu" -> area is "Ebisu"
        // Pattern 2: "3-5-5 Shimo Ochiai" -> area is "Shimo Ochiai"
        const patterns = [
          /^\d+-\d+-\d+\s+(.+)$/, // Numbers followed by area name
          /^\d+-\d+\s+(.+)$/,      // Two numbers followed by area name
          /\s+([^\d]+)$/           // Any non-numeric part at the end
        ];
        
        for (const pattern of patterns) {
          const match = firstPart.match(pattern);
          if (match) {
            area = match[1].trim();
            break;
          }
        }
        
        // Second part is usually the ward with -ku suffix
        if (!ward && addressParts[1]) {
          ward = addressParts[1].replace(/-ku$/, '').replace(/区$/, '').trim();
        }
        
        // Third part is usually the city/prefecture
        if (addressParts[2]) {
          city = addressParts[2].trim();
          prefecture = addressParts[2].trim();
        }
      }
      
      console.log('[E-Housing Transform] Address components:', {
        full: address,
        area: area,
        ward: ward,
        city: city,
        prefecture: prefecture
      });
      
      // Extract coordinates if available
      const latitude = apiData.latitude || apiData.lat || undefined;
      const longitude = apiData.longitude || apiData.lng || apiData.lon || undefined;
      
      // Extract amenities
      const amenities: string[] = [];
      if (apiData.amenities) {
        if (Array.isArray(apiData.amenities)) {
          amenities.push(...apiData.amenities);
        } else if (typeof apiData.amenities === 'string') {
          amenities.push(...apiData.amenities.split(',').map(a => a.trim()));
        }
      }
      
      // Extract images - API provides images_url array and featured_image_url
      const images: ScrapedApartmentData['images'] = [];
      
      // Add featured image first
      if (apiData.featured_image_url) {
        images.push({
          url: apiData.featured_image_url,
          caption: 'Featured image',
          order: 0,
        });
      }
      
      // Add other images
      if (apiData.images_url && Array.isArray(apiData.images_url)) {
        apiData.images_url.forEach((url: string, index: number) => {
          if (typeof url === 'string' && url !== apiData.featured_image_url) {
            images.push({
              url: url,
              caption: undefined,
              order: index + 1,
            });
          }
        });
      }
      
      // Fallback to images array if images_url not available
      if (images.length === 0 && apiData.images && Array.isArray(apiData.images)) {
        apiData.images.forEach((img: any, index: number) => {
          const url = typeof img === 'string' ? img : (img.url || img.src);
          if (url) {
            images.push({
              url: url.startsWith('http') ? url : `https://s3.ap-northeast-1.amazonaws.com/ehousing-dev/${url}`,
              caption: img.caption || img.alt || undefined,
              order: index,
            });
          }
        });
      }
      
      // Add floor plan images
      if (apiData.floor_plan_images_url && Array.isArray(apiData.floor_plan_images_url)) {
        apiData.floor_plan_images_url.forEach((url: string, index: number) => {
          if (typeof url === 'string') {
            images.push({
              url: url,
              caption: 'Floor plan',
              order: images.length + index,
            });
          }
        });
      } else if (apiData.floor_plan_images && Array.isArray(apiData.floor_plan_images)) {
        // Fallback to floor_plan_images array if floor_plan_images_url not available
        apiData.floor_plan_images.forEach((img: any, index: number) => {
          const url = typeof img === 'string' ? img : (img.url || img.src);
          if (url) {
            images.push({
              url: url.startsWith('http') ? url : `https://s3.ap-northeast-1.amazonaws.com/ehousing-dev/${url}`,
              caption: 'Floor plan',
              order: images.length + index,
            });
          }
        });
      }
      
      // Extract station information - API provides trainStations array
      const nearestStations: ScrapedApartmentData['nearestStations'] = [];
      if (apiData.trainStations && Array.isArray(apiData.trainStations)) {
        apiData.trainStations.forEach((station: any) => {
          const walkingMinutes = station.metaData?.pivot_walking_distance_minutes || 
                                station.walking_distance_minutes || 
                                station.walking_minutes || 
                                99;
          nearestStations.push({
            name: station.name || station.station_name,
            walkingMinutes: walkingMinutes,
            lines: station.lines || (station.line ? [station.line] : undefined),
          });
        });
      } else if (apiData.stations && Array.isArray(apiData.stations)) {
        // Fallback to stations array
        apiData.stations.forEach((station: any) => {
          nearestStations.push({
            name: station.name || station.station_name,
            walkingMinutes: station.walking_minutes || station.minutes || 99,
            lines: station.lines || (station.line ? [station.line] : undefined),
          });
        });
      }
      
      const transformedData = {
        externalId,
        sourceUrl,
        sourceSite: 'e-housing',
        
        title,
        price,
        size,
        layout,
        floor,
        totalFloors,
        buildingAge,
        
        address,
        area,
        ward,
        city,
        prefecture,
        latitude,
        longitude,
        
        description: apiData.description || undefined,
        amenities,
        availability: apiData.available ? 'available' : 'unknown',
        
        feesTotal,
        feesJson,
        
        images,
        nearestStations,
      };
      
      this.logger.info('[E-Housing Transform] Final apartment data:', {
        id: externalId,
        title: title,
        price: price,
        size: size,
        feesTotal: transformedData.feesTotal,
        feesJson: transformedData.feesJson
      });
      
      return transformedData;
    } catch (error) {
      console.error('[E-Housing Transform] Error transforming API data:', error);
      console.error('[E-Housing Transform] Failed item:', apiData);
      return null;
    }
  }

  /**
   * Wait for rate limit
   */
  protected async waitForRateLimit(): Promise<void> {
    // Rate limiting is handled by the BaseScraper's queueRequest method
    // This is just a placeholder to maintain compatibility
    return Promise.resolve();
  }

  /**
   * Build detail URL from API data
   */
  private buildDetailUrl(apiData: any): string {
    // E-Housing URL pattern: /rent/tokyo/sumida/isle-premium-oshiage-nord/505
    // API provides the slug directly
    if (apiData.slug && apiData.room_number) {
      const wardSlug = apiData.ward?.slug || 'tokyo';
      return `${this.config.baseUrl}/rent/tokyo/${wardSlug}/${apiData.slug}/${apiData.room_number}`;
    }
    
    // Fallback to building URL from parts
    const prefecture = 'tokyo';
    const wardName = apiData.ward?.slug || apiData.ward?.name?.toLowerCase() || 'unknown';
    const buildingSlug = apiData.slug || this.slugify(apiData.name || 'property');
    const unitId = apiData.room_number || apiData.id || '0';
    
    return `${this.config.baseUrl}/rent/${prefecture}/${wardName}/${buildingSlug}/${unitId}`;
  }

  /**
   * Convert text to URL-friendly slug
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with dashes
      .replace(/-+/g, '-') // Replace multiple dashes with single dash
      .trim();
  }

  /**
   * Extract number from string or number
   */
  private extractNumber(value: any): number | undefined {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string') {
      const cleaned = value.replace(/[^0-9.]/g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) ? undefined : num;
    }
    return undefined;
  }

  /**
   * Build apartment URL for eHousing
   * eHousing uses the apartment ID directly in their URLs
   */
  protected async buildApartmentUrl(externalId: string): Promise<string | null> {
    // eHousing URL pattern: /ja/apartments/{id}
    return `${this.config.baseUrl}/ja/apartments/${externalId}`;
  }

  /**
   * Extract apartment ID from eHousing URL
   * URL patterns:
   * - https://www.ehousing.co.jp/ja/apartments/{id}
   * - https://www.ehousing.co.jp/en/apartments/{id}
   */
  protected async extractIdFromUrl(url: string): Promise<string | null> {
    try {
      const patterns = [
        /\/apartments\/(\d+)(?:\/|$)/,
        /apartment_id=(\d+)/,
        /id=(\d+)/
      ];
      
      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }
      
      console.log(`[eHousing] Could not extract ID from URL: ${url}`);
      return null;
    } catch (error) {
      console.error('[eHousing] Error extracting ID from URL:', error);
      return null;
    }
  }

  /**
   * Get the next page URL if available
   * @param $ Cheerio instance of the current page (not used for API-based scraper)
   * @param currentPageUrl The URL of the current page being scraped
   * @returns The next page URL or null if no next page exists
   */
  protected getNextPageUrl($: CheerioAPI, currentPageUrl: string): string | null {
    // E-Housing uses JSON API, not HTML pagination
    // This method is required by the abstract class but not used
    console.log('[E-Housing] getNextPageUrl called but not used - E-Housing uses JSON API pagination');
    return null;
  }
}