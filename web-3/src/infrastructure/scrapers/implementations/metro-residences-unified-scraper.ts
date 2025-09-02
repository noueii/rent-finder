/**
 * Unified Metro Residences Scraper
 * Uses local JSON data file instead of web scraping
 * Adapts the existing MetroResidencesScraper to the unified architecture
 */

import { BaseScraper } from '../base/unified-scraper';
import type { ScraperConfig, ScrapeParams, BaseApartment, StationInfo, ScraperSelectors, ScraperResult } from '../base/unified-scraper';
import { readFile } from 'fs/promises';
import { join } from 'path';

// Metro Residences-specific apartment data
export interface MetroResidencesApartment extends BaseApartment {
  area?: string;
  ward?: string;
  city?: string;
  prefecture?: string;
  propertyId?: number;
  unitNumber?: string;
  bedroomLabel?: string;
  bathrooms?: string;
}

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
}

/**
 * Unified Metro Residences Scraper
 */
export class UnifiedMetroResidencesScraper extends BaseScraper<MetroResidencesApartment> {
  private unitsData: MetroResidencesUnit[] | null = null;
  
  constructor(config?: Partial<ScraperConfig>) {
    // Default configuration - no rate limiting needed for local data
    const defaultConfig: ScraperConfig = {
      mode: 'normal',
      strategy: 'sequential',
      rateLimit: {
        requests: 1000,
        perSeconds: 1,
        burst: 1000
      },
      maxRetries: 1,
      retryDelay: 0,
      retryBackoff: 'linear',
      concurrency: 1,
      requestTimeout: 5000,
      totalTimeout: 60000,
      features: {
        screenshots: false,
        cache: false,
        proxy: false  // No proxy needed for local data
      }
    };
    
    // Fast mode doesn't really apply to local data, but we'll honor it
    if (config?.mode === 'fast') {
      defaultConfig.strategy = 'concurrent';
      defaultConfig.concurrency = 10;
    }
    
    super({ ...defaultConfig, ...config });
  }
  
  protected getScraperName(): string {
    return 'UnifiedMetroResidences';
  }
  
  protected getSelectors(): ScraperSelectors {
    // Not used for JSON data, but required by interface
    return {
      title: '',
      rent: '',
      size: '',
      layout: '',
      buildingType: '',
      age: '',
      floor: '',
      address: '',
      station: '',
      management: '',
      deposit: '',
      keyMoney: ''
    };
  }
  
  // Override the main scrape method since we're working with local data
  async scrape(params: ScrapeParams): Promise<ScraperResult<MetroResidencesApartment>> {
    const startTime = Date.now();
    const errors: any[] = [];
    let data: MetroResidencesApartment[] = [];
    
    try {
      // Load the data if not already loaded
      if (!this.unitsData) {
        await this.loadUnitsData();
      }
      
      // Filter based on parameters
      let filteredUnits = this.filterUnits(params);
      
      // Convert to our apartment format
      data = filteredUnits.map(unit => this.convertToApartment(unit));
      
      this.progressTracker.setTotal(filteredUnits.length);
      data.forEach(() => this.progressTracker.recordSuccess());
      
      return this.formatResults(data, errors, startTime);
      
    } catch (error) {
      this.logger.error('Scraping failed', { error });
      errors.push(this.handleError(error));
      return this.formatResults(data, errors, startTime);
    }
  }
  
  protected async buildUrls(params: ScrapeParams): Promise<string[]> {
    // Not used for local data
    return [];
  }
  
  protected extractListingUrls(html: string): string[] {
    // Not used for local data
    return [];
  }
  
  protected extractApartmentData(html: string, url: string): MetroResidencesApartment {
    // Not used for local data
    throw new Error('Not implemented for local data source');
  }
  
  private async loadUnitsData(): Promise<void> {
    try {
      const dataPath = join(process.cwd(), 'src', 'data', 'metro-residences-units.json');
      const fileContent = await readFile(dataPath, 'utf-8');
      this.unitsData = JSON.parse(fileContent);
      this.logger.info(`Loaded ${this.unitsData?.length || 0} units from local data file`);
    } catch (error) {
      // If file not found, try alternative path
      try {
        const altPath = join(process.cwd(), 'data', 'metro-residences-units.json');
        const fileContent = await readFile(altPath, 'utf-8');
        this.unitsData = JSON.parse(fileContent);
        this.logger.info(`Loaded ${this.unitsData?.length || 0} units from alternative path`);
      } catch (altError) {
        this.logger.error('Failed to load Metro Residences data file', { error, altError });
        throw new Error('Metro Residences data file not found');
      }
    }
  }
  
  private filterUnits(params: ScrapeParams): MetroResidencesUnit[] {
    if (!this.unitsData) return [];
    
    let filtered = [...this.unitsData];
    
    // Filter by price range
    if (params.priceRange) {
      if (params.priceRange.min) {
        filtered = filtered.filter(unit => unit.price >= params.priceRange!.min!);
      }
      if (params.priceRange.max) {
        filtered = filtered.filter(unit => unit.price <= params.priceRange!.max!);
      }
    }
    
    // Filter by size range
    if (params.sizeRange) {
      if (params.sizeRange.min) {
        filtered = filtered.filter(unit => unit.layout.size.val >= params.sizeRange!.min!);
      }
      if (params.sizeRange.max) {
        filtered = filtered.filter(unit => unit.layout.size.val <= params.sizeRange!.max!);
      }
    }
    
    // Filter by city/district if provided
    if (params.city) {
      filtered = filtered.filter(unit => 
        unit.location.city.en.toLowerCase().includes(params.city!.toLowerCase()) ||
        unit.location.district.en.toLowerCase().includes(params.city!.toLowerCase())
      );
    }
    
    return filtered;
  }
  
  private convertToApartment(unit: MetroResidencesUnit): MetroResidencesApartment {
    // Build address from components
    const addressParts = [
      unit.location.street.en,
      unit.location.district.en,
      unit.location.city.en,
      'Tokyo',
      unit.location.postcode
    ].filter(Boolean);
    const address = addressParts.join(', ');
    
    // Get primary station info
    const primaryStation = unit.stations?.[0];
    const station: StationInfo = primaryStation ? {
      name: primaryStation.name.en,
      line: primaryStation.lines?.[0]?.name.en || 'Unknown Line',
      walkTime: primaryStation.walkingTime?.value || 99
    } : {
      name: 'Unknown Station',
      line: 'Unknown Line',
      walkTime: 99
    };
    
    // Collect all images
    const images: string[] = [];
    if (unit.photos) {
      images.push(...unit.photos.map(p => p.url));
    }
    if (unit.property_photos) {
      images.push(...unit.property_photos.map(p => p.url));
    }
    if (unit.layout_photos) {
      images.push(...unit.layout_photos.map(p => p.url));
    }
    
    return {
      id: `metro-${unit.property_unit_id}`,
      url: `https://metroresidences.com/property/${unit.property_id}/unit/${unit.property_unit_id}`,
      title: unit.property_name.ms.en,
      rent: unit.price,
      size: unit.layout.size.val,
      layout: unit.layout.bedroomLabel,
      buildingType: 'Service Apartment',
      age: 0, // Not provided in data
      floor: unit.floor || '',
      address,
      station,
      coordinates: {
        lat: unit.coord.lat,
        lng: unit.coord.lon
      },
      images,
      features: [],
      agent: 'Metro Residences',
      scrapedAt: new Date(),
      source: 'metroresidences.com',
      area: unit.location.neighbourhood?.en,
      ward: unit.location.district.en,
      city: unit.location.city.en,
      prefecture: 'Tokyo',
      propertyId: unit.property_id,
      unitNumber: unit.unit_nbr,
      bedroomLabel: unit.layout.bedroomLabel,
      bathrooms: unit.layout.bathrooms
    };
  }
}