import type * as cheerio from 'cheerio';
import { ApartmentScraper } from '../apartment-scraper';
import {
  ScrapedApartmentData,
  ScraperSearchParams,
  ScraperConfig,
} from '~/types/scraper';

/**
 * Sample scraper implementation showing how to extend ApartmentScraper
 * This is a template for creating actual scrapers
 */
export class SampleScraper extends ApartmentScraper {
  constructor(config: ScraperConfig) {
    super(config);
  }

  getName(): string {
    return 'Sample Scraper';
  }

  /**
   * Build search URLs based on search parameters
   */
  protected async buildSearchUrls(params: ScraperSearchParams): Promise<string[]> {
    const urls: string[] = [];
    const baseSearchUrl = `${this.config.baseUrl}/search`;
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    
    if (params.minPrice) queryParams.append('min_price', params.minPrice.toString());
    if (params.maxPrice) queryParams.append('max_price', params.maxPrice.toString());
    if (params.minSize) queryParams.append('min_size', params.minSize.toString());
    if (params.maxSize) queryParams.append('max_size', params.maxSize.toString());
    
    // Handle pagination
    const limit = params.limit || 100;
    const pages = Math.ceil(limit / 20); // Assuming 20 results per page
    
    for (let page = 1; page <= pages; page++) {
      queryParams.set('page', page.toString());
      urls.push(`${baseSearchUrl}?${queryParams.toString()}`);
    }
    
    return urls;
  }

  /**
   * Scrape a search results page and return listing URLs
   */
  protected async scrapeSearchPage(
    url: string,
    params: ScraperSearchParams
  ): Promise<string[]> {
    const result = await this.fetchAndParse(url);
    
    if (!result.success || !result.data) {
      console.error(`Failed to fetch search page: ${url}`);
      return [];
    }
    
    const $ = result.data;
    const listingUrls: string[] = [];
    
    // Example: Find all listing links
    $('.listing-item a.listing-link').each((_, element) => {
      const href = $(element).attr('href');
      if (href) {
        const fullUrl = new URL(href, this.config.baseUrl).toString();
        listingUrls.push(fullUrl);
      }
    });
    
    return listingUrls;
  }

  /**
   * Extract apartment data from a listing page
   */
  protected async extractApartmentData(
    $: cheerio.Root,
    url: string
  ): Promise<ScrapedApartmentData | null> {
    try {
      // Extract external ID from URL or page
      const externalId = this.extractExternalId($, url);
      if (!externalId) {
        console.error('Could not extract external ID');
        return null;
      }
      
      // Extract basic information
      const title = this.cleanText($('.property-title').text());
      const priceText = $('.property-price').text();
      const price = this.extractPrice(priceText);
      
      if (!title || !price) {
        console.error('Missing required fields: title or price');
        return null;
      }
      
      // Extract size
      const sizeText = $('.property-size').text();
      const size = this.extractNumber(sizeText);
      
      if (!size) {
        console.error('Could not extract size');
        return null;
      }
      
      // Extract layout
      const layout = this.cleanText($('.property-layout').text()) || undefined;
      
      // Extract floor information
      const floorText = $('.property-floor').text();
      const floorMatch = floorText.match(/(\d+)F\/(\d+)F/);
      const floor = floorMatch ? parseInt(floorMatch[1], 10) : undefined;
      const totalFloors = floorMatch ? parseInt(floorMatch[2], 10) : undefined;
      
      // Extract building age
      const ageText = $('.property-age').text();
      const buildingAge = this.extractNumber(ageText);
      
      // Extract address
      const address = this.cleanText($('.property-address').text());
      if (!address) {
        console.error('Could not extract address');
        return null;
      }
      
      // Extract description
      const description = this.cleanText($('.property-description').text()) || undefined;
      
      // Extract amenities
      const amenities: string[] = [];
      $('.amenity-item').each((_, element) => {
        const amenity = this.cleanText($(element).text());
        if (amenity) amenities.push(amenity);
      });
      
      // Extract images
      const images: ScrapedApartmentData['images'] = [];
      $('.property-images img').each((index, element) => {
        const src = $(element).attr('src');
        const alt = $(element).attr('alt');
        
        if (src) {
          images.push({
            url: new URL(src, this.config.baseUrl).toString(),
            caption: alt || undefined,
            order: index,
          });
        }
      });
      
      // Extract station information
      const nearestStations: ScrapedApartmentData['nearestStations'] = [];
      $('.station-info').each((_, element) => {
        const stationName = this.cleanText($(element).find('.station-name').text());
        const walkingText = $(element).find('.walking-time').text();
        const walkingMinutes = this.parseWalkingMinutes(walkingText);
        
        if (stationName && walkingMinutes) {
          // Extract train lines if available
          const lines: string[] = [];
          $(element).find('.train-line').each((_, lineElement) => {
            const line = this.cleanText($(lineElement).text());
            if (line) lines.push(line);
          });
          
          nearestStations.push({
            name: stationName,
            walkingMinutes,
            lines: lines.length > 0 ? lines : undefined,
          });
        }
      });
      
      if (nearestStations.length === 0) {
        console.error('No station information found');
        return null;
      }
      
      // Determine availability
      const availabilityText = $('.availability-status').text().toLowerCase();
      let availability: 'available' | 'occupied' | 'unknown' = 'unknown';
      
      if (availabilityText.includes('available') || availabilityText.includes('空室')) {
        availability = 'available';
      } else if (availabilityText.includes('occupied') || availabilityText.includes('満室')) {
        availability = 'occupied';
      }
      
      // Build the apartment data object
      const apartmentData: ScrapedApartmentData = {
        externalId,
        sourceUrl: url,
        sourceSite: this.config.name.toLowerCase().replace(/\s+/g, '-'),
        
        title,
        price,
        size,
        layout,
        floor,
        totalFloors,
        buildingAge,
        
        address,
        latitude: undefined, // Would need geocoding
        longitude: undefined,
        
        description,
        amenities,
        availability,
        
        images,
        nearestStations,
      };
      
      return apartmentData;
    } catch (error) {
      console.error('Error extracting apartment data:', error);
      return null;
    }
  }

  /**
   * Extract external ID from URL or page content
   */
  private extractExternalId($: cheerio.Root, url: string): string | null {
    // Try to extract from URL first
    const urlMatch = url.match(/property\/(\w+)/);
    if (urlMatch && urlMatch[1]) {
      return urlMatch[1];
    }
    
    // Try to extract from page
    const propertyId = $('meta[property="property:id"]').attr('content');
    if (propertyId) {
      return propertyId;
    }
    
    // Try data attribute
    const dataId = $('[data-property-id]').attr('data-property-id');
    if (dataId) {
      return dataId;
    }
    
    return null;
  }
}