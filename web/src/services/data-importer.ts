import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ScrapedApartment } from './scraping-service';

/**
 * Data importer for existing scraped data
 */
export class DataImporter {
  private db: PrismaClient;

  constructor(db: PrismaClient) {
    this.db = db;
  }

  /**
   * Import apartments from apts.jp JSON file
   */
  async importAptsJpData(filePath: string): Promise<{
    imported: number;
    skipped: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let imported = 0;
    let skipped = 0;

    try {
      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      
      for (const item of data) {
        try {
          // Transform apts.jp data to our schema
          const apartment = await this.transformAptsJpData(item);
          if (apartment) {
            await this.saveApartment(apartment);
            imported++;
          } else {
            skipped++;
          }
        } catch (error) {
          errors.push(`Failed to import item: ${error.message}`);
          skipped++;
        }
      }
    } catch (error) {
      errors.push(`Failed to read file: ${error.message}`);
    }

    return { imported, skipped, errors };
  }

  /**
   * Import apartments from realestate.co.jp JSON file
   */
  async importRealEstateData(filePath: string): Promise<{
    imported: number;
    skipped: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let imported = 0;
    let skipped = 0;

    try {
      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      
      for (const item of data) {
        try {
          // Transform realestate.co.jp data to our schema
          const apartment = await this.transformRealEstateData(item);
          if (apartment) {
            await this.saveApartment(apartment);
            imported++;
          } else {
            skipped++;
          }
        } catch (error) {
          errors.push(`Failed to import item: ${error.message}`);
          skipped++;
        }
      }
    } catch (error) {
      errors.push(`Failed to read file: ${error.message}`);
    }

    return { imported, skipped, errors };
  }

  /**
   * Transform apts.jp data to our schema
   */
  private async transformAptsJpData(item: any): Promise<ScrapedApartment | null> {
    try {
      // Find station ID
      const stationId = await this.findStationId(item.station_name);
      if (!stationId) {
        console.warn(`Could not find station: ${item.station_name}`);
        return null;
      }

      // Parse features
      const features = item.features ? item.features.split('·').map((f: string) => f.trim()) : [];

      // Create apartment object
      const apartment: ScrapedApartment = {
        sourceUrl: item.url || `https://apts.jp/property/${item.building_name}`,
        sourceSite: 'apts.jp',
        title: `${item.building_name} ${item.unit_number || ''}`.trim(),
        buildingName: item.building_name,
        unitNumber: item.unit_number,
        rentMonthly: typeof item.rawRent === 'number' ? item.rawRent : parseInt(item.rent?.replace(/[^0-9]/g, '') || '0'),
        size: parseFloat(item.area_m2) || 0,
        layout: item.bedroom === 'S' ? '1R' : `${item.bedroom || '1'}K`,
        prefecture: item.prefecture || 'Tokyo',
        city: item.city || '',
        address: item.address || '',
        features,
        stationName: item.station_name,
        walkingMinutes: parseInt(item.station_distance_min) || 5,
        isAvailable: true,
      };

      // Validate required fields
      if (!apartment.rentMonthly || apartment.rentMonthly <= 0) {
        console.warn(`Invalid rent for ${apartment.title}`);
        return null;
      }

      if (!apartment.size || apartment.size <= 0) {
        console.warn(`Invalid size for ${apartment.title}`);
        return null;
      }

      return apartment;
    } catch (error) {
      console.error('Error transforming apts.jp data:', error);
      return null;
    }
  }

  /**
   * Transform realestate.co.jp data to our schema
   */
  private async transformRealEstateData(item: any): Promise<ScrapedApartment | null> {
    try {
      // Parse station name from nearest_station
      const stationMatch = item.nearest_station?.match(/([^(]+)/);
      const stationName = stationMatch?.[1]?.trim().replace(/\s+Station$/i, '') || '';
      
      if (!stationName) {
        console.warn(`No station found in: ${item.nearest_station}`);
        return null;
      }

      // Find station ID
      const stationId = await this.findStationId(stationName);
      if (!stationId) {
        console.warn(`Could not find station: ${stationName}`);
        return null;
      }

      // Parse walking minutes
      const minutesMatch = item.nearest_station?.match(/(\d+)\s*min/);
      const walkingMinutes = parseInt(minutesMatch?.[1] || '5');

      // Parse rent
      const rentMatch = item.monthly_costs?.match(/(\d+)/);
      const rentMonthly = parseInt(rentMatch?.[1] || '0');

      // Parse size
      const sizeMatch = item.size?.match(/(\d+\.?\d*)/);
      const size = parseFloat(sizeMatch?.[1] || '0');

      // Parse floor
      const floorMatch = item.floor?.match(/(\d+)\s*\/\s*(\d+)/);
      const floor = floorMatch?.[1];
      const totalFloors = parseInt(floorMatch?.[2] || '0');

      // Parse year built
      const yearBuilt = parseInt(item.year_built || '0');
      const buildingAge = yearBuilt > 0 ? new Date().getFullYear() - yearBuilt : undefined;

      // Parse deposit and key money
      const deposit = this.parseMoneyToMonths(item.deposit);
      const keyMoney = this.parseMoneyToMonths(item.key_money);

      // Create apartment object
      const apartment: ScrapedApartment = {
        sourceUrl: item.link || `https://realestate.co.jp/property/${item.property}`,
        sourceSite: 'realestate.co.jp',
        title: item.property || 'Unknown Property',
        buildingName: item.property || 'Unknown Building',
        rentMonthly,
        deposit,
        keyMoney,
        size,
        layout: item.property?.match(/(\d+[SLDK]+)/i)?.[1] || 'Unknown',
        prefecture: 'Tokyo',
        city: item.ward || '',
        ward: item.ward,
        address: `${item.area || ''} ${item.ward || ''}`.trim(),
        buildingAge,
        buildYear: yearBuilt > 0 ? yearBuilt : undefined,
        floor,
        totalFloors: totalFloors > 0 ? totalFloors : undefined,
        stationName,
        walkingMinutes: isNaN(walkingMinutes) ? 5 : walkingMinutes,
        isAvailable: item.availability?.toLowerCase().includes('available') !== false,
      };

      // Validate required fields
      if (!apartment.rentMonthly || apartment.rentMonthly <= 0) {
        console.warn(`Invalid rent for ${apartment.title}`);
        return null;
      }

      if (!apartment.size || apartment.size <= 0) {
        console.warn(`Invalid size for ${apartment.title}`);
        return null;
      }

      return apartment;
    } catch (error) {
      console.error('Error transforming realestate.co.jp data:', error);
      return null;
    }
  }

  /**
   * Parse money values to months (for deposit/key money)
   */
  private parseMoneyToMonths(value: string): number | undefined {
    if (!value || value === 'N/A') return undefined;
    
    // If it's already in months
    const monthsMatch = value.match(/(\d+\.?\d*)\s*(?:months?|ヶ月)/);
    if (monthsMatch) {
      return parseFloat(monthsMatch[1]);
    }

    // If it's ¥0
    if (value.includes('¥0') || value === '0') {
      return 0;
    }

    // Otherwise assume it's a price - convert to months (rough estimate)
    const priceMatch = value.match(/(\d+)/);
    if (priceMatch) {
      const price = parseInt(priceMatch[1]);
      return price > 0 ? price / 100000 : 0; // Rough conversion
    }

    return undefined;
  }

  /**
   * Find station ID by name
   */
  private async findStationId(stationName: string): Promise<string | null> {
    try {
      // Try exact match first
      const exactStation = await this.db.station.findFirst({
        where: {
          OR: [
            { name: stationName },
            { nameJa: stationName },
          ],
        },
      });

      if (exactStation) return exactStation.id;

      // Try fuzzy matching
      const stations = await this.db.station.findMany({
        where: {
          OR: [
            { name: { contains: stationName } },
            { nameJa: { contains: stationName } },
          ],
        },
        take: 5,
      });

      if (stations.length === 1) {
        return stations[0].id;
      }

      // If multiple matches, try to find the best one
      if (stations.length > 1) {
        const bestMatch = stations.find(s => 
          s.name.toLowerCase() === stationName.toLowerCase() ||
          s.nameJa === stationName
        );
        if (bestMatch) return bestMatch.id;
      }

      return null;
    } catch (error) {
      console.error(`Error finding station ID for ${stationName}:`, error);
      return null;
    }
  }

  /**
   * Save apartment to database
   */
  private async saveApartment(apartment: ScrapedApartment): Promise<void> {
    const stationId = await this.findStationId(apartment.stationName);
    if (!stationId) {
      throw new Error(`Station not found: ${apartment.stationName}`);
    }

    // Check if apartment already exists
    const existing = await this.db.apartment.findUnique({
      where: { sourceUrl: apartment.sourceUrl },
    });

    const apartmentData = {
      sourceUrl: apartment.sourceUrl,
      sourceSite: apartment.sourceSite,
      sourceListingId: apartment.sourceListingId,
      title: apartment.title,
      buildingName: apartment.buildingName,
      unitNumber: apartment.unitNumber,
      rentMonthly: apartment.rentMonthly,
      managementFee: apartment.managementFee,
      keyMoney: apartment.keyMoney,
      deposit: apartment.deposit,
      size: apartment.size,
      sizeJo: apartment.sizeJo,
      layout: apartment.layout,
      layoutDetails: apartment.layoutDetails,
      prefecture: apartment.prefecture,
      city: apartment.city,
      ward: apartment.ward,
      address: apartment.address,
      addressDetails: apartment.addressDetails,
      buildingType: apartment.buildingType,
      buildingAge: apartment.buildingAge,
      buildYear: apartment.buildYear,
      totalFloors: apartment.totalFloors,
      floor: apartment.floor,
      features: apartment.features ? JSON.stringify(apartment.features) : null,
      nearbyFacilities: apartment.nearbyFacilities ? JSON.stringify(apartment.nearbyFacilities) : null,
      imageUrls: apartment.imageUrls ? JSON.stringify(apartment.imageUrls) : null,
      floorPlanUrl: apartment.floorPlanUrl,
      stationId,
      walkingMinutes: apartment.walkingMinutes,
      availableFrom: apartment.availableFrom,
      isAvailable: apartment.isAvailable,
      lastVerified: new Date(),
    };

    if (existing) {
      // Update existing apartment
      await this.db.apartment.update({
        where: { id: existing.id },
        data: apartmentData,
      });
    } else {
      // Create new apartment
      const newApartment = await this.db.apartment.create({
        data: apartmentData,
      });

      // Record initial price history
      await this.db.priceHistory.create({
        data: {
          apartmentId: newApartment.id,
          rentMonthly: apartment.rentMonthly,
          managementFee: apartment.managementFee,
        },
      });
    }
  }
}

export const dataImporter = new DataImporter(new PrismaClient());