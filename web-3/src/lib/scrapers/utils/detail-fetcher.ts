import type { ScrapedApartmentData } from '~/types/scraper';
import type { BaseApartment } from '~/infrastructure/scrapers/base/unified-scraper';
import { UnifiedScraperFactory } from '~/lib/scrapers/unified-scraper-factory';
import { UnifiedRealEstateScraper } from '../sources/realestate-scraper';
import { UnifiedWagayaJapanScraper } from '../sources/wagaya-japan-scraper';
import { UnifiedYoloJapanScraper } from '../sources/yolo-japan-scraper';

export interface DetailFetchResult {
  externalId: string;
  sourceUrl: string;
  success: boolean;
  data?: ScrapedApartmentData;
  error?: string;
}

/**
 * Utility for fetching apartment details using normal scrapers
 * These scrapers can access detail pages for comprehensive data
 */
export class ApartmentDetailFetcher {
  /**
   * Fetch details for multiple apartments
   * @param apartments Array of apartments with sourceUrl and sourceSite
   * @returns Array of detail fetch results
   */
  static async fetchDetailsForApartments(
    apartments: Array<{ externalId: string; sourceUrl: string; sourceSite: string }>
  ): Promise<DetailFetchResult[]> {
    const results: DetailFetchResult[] = [];
    
    // Group apartments by source site for efficient scraping
    const apartmentsBySource = apartments.reduce((acc, apt) => {
      if (!acc[apt.sourceSite]) {
        acc[apt.sourceSite] = [];
      }
      acc[apt.sourceSite].push(apt);
      return acc;
    }, {} as Record<string, typeof apartments>);
    
    // Process each source site
    for (const [sourceSite, sourceApartments] of Object.entries(apartmentsBySource)) {
      const scraper = this.getDetailScraper(sourceSite);
      
      if (!scraper) {
        // Add error results for unsupported source
        sourceApartments.forEach(apt => {
          results.push({
            externalId: apt.externalId,
            sourceUrl: apt.sourceUrl,
            success: false,
            error: `No detail scraper available for source: ${sourceSite}`
          });
        });
        continue;
      }
      
      // Fetch details for each apartment
      for (const apartment of sourceApartments) {
        try {
          console.log(`Fetching details for ${apartment.externalId} from ${apartment.sourceUrl}`);
          
          const apartmentData = await scraper.getApartmentDetails(apartment.sourceUrl);
          
          if (apartmentData) {
            // Convert from BaseApartment to ScrapedApartmentData
            const scrapedData: ScrapedApartmentData = {
              externalId: apartment.externalId,
              sourceUrl: apartment.sourceUrl,
              sourceSite: apartment.sourceSite,
              agent: apartmentData.agent,
              title: apartmentData.title,
              price: apartmentData.rent,
              size: apartmentData.size,
              layout: apartmentData.layout,
              floor: apartmentData.floor ? parseInt(apartmentData.floor) || null : null,
              totalFloors: apartmentData.totalFloors,
              buildingAge: apartmentData.age,
              address: apartmentData.address,
              area: apartmentData.area,
              ward: apartmentData.ward,
              city: apartmentData.city,
              prefecture: apartmentData.prefecture,
              latitude: apartmentData.coordinates?.lat,
              longitude: apartmentData.coordinates?.lng,
              description: apartmentData.description,
              amenities: apartmentData.features || [],
              availability: 'available',
              images: apartmentData.images?.map((img, index) => ({
                url: typeof img === 'string' ? img : img.url,
                caption: typeof img === 'string' ? '' : img.caption,
                order: index
              })) || [],
              nearestStations: apartmentData.station ? [{
                name: apartmentData.station.name,
                lines: [apartmentData.station.line],
                walkingMinutes: apartmentData.station.walkTime
              }] : [],
              managementFee: apartmentData.management,
              deposit: apartmentData.deposit,
              keyMoney: apartmentData.keyMoney,
              buildingType: apartmentData.buildingType,
              fetchedDetails: true,
              feesTotal: (apartmentData.management || 0) + (apartmentData.deposit || 0) + (apartmentData.keyMoney || 0),
              feesJson: JSON.stringify({
                management: apartmentData.management || 0,
                deposit: apartmentData.deposit || 0,
                keyMoney: apartmentData.keyMoney || 0
              })
            };
            
            results.push({
              externalId: apartment.externalId,
              sourceUrl: apartment.sourceUrl,
              success: true,
              data: scrapedData
            });
          } else {
            results.push({
              externalId: apartment.externalId,
              sourceUrl: apartment.sourceUrl,
              success: false,
              error: 'Failed to extract apartment details'
            });
          }
        } catch (error) {
          results.push({
            externalId: apartment.externalId,
            sourceUrl: apartment.sourceUrl,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }
    
    return results;
  }
  
  /**
   * Get the appropriate detail scraper for a source site
   * @param sourceSite The source site identifier
   * @returns A scraper instance that can fetch detail pages
   */
  private static getDetailScraper(sourceSite: string): 
    UnifiedRealEstateScraper | UnifiedWagayaJapanScraper | UnifiedYoloJapanScraper | null {
    
    try {
      // Map source site to scraper type
      let scraperType: string;
      switch (sourceSite) {
        case 'realestate-jp':
        case 'realestate.co.jp':
          scraperType = 'realestate';
          break;
        case 'wagaya-japan':
          scraperType = 'wagaya-japan';
          break;
        case 'yolo-japan':
          scraperType = 'yolo-japan';
          break;
        default:
          console.warn(`No detail scraper available for source: ${sourceSite}`);
          return null;
      }
      
      // Use UnifiedScraperFactory to get normal mode scraper (with detail page capability)
      const scraper = UnifiedScraperFactory.getScraper(scraperType as any, undefined, 'normal');
      return scraper as UnifiedRealEstateScraper | UnifiedWagayaJapanScraper | UnifiedYoloJapanScraper;
      
    } catch (error) {
      console.error(`Failed to get detail scraper for ${sourceSite}:`, error);
      return null;
    }
  }
  
  /**
   * Fetch details for a single apartment
   * @param apartment Apartment with sourceUrl and sourceSite
   * @returns Detail fetch result
   */
  static async fetchDetailsForApartment(
    apartment: { externalId: string; sourceUrl: string; sourceSite: string }
  ): Promise<DetailFetchResult> {
    const results = await this.fetchDetailsForApartments([apartment]);
    return results[0];
  }
}