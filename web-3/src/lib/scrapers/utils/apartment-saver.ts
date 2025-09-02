import { PrismaClient } from '@prisma/client';
import type { ScrapedApartmentData } from '~/types/scraper';

interface SaveApartmentsResult {
  saved: number;
  updated: number;
  errors: number;
  details: Array<{
    externalId: string;
    sourceSite: string;
    action: 'saved' | 'updated' | 'error';
    error?: string;
  }>;
}

export class ApartmentSaver {
  constructor(private db: PrismaClient) {}

  /**
   * Save or update apartments in the database
   * @param apartments Array of scraped apartment data
   * @param options Additional options for saving
   * @returns Statistics about the save operation
   */
  async saveApartments(
    apartments: ScrapedApartmentData[],
    options?: {
      onProgress?: (current: number, total: number) => void;
      logger?: {
        info: (message: string, data?: any) => void;
        error: (message: string, data?: any) => void;
      };
    }
  ): Promise<SaveApartmentsResult> {
    const result: SaveApartmentsResult = {
      saved: 0,
      updated: 0,
      errors: 0,
      details: [],
    };

    const total = apartments.length;
    const { onProgress, logger } = options || {};

    logger?.info(`Starting to save ${total} apartments to database`);

    for (let i = 0; i < apartments.length; i++) {
      const apartmentData = apartments[i];
      
      try {
        // Check if apartment already exists
        const existing = await this.db.apartment.findUnique({
          where: {
            externalId_sourceSite: {
              externalId: apartmentData.externalId,
              sourceSite: apartmentData.sourceSite,
            },
          },
          select: {
            id: true,
            latitude: true,
            longitude: true,
          },
        });

        if (existing) {
          // Check if this scraper provides complete details
          const hasCompleteDetails = ['metro-residences', 'e-housing'].includes(apartmentData.sourceSite);
          
          // Update existing apartment
          await this.db.apartment.update({
            where: { id: existing.id },
            data: {
              price: apartmentData.price,
              availability: apartmentData.availability,
              feesTotal: apartmentData.feesTotal,
              feesJson: apartmentData.feesJson,
              // Update agent if provided
              ...(apartmentData.agent ? { agent: apartmentData.agent } : {}),
              // Update coordinates if they're provided and currently missing
              ...(apartmentData.latitude && !existing.latitude ? { latitude: apartmentData.latitude } : {}),
              ...(apartmentData.longitude && !existing.longitude ? { longitude: apartmentData.longitude } : {}),
              // Set fetchedDetails to true for scrapers that provide complete data
              ...(hasCompleteDetails ? { fetchedDetails: true } : {}),
              updatedAt: new Date(),
            },
          });
          
          // Update images if provided
          if (apartmentData.images && apartmentData.images.length > 0) {
            // Delete existing images
            await this.db.apartmentImage.deleteMany({
              where: { apartmentId: existing.id },
            });
            
            // Create new images
            await this.db.apartmentImage.createMany({
              data: apartmentData.images.map((img) => ({
                apartmentId: existing.id,
                url: img.url,
                caption: img.caption,
                order: img.order,
              })),
            });
            
            logger?.info(`Updated ${apartmentData.images.length} images for apartment ${apartmentData.externalId}`);
          }
          
          result.updated++;
          result.details.push({
            externalId: apartmentData.externalId,
            sourceSite: apartmentData.sourceSite,
            action: 'updated',
          });
          
          logger?.info(`Updated apartment ${apartmentData.externalId}`, {
            externalId: apartmentData.externalId,
            sourceSite: apartmentData.sourceSite,
            price: apartmentData.price,
          });
        } else {
          // Get the scraping source ID
          // Map sourceSite to the correct scraper type
          let scraperType = apartmentData.sourceSite;
          if (scraperType === 'realestate.co.jp') {
            scraperType = 'realestate';
          }
          
          const scrapingSource = await this.db.scrapingSource.findFirst({
            where: { 
              type: scraperType,
              isActive: true
            },
            select: { id: true }
          });
          
          // Create new apartment
          logger?.info(`[ApartmentSaver] Creating apartment with fees:`, {
            externalId: apartmentData.externalId,
            feesTotal: apartmentData.feesTotal,
            feesJson: apartmentData.feesJson
          });
          
          // Metro Residences and eHousing provide complete details from their API/JSON data
          // Metro Residences now includes fee estimates
          const hasCompleteDetails = ['metro-residences', 'e-housing'].includes(apartmentData.sourceSite);
          
          await this.db.apartment.create({
            data: {
              externalId: apartmentData.externalId,
              sourceUrl: apartmentData.sourceUrl,
              sourceSite: apartmentData.sourceSite,
              scrapingSourceId: scrapingSource?.id,
              title: apartmentData.title,
              price: apartmentData.price,
              size: apartmentData.size,
              layout: apartmentData.layout,
              floor: apartmentData.floor,
              totalFloors: apartmentData.totalFloors,
              buildingAge: apartmentData.buildingAge,
              address: apartmentData.address,
              area: apartmentData.area,
              ward: apartmentData.ward,
              city: apartmentData.city,
              prefecture: apartmentData.prefecture,
              latitude: apartmentData.latitude,
              longitude: apartmentData.longitude,
              description: apartmentData.description,
              amenities: apartmentData.amenities || [],
              availability: apartmentData.availability,
              feesTotal: apartmentData.feesTotal,
              feesJson: apartmentData.feesJson,
              nearbyStations: apartmentData.nearestStations,
              agent: apartmentData.agent,
              fetchedDetails: hasCompleteDetails,
              scrapedAt: new Date(),
              images: {
                create: apartmentData.images.map((img) => ({
                  url: img.url,
                  caption: img.caption,
                  order: img.order,
                })),
              },
            },
          });
          
          result.saved++;
          result.details.push({
            externalId: apartmentData.externalId,
            sourceSite: apartmentData.sourceSite,
            action: 'saved',
          });
          
          logger?.info(`Saved new apartment ${apartmentData.externalId}`, {
            externalId: apartmentData.externalId,
            sourceSite: apartmentData.sourceSite,
            title: apartmentData.title,
            price: apartmentData.price,
            feesTotal: apartmentData.feesTotal,
            feesJson: apartmentData.feesJson,
          });
        }

        // Report progress
        if (onProgress) {
          onProgress(i + 1, total);
        }
      } catch (error) {
        result.errors++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        result.details.push({
          externalId: apartmentData.externalId,
          sourceSite: apartmentData.sourceSite,
          action: 'error',
          error: errorMessage,
        });
        
        logger?.error(`Error saving apartment ${apartmentData.externalId}`, {
          externalId: apartmentData.externalId,
          sourceSite: apartmentData.sourceSite,
          error: errorMessage,
        });
      }
    }

    logger?.info(`Finished saving apartments`, {
      total,
      saved: result.saved,
      updated: result.updated,
      errors: result.errors,
    });

    return result;
  }

  /**
   * Update the last scraped timestamp for a scraping source
   * @param scraperType The type of scraper (e.g., 'realestate', 'yolo-japan')
   */
  async updateScrapingSourceTimestamp(scraperType: string): Promise<void> {
    const scraperSource = await this.db.scrapingSource.findFirst({
      where: { type: scraperType }
    });

    if (scraperSource) {
      await this.db.scrapingSource.update({
        where: { id: scraperSource.id },
        data: { 
          lastScraped: new Date(),
        }
      });
    }
  }
}