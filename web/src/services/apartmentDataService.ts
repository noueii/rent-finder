import fs from 'fs/promises';
import path from 'path';

export interface UnifiedApartment {
  id: string;
  source: string;
  sourceId: string;
  url: string;
  
  building: {
    name: string;
    nameJa: string;
    type: string;
    yearBuilt: number | null;
    totalFloors: number | null;
    totalUnits: number | null;
    structure: string;
    features: string[];
  };
  
  unit: {
    title: string;
    roomNumber: string;
    floor: number | null;
    layout: string;
    layoutType: string;
    bedrooms: number;
    hasLivingRoom: boolean;
    hasDiningKitchen: boolean;
    hasKitchen: boolean;
    hasServiceRoom: boolean;
  };
  
  size: {
    totalArea: number;
    unit: string;
    balconyArea: number;
    hasBalcony: boolean;
  };
  
  location: {
    address: string;
    area: string;
    ward: string;
    wardJa: string;
    city: string;
    prefecture: string;
    postalCode: string;
    coordinates: {
      latitude: number | null;
      longitude: number | null;
    };
  };
  
  pricing: {
    monthlyRent: number;
    deposit: number;
    keyMoney: number;
    guaranteeFee: number;
    managementFee: number;
    commonServiceFee: number;
    parkingFee: number;
    initialCost: number;
    totalMonthlyCost: number;
  };
  
  stations: Array<{
    name: string;
    line: string;
    walkingMinutes: number;
    distance?: number | null;
    stationId?: string | null;
    matchedWith?: string;
    matchedWithJa?: string;
    matchStatus?: string;
  }>;
  
  features: string[];
  amenities: string[];
  
  images: {
    main: string[];
    floorPlan: string;
    all: string[];
  };
  
  availability: {
    status: string;
    availableFrom: string | null;
    moveInDate: string | null;
    lastUpdated: string | null;
  };
  
  agency: {
    name: string;
    contact: string;
    phone: string;
    email: string;
  };
  
  metadata: {
    scrapedAt: string;
    lastModified: string;
    dataVersion: string;
  };
}

export interface ApartmentData {
  metadata: {
    createdAt: string;
    totalApartments: number;
    sources: string[];
    stats: any;
    dataVersion: string;
    stationMatching?: {
      processedAt: string;
      totalStations: number;
      matched: number;
      unmatched: number;
      matchRate: string;
      unmatchedStations?: string[];
      unmatchedDetails?: any[];
    };
  };
  apartments: UnifiedApartment[];
}

export interface ApartmentSearchFilters {
  minPrice?: number;
  maxPrice?: number;
  minSize?: number;
  maxSize?: number;
  layout?: string[];
  wards?: string[];
  features?: string[];
  buildingType?: string;
  maxBuildingAge?: number;
  petsAllowed?: boolean;
  maxWalkingMinutes?: number;
  stationIds?: string[];
  commuteStationId?: string;
  maxCommuteTime?: number;
}

class ApartmentDataService {
  private data: ApartmentData | null = null;
  private dataPath: string;
  private lastLoadTime: number = 0;
  private cacheTimeout: number = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Look for the most recent unified apartment file
    this.dataPath = this.findLatestDataFile();
  }

  private findLatestDataFile(): string {
    const aptDictPath = path.join(process.cwd(), '../apt-dict-builder');
    try {
      const files = fs.readdirSync(aptDictPath);
      const unifiedFiles = files
        .filter(f => f.startsWith('unified_apartments_') && f.endsWith('.json'))
        .sort()
        .reverse();
      
      if (unifiedFiles.length > 0) {
        return path.join(aptDictPath, unifiedFiles[0]);
      }
    } catch (error) {
      console.error('Error finding apartment data file:', error);
    }
    
    // Fallback path
    return path.join(process.cwd(), '../apt-dict-builder/unified_apartments.json');
  }

  async loadData(forceReload = false): Promise<ApartmentData> {
    const now = Date.now();
    
    // Return cached data if still valid
    if (!forceReload && this.data && (now - this.lastLoadTime) < this.cacheTimeout) {
      return this.data;
    }

    try {
      const fileContent = await fs.readFile(this.dataPath, 'utf-8');
      this.data = JSON.parse(fileContent);
      this.lastLoadTime = now;
      
      console.log(`Loaded ${this.data.apartments.length} apartments from ${path.basename(this.dataPath)}`);
      if (this.data.metadata.stationMatching) {
        console.log(`Station matching: ${this.data.metadata.stationMatching.matchRate} success rate`);
      }
      
      return this.data;
    } catch (error) {
      console.error('Error loading apartment data:', error);
      throw new Error('Failed to load apartment data');
    }
  }

  async searchApartments(filters: ApartmentSearchFilters): Promise<UnifiedApartment[]> {
    const data = await this.loadData();
    let results = [...data.apartments];

    // Price filter
    if (filters.minPrice !== undefined) {
      results = results.filter(apt => apt.pricing.monthlyRent >= filters.minPrice!);
    }
    if (filters.maxPrice !== undefined) {
      results = results.filter(apt => apt.pricing.monthlyRent <= filters.maxPrice!);
    }

    // Size filter
    if (filters.minSize !== undefined) {
      results = results.filter(apt => apt.size.totalArea >= filters.minSize!);
    }
    if (filters.maxSize !== undefined) {
      results = results.filter(apt => apt.size.totalArea <= filters.maxSize!);
    }

    // Layout filter
    if (filters.layout && filters.layout.length > 0) {
      results = results.filter(apt => filters.layout!.includes(apt.unit.layout));
    }

    // Ward filter
    if (filters.wards && filters.wards.length > 0) {
      results = results.filter(apt => filters.wards!.includes(apt.location.ward));
    }

    // Features filter
    if (filters.features && filters.features.length > 0) {
      results = results.filter(apt => 
        filters.features!.every(feature => 
          apt.features.includes(feature) || apt.amenities.includes(feature)
        )
      );
    }

    // Building age filter
    if (filters.maxBuildingAge !== undefined) {
      const currentYear = new Date().getFullYear();
      results = results.filter(apt => {
        if (!apt.building.yearBuilt) return true;
        return (currentYear - apt.building.yearBuilt) <= filters.maxBuildingAge!;
      });
    }

    // Walking distance filter
    if (filters.maxWalkingMinutes !== undefined) {
      results = results.filter(apt => 
        apt.stations.some(station => station.walkingMinutes <= filters.maxWalkingMinutes!)
      );
    }

    // Station filter
    if (filters.stationIds && filters.stationIds.length > 0) {
      results = results.filter(apt =>
        apt.stations.some(station => 
          station.stationId && filters.stationIds!.includes(station.stationId)
        )
      );
    }

    // Commute time filter (requires transit graph integration)
    if (filters.commuteStationId && filters.maxCommuteTime) {
      // This will be implemented with the transit graph service
      // For now, just filter by direct station connections
      results = results.filter(apt =>
        apt.stations.some(station => 
          station.stationId === filters.commuteStationId
        )
      );
    }

    return results;
  }

  async getApartmentById(id: string): Promise<UnifiedApartment | null> {
    const data = await this.loadData();
    return data.apartments.find(apt => apt.id === id) || null;
  }

  async getUnmatchedStations(): Promise<any[]> {
    const data = await this.loadData();
    return data.metadata.stationMatching?.unmatchedDetails || [];
  }

  async getStatistics(): Promise<any> {
    const data = await this.loadData();
    return {
      totalApartments: data.metadata.totalApartments,
      sources: data.metadata.sources,
      stats: data.metadata.stats,
      stationMatching: data.metadata.stationMatching
    };
  }
}

// Export singleton instance
export const apartmentDataService = new ApartmentDataService();