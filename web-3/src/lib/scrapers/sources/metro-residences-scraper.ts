import { ApartmentScraper } from '../apartment-scraper';
import type * as cheerio from 'cheerio';
import type {
  ScrapedApartmentData,
  ScraperSearchParams,
  ScraperConfig,
  ScrapeProgress,
} from '~/types/scraper';
import { readFile } from 'fs/promises';
import { join } from 'path';

interface MetroResidencesUnit {
  _property_id: number;
  property_id: number;
  property_unit_id: number;
  property_name: {
    ms: {
      en: string;
      ja: string;
    };
    fts: {
      en: string;
      ja: string;
    };
  };
  price: number;
  location: {
    city: {
      en: string;
      ja: string;
    };
    district: {
      en: string;
      ja: string;
    };
    street: {
      en: string;
      ja: string;
    };
    postcode: string;
    neighbourhood?: {
      en: string;
      ja: string;
    };
  };
  coord: {
    lat: number;
    lon: number;
  };
  stations: Array<{
    id: number;
    name: {
      en: string;
      ja: string;
    };
    coord?: {
      lat: number;
      lon: number;
    };
    lines: Array<{
      id: number;
      name: {
        en: string;
        ja: string;
      };
    }>;
    distance: {
      unit: string;
      value: number;
    };
    walkingTime: {
      unit: string;
      value: number;
    };
  }>;
  layout: {
    size: {
      val: number;
      unit: string;
    };
    bathrooms: string;
    bedroomLabel: string;
  };
  photos?: Array<{
    url: string;
    photo_order: number;
    id: number;
  }>;
  property_photos?: Array<{
    url: string;
    photo_order: number;
    id: number;
  }>;
  layout_photos?: Array<{
    url: string;
    photo_order: number;
    id: number;
  }>;
  floor?: string;
  unit_nbr?: string;
  stories?: number;
  availability?: string;
  status?: string;
  permalinks: {
    en: string;
    ja: string;
  };
}

interface MetroResidencesData {
  filter: any;
  units: MetroResidencesUnit[];
}

/**
 * Metro Residences scraper implementation
 * Uses local JSON data instead of making API requests
 * 
 * Data source: src/lib/scrapers/data/metro.json
 * Web: https://www.metroresidences.com/jp-en/apartment-rental/
 * 
 * IMPORTANT: This scraper ALWAYS returns ALL apartments from the JSON file,
 * ignoring any search parameters to ensure the complete database is imported.
 */
export class UnifiedMetroResidencesScraper extends ApartmentScraper {
  private localData: MetroResidencesData | null = null;

  constructor(config?: Partial<ScraperConfig>) {
    const defaultConfig: ScraperConfig = {
      name: 'Metro Residences',
      baseUrl: 'https://www.metroresidences.com',
      rateLimit: 0, // No rate limiting needed for local data
      maxRetries: 1, // No retries needed for local data
      timeout: 5000, // Short timeout for local operations
      headers: {},
    };
    
    super({ ...defaultConfig, ...config });
    
    // Bypass robots.txt check since we're using local data
    this.setBypassRobotsTxt(true);
  }

  getName(): string {
    return 'Metro Residences Scraper (Local Data)';
  }

  /**
   * Load local JSON data
   */
  private async loadLocalData(): Promise<MetroResidencesData> {
    if (this.localData) {
      return this.localData;
    }

    try {
      // Construct path to the JSON file
      const dataPath = join(process.cwd(), 'src', 'lib', 'scrapers', 'data', 'metro.json');
      console.log(`[Metro Residences] Loading local data from: ${dataPath}`);
      
      const jsonContent = await readFile(dataPath, 'utf-8');
      this.localData = JSON.parse(jsonContent) as MetroResidencesData;
      
      console.log(`[Metro Residences] Loaded ${this.localData.units.length} units from local data`);
      return this.localData;
    } catch (error) {
      console.error('[Metro Residences] Failed to load local data:', error);
      throw new Error('Failed to load Metro Residences local data');
    }
  }

  /**
   * Build search URLs - for local data, we return a dummy URL
   */
  protected async buildSearchUrls(params: ScraperSearchParams): Promise<string[]> {
    // Return a dummy URL since we're using local data
    return ['local://metro-residences-data'];
  }

  /**
   * Scrape search page - reads from local JSON and filters based on parameters
   */
  protected async scrapeSearchPage(
    url: string,
    params: ScraperSearchParams
  ): Promise<ScrapedApartmentData[]> {
    console.log('[Metro Residences] Loading ALL apartments from local data (ignoring search params)');
    
    // Load local data
    const data = await this.loadLocalData();
    
    // Use ALL units - ignore any search parameters
    const filteredUnits = data.units;
    
    console.log(`[Metro Residences] Processing all ${filteredUnits.length} units`);
    
    // Convert filtered units to our format
    const apartments: ScrapedApartmentData[] = [];
    for (const unit of filteredUnits) {
      const apartment = this.convertToScrapedApartment(unit);
      if (apartment) {
        apartments.push(apartment);
      }
    }
    
    // Report progress if callback is available
    if (this.progressCallback) {
      const progress: ScrapeProgress = {
        total: apartments.length,
        completed: apartments.length,
        failed: 0,
        currentPage: 1,
        totalPages: 1, // All data processed at once from local file
        startedAt: new Date(),
      };
      this.progressCallback(progress);
    }
    
    return apartments;
  }

  /**
   * Extract apartment data - not used for local data
   */
  protected async extractApartmentData(
    $: cheerio.CheerioAPI,
    url: string
  ): Promise<ScrapedApartmentData | null> {
    // This method is not used when reading from local data
    return null;
  }

  /**
   * Check if last page - always true for local data
   */
  protected isLastScrapePage($: cheerio.CheerioAPI, currentPageUrl: string): boolean {
    // Always return true since we process all data at once
    return true;
  }

  /**
   * Convert Metro Residences data to our standard format
   */
  private convertToScrapedApartment(unit: MetroResidencesUnit): ScrapedApartmentData | null {
    try {
      // Extract ID
      const externalId = unit.property_unit_id?.toString() || unit._property_id?.toString();
      if (!externalId) {
        console.error('[Metro Residences] No ID found in unit data');
        return null;
      }
      
      // Use the permalink from the data
      const detailUrl = unit.permalinks?.en 
        ? `${this.config.baseUrl}${unit.permalinks.en}`
        : `${this.config.baseUrl}/jp-en/apartment-rental/property/${externalId}`;
      
      // Extract title from multilingual property name
      const title = unit.property_name?.ms?.en || unit.property_name?.fts?.en || `Property ${externalId}`;
      
      // Extract price
      const price = unit.price;
      if (!price) {
        console.error('[Metro Residences] No price found for property');
        return null;
      }
      
      // Extract size from layout
      const size = unit.layout?.size?.val;
      if (!size) {
        console.error('[Metro Residences] No size found for property');
        return null;
      }
      
      // Extract location parts
      const location = unit.location;
      const address = `${location.street?.en || ''}, ${location.district?.en || ''}`.trim();
      
      // Convert station data
      const nearestStations: ScrapedApartmentData['nearestStations'] = [];
      if (unit.stations && unit.stations.length > 0) {
        unit.stations.forEach(station => {
          nearestStations.push({
            name: station.name?.en || station.name?.ja || 'Unknown Station',
            walkingMinutes: station.walkingTime?.value || 99,
            lines: station.lines?.map(line => line.name?.en || line.name?.ja || 'Unknown Line'),
          });
        });
      }
      
      // Convert images
      const images: ScrapedApartmentData['images'] = [];
      
      // Add unit photos
      if (unit.photos && unit.photos.length > 0) {
        unit.photos.forEach((photo) => {
          images.push({
            url: photo.url.startsWith('http') ? photo.url : `${this.config.baseUrl}${photo.url}`,
            caption: 'Unit photo',
            order: photo.photo_order,
          });
        });
      }
      
      // Add property photos
      if (unit.property_photos && unit.property_photos.length > 0) {
        unit.property_photos.forEach((photo) => {
          images.push({
            url: photo.url.startsWith('http') ? photo.url : `${this.config.baseUrl}${photo.url}`,
            caption: 'Property photo',
            order: photo.photo_order + 100, // Offset to come after unit photos
          });
        });
      }
      
      // Add layout photos
      if (unit.layout_photos && unit.layout_photos.length > 0) {
        unit.layout_photos.forEach((photo) => {
          images.push({
            url: photo.url.startsWith('http') ? photo.url : `${this.config.baseUrl}${photo.url}`,
            caption: 'Layout photo',
            order: photo.photo_order + 200, // Offset to come after property photos
          });
        });
      }
      
      // Parse floor
      const floor = unit.floor ? parseInt(unit.floor, 10) : undefined;
      
      // Determine availability
      const availability = unit.status === 'active' ? 'available' : 'unknown';
      
      const apartment: ScrapedApartmentData = {
        externalId,
        sourceUrl: detailUrl,
        sourceSite: 'metro-residences',
        
        title,
        price,
        size,
        layout: unit.layout?.bedroomLabel,
        floor,
        totalFloors: unit.stories,
        buildingAge: undefined, // Not provided in data
        
        address,
        area: location.neighbourhood?.en || location.district?.en,
        ward: location.district?.en,
        city: location.city?.en || 'Tokyo',
        prefecture: 'Tokyo',
        latitude: unit.coord?.lat,
        longitude: unit.coord?.lon,
        
        description: undefined, // Not provided in list view
        amenities: [], // Not provided in list view
        availability,
        
        // Metro Residences typically includes utilities and often has lower upfront fees
        // Setting conservative defaults since exact fees aren't in the JSON data
        feesTotal: price * 2, // Typically 1 month deposit + 1 month advance rent
        feesJson: {
          deposit: price, // 1 month security deposit
          keyMoney: 0, // Metro Residences usually doesn't charge key money
          agencyFee: 0, // Often included or waived for premium properties
          insurance: 20000, // Annual insurance (estimated)
          cleaningFee: 30000, // Move-out cleaning (estimated)
          utilities: 'included', // Note that utilities are typically included
        } as any,
        
        images,
        nearestStations,
      };
      
      return apartment;
    } catch (error) {
      console.error('[Metro Residences] Error converting apartment data:', error);
      return null;
    }
  }

  /**
   * Build apartment URL for Metro Residences
   * Metro Residences uses property unit IDs in their URLs
   */
  protected async buildApartmentUrl(externalId: string): Promise<string | null> {
    // Metro Residences URL pattern: /jp-en/apartment-rental/property/{id}
    return `${this.config.baseUrl}/jp-en/apartment-rental/property/${externalId}`;
  }

  /**
   * Extract apartment ID from Metro Residences URL
   * URL patterns:
   * - https://www.metroresidences.com/jp-en/apartment-rental/property/{id}
   * - https://www.metroresidences.com/en/apartment-rental/property/{id}
   */
  protected async extractIdFromUrl(url: string): Promise<string | null> {
    try {
      const patterns = [
        /\/property\/(\d+)(?:\/|$)/,
        /property_unit_id=(\d+)/,
        /property_id=(\d+)/
      ];
      
      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }
      
      console.log(`[Metro Residences] Could not extract ID from URL: ${url}`);
      return null;
    } catch (error) {
      console.error('[Metro Residences] Error extracting ID from URL:', error);
      return null;
    }
  }

  /**
   * Search for an apartment by ID - fetches details from the website
   * This is used to get actual fee information that's not in the JSON data
   */
  async searchById(id: string): Promise<ScrapedApartmentData | null> {
    try {
      const url = await this.buildApartmentUrl(id);
      if (!url) {
        console.error('[Metro Residences] Could not build URL for ID:', id);
        return null;
      }

      console.log(`[Metro Residences] Fetching details for apartment ${id} from: ${url}`);
      
      const result = await this.fetchAndParse(url);
      if (!result.success || !result.data) {
        console.error('[Metro Residences] Failed to fetch apartment page:', result.error);
        return null;
      }

      const $ = result.data;
      
      // First try to find the apartment in our local data
      let apartmentData: ScrapedApartmentData | null = null;
      const localData = this.loadLocalData();
      if (localData) {
        const unit = localData.units.find(u => 
          u.property_unit_id?.toString() === id || 
          u._property_id?.toString() === id
        );
        if (unit) {
          apartmentData = this.convertToScrapedApartment(unit);
        }
      }

      if (!apartmentData) {
        console.error('[Metro Residences] Apartment not found in local data:', id);
        return null;
      }

      // Now extract fee information from the website
      try {
        // Look for fee section - Metro Residences might show this in different ways
        const feeSection = $('.fees-section, .pricing-details, .cost-breakdown, [class*="fee"], [class*="cost"]');
        
        if (feeSection.length > 0) {
          const feesJson: any = {};
          let feesTotal = 0;

          // Look for specific fee items
          feeSection.find('dt, .fee-label, .cost-label').each((_, elem) => {
            const label = $(elem).text().toLowerCase();
            const valueElem = $(elem).next('dd, .fee-value, .cost-value');
            const valueText = valueElem.text().trim();
            
            // Extract numeric value
            const numericMatch = valueText.match(/[¥￥]?([\d,]+)/);
            if (numericMatch) {
              const value = parseInt(numericMatch[1].replace(/,/g, ''));
              
              if (label.includes('deposit') || label.includes('security')) {
                feesJson.deposit = value;
                feesTotal += value;
              } else if (label.includes('key money')) {
                feesJson.keyMoney = value;
                feesTotal += value;
              } else if (label.includes('agency') || label.includes('brokerage')) {
                feesJson.agencyFee = value;
                feesTotal += value;
              } else if (label.includes('cleaning')) {
                feesJson.cleaningFee = value;
                feesTotal += value;
              } else if (label.includes('insurance')) {
                feesJson.insurance = value;
                feesTotal += value;
              }
            }
          });

          // Update apartment data with actual fees if found
          if (feesTotal > 0) {
            apartmentData.feesTotal = feesTotal;
            apartmentData.feesJson = feesJson;
            console.log(`[Metro Residences] Found actual fees for ${id}:`, feesJson);
          }
        }

        // Also try to extract amenities from the detail page
        const amenitiesSection = $('.amenities, .features, [class*="amenity"], [class*="feature"]');
        if (amenitiesSection.length > 0) {
          const amenities: string[] = [];
          amenitiesSection.find('li, .amenity-item, .feature-item').each((_, elem) => {
            const amenity = $(elem).text().trim();
            if (amenity && amenity.length < 100) { // Avoid long descriptions
              amenities.push(amenity);
            }
          });
          if (amenities.length > 0) {
            apartmentData.amenities = amenities;
          }
        }

        // Extract description if available
        const descSection = $('.description, .property-description, .overview, [class*="description"]').first();
        if (descSection.length > 0) {
          apartmentData.description = descSection.text().trim().substring(0, 1000); // Limit length
        }

      } catch (error) {
        console.error('[Metro Residences] Error extracting additional details:', error);
        // Continue with the data we have
      }

      return apartmentData;
    } catch (error) {
      console.error('[Metro Residences] Error in searchById:', error);
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
    // Metro Residences uses JSON API, not HTML pagination
    // This method is required by the abstract class but not used
    console.log('[Metro Residences] getNextPageUrl called but not used - Metro Residences uses JSON API');
    return null;
  }
}