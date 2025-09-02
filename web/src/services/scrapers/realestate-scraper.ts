import { JSDOM } from 'jsdom';
import fetch from 'node-fetch';

interface ScrapedApartment {
  sourceUrl: string;
  sourceSite: string;
  title: string;
  buildingName?: string;
  unitNumber?: string;
  rentMonthly: number;
  keyMoney?: number;
  deposit?: number;
  size: number;
  layout: string;
  prefecture: string;
  city: string;
  ward?: string;
  address: string;
  buildingAge?: number;
  buildYear?: number;
  floor?: string;
  totalFloors?: number;
  features: string[];
  imageUrls: string[];
  stationName?: string;
  stationId?: string;
  walkingMinutes?: number;
  isAvailable: boolean;
}

interface SearchParams {
  prefecture?: string;
  minPrice?: number;
  maxPrice?: number;
  minSize?: number;
  rooms?: number;
  walkingDistance?: number;
  buildingAge?: number;
  targetStations?: string[];
}

export class RealEstateScraper {
  private baseUrl = 'https://realestate.co.jp';

  /**
   * Main scraping method - fetches apartments from realestate.co.jp
   */
  async scrapeApartments(params: SearchParams): Promise<ScrapedApartment[]> {
    const apartments: ScrapedApartment[] = [];
    
    console.log('🔍 Starting apartment scraping with params:', params);
    
    try {
      // For demo purposes, return mock data since we can't scrape the actual site
      // In a real implementation, this would make HTTP requests to realestate.co.jp
      
      const mockApartments = this.generateMockApartments(params);
      
      console.log(`✅ Generated ${mockApartments.length} mock apartments`);
      return mockApartments;
      
    } catch (error) {
      console.error('❌ Scraping failed:', error);
      throw new Error(`Scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate mock apartment data for testing
   */
  private generateMockApartments(params: SearchParams): ScrapedApartment[] {
    const mockApartments: ScrapedApartment[] = [];
    
    // Mock station data
    const stations = [
      { name: 'Shibuya', id: '00006662' },
      { name: 'Shinjuku', id: '00006663' },
      { name: 'Tokyo', id: '00006668' },
      { name: 'Ikebukuro', id: '00006664' },
      { name: 'Harajuku', id: '00006665' },
      { name: 'Ginza', id: '00006666' },
      { name: 'Akihabara', id: '00006667' },
      { name: 'Ueno', id: '00006669' },
    ];

    // Mock layouts
    const layouts = ['1R', '1K', '1DK', '1LDK', '2K', '2DK', '2LDK', '3K', '3DK', '3LDK'];
    
    // Mock features
    const features = [
      'Air Conditioning', 'Balcony', 'Parking', 'Elevator', 'Security',
      'Pet Friendly', 'Internet', 'Furnished', 'Washing Machine', 'Bike Parking'
    ];

    // Generate apartments based on filters
    const count = Math.floor(Math.random() * 20) + 5; // 5-25 apartments
    
    for (let i = 0; i < count; i++) {
      const station = stations[Math.floor(Math.random() * stations.length)];
      const layout = layouts[Math.floor(Math.random() * layouts.length)];
      const basePrice = 80000 + Math.floor(Math.random() * 150000);
      const size = 20 + Math.floor(Math.random() * 50);
      const walkingMinutes = 3 + Math.floor(Math.random() * 15);
      const buildingAge = Math.floor(Math.random() * 40);
      const apartmentFeatures = features
        .sort(() => 0.5 - Math.random())
        .slice(0, Math.floor(Math.random() * 4) + 1);
      
      // Apply price filter
      if (params.minPrice && basePrice < params.minPrice) continue;
      if (params.maxPrice && basePrice > params.maxPrice) continue;
      
      // Apply size filter
      if (params.minSize && size < params.minSize) continue;
      
      // Apply walking distance filter
      if (params.walkingDistance && walkingMinutes > params.walkingDistance) continue;
      
      // Apply building age filter
      if (params.buildingAge && buildingAge > params.buildingAge) continue;
      
      // Apply target stations filter
      if (params.targetStations && params.targetStations.length > 0) {
        if (!params.targetStations.includes(station.id)) continue;
      }

      const apartment: ScrapedApartment = {
        sourceUrl: `https://realestate.co.jp/en/rent/view/${1000000 + i}`,
        sourceSite: 'realestate.co.jp',
        title: `${layout} Modern Apartment near ${station.name}`,
        buildingName: `${station.name} Heights`,
        rentMonthly: basePrice,
        deposit: Math.floor(basePrice * 1.5),
        keyMoney: Math.floor(basePrice * 0.5),
        size,
        layout,
        prefecture: 'Tokyo',
        city: 'Tokyo',
        address: `${i + 1}-${Math.floor(Math.random() * 20) + 1}-${Math.floor(Math.random() * 10) + 1}`,
        buildingAge,
        buildYear: 2024 - buildingAge,
        floor: `${Math.floor(Math.random() * 10) + 1}F`,
        features: apartmentFeatures,
        imageUrls: [
          `https://realestate.co.jp/images/apartment${i + 1}_1.jpg`,
          `https://realestate.co.jp/images/apartment${i + 1}_2.jpg`,
        ],
        stationName: station.name,
        stationId: station.id,
        walkingMinutes,
        isAvailable: true,
      };

      mockApartments.push(apartment);
    }

    console.log(`📊 Generated ${mockApartments.length} mock apartments matching filters`);
    return mockApartments;
  }

  /**
   * Parse apartment data from realestate.co.jp HTML
   */
  parseApartmentListing(html: string, sourceUrl: string): ScrapedApartment[] {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const apartments: ScrapedApartment[] = [];

    // Find all property listings based on the existing scraper patterns
    const propertyElements = document.querySelectorAll('.property-listing, .listing-item, .property-card');

    if (propertyElements.length === 0) {
      // Try alternative selectors if no listings found
      const alternativeSelectors = [
        'div[class*="listing"]',
        'div[class*="property"]',
        'a[href*="/rent/view/"]',
        '.search-result-item',
        '.property-item'
      ];
      
      for (const selector of alternativeSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          console.log(`Found ${elements.length} listings using selector: ${selector}`);
          break;
        }
      }
    }

    for (const element of propertyElements) {
      try {
        const apartment = this.parseApartmentElement(element as Element, sourceUrl);
        if (apartment) {
          apartments.push(apartment);
        }
      } catch (error) {
        console.warn('Failed to parse apartment element:', error);
      }
    }

    return apartments;
  }

  /**
   * Check if there are more pages available for pagination
   */
  hasNextPage(html: string): boolean {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // Look for pagination indicators
    const paginationSelectors = [
      '.pagination .next',
      '.pagination a[href*="page="]',
      'a[href*="page="]',
      '.next-page',
      '.load-more'
    ];
    
    for (const selector of paginationSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        return true;
      }
    }
    
    // Check if results count indicates more pages
    const resultsText = document.querySelector('.results-count, .search-results-count')?.textContent;
    if (resultsText) {
      const match = resultsText.match(/(\d+)\s*-\s*(\d+)\s*of\s*(\d+)/);
      if (match) {
        const [, , currentEnd, total] = match;
        return parseInt(currentEnd) < parseInt(total);
      }
    }
    
    return false;
  }

  private parseApartmentElement(element: Element, sourceUrl: string): ScrapedApartment | null {
    try {
      // Extract title - based on existing scraper pattern
      const titleElement = element.querySelector('.listing-title .text-semi-strong, .property-title, h3, h4');
      const title = titleElement?.textContent?.trim() || '';
      
      if (!title) {
        return null; // Skip listings without title
      }

      const buildingName = this.extractBuildingName(title);
      const unitNumber = this.extractUnitNumber(title);

      // Extract location - based on existing scraper pattern
      const locationContainer = element.querySelector('.listing-title span:not(.text-semi-strong)');
      const locationParts = locationContainer?.innerHTML.split('<br/>') || [];
      
      const area = locationParts[0]?.replace('in', '').trim() || '';
      const ward = locationParts[1]?.trim() || '';
      
      const { prefecture, city, address } = this.parseLocation(area, ward);

      // Extract link
      const linkElement = element.querySelector('.listing-title a, a');
      const propertyUrl = linkElement?.getAttribute('href') || sourceUrl;
      const fullUrl = propertyUrl.startsWith('http') ? propertyUrl : `${this.baseUrl}${propertyUrl}`;

      // Extract monthly costs
      const monthlySpan = element.querySelector('span')?.textContent;
      const monthlyCost = this.findNextSibling(element, 'Monthly Costs');
      const rentMonthly = this.parsePrice(monthlyCost);

      if (!rentMonthly || rentMonthly <= 0) {
        return null; // Skip invalid listings
      }

      // Extract availability
      const availabilityElement = element.querySelector('.text-success');
      const availability = availabilityElement?.textContent?.trim() || 'Not specified';
      const isAvailable = availability.toLowerCase().includes('available');

      // Extract size
      const sizeText = this.findNextSibling(element, 'Size');
      const size = this.parseSize(sizeText);

      if (!size || size <= 0) {
        return null; // Skip invalid listings
      }

      // Extract layout from title (common pattern: "1LDK Apartment", "2K Apartment")
      const layout = this.extractLayout(title);

      // Extract deposit and key money
      const deposit = this.parseDeposit(this.findNextSibling(element, 'Deposit'));
      const keyMoney = this.parseKeyMoney(this.findNextSibling(element, 'Key Money'));

      // Extract floor information
      const floorText = this.findNextSibling(element, 'Floor');
      const { floor, totalFloors } = this.parseFloor(floorText);

      // Extract year built
      const yearBuiltText = this.findNextSibling(element, 'Year Built');
      const buildYear = this.parseYear(yearBuiltText);
      const buildingAge = buildYear ? new Date().getFullYear() - buildYear : undefined;

      // Extract nearest station
      const stationText = this.findNextSibling(element, 'Nearest Station');
      const { stationName, walkingMinutes } = this.parseStation(stationText);

      if (!stationName) {
        return null; // Skip listings without station info
      }

      // Extract features (common amenities)
      const features = this.extractFeatures(element);

      // Extract images
      const imageUrls = this.extractImages(element);

      return {
        sourceUrl: fullUrl,
        sourceSite: 'realestate.co.jp',
        title,
        buildingName,
        unitNumber,
        rentMonthly,
        keyMoney,
        deposit,
        size,
        layout,
        prefecture,
        city,
        ward,
        address,
        buildingAge,
        buildYear,
        floor,
        totalFloors,
        features,
        imageUrls,
        stationName,
        walkingMinutes,
        isAvailable,
      };
    } catch (error) {
      console.warn('Error parsing apartment element:', error);
      return null;
    }
  }

  private findNextSibling(element: Element, spanText: string): string {
    // Search for span with text content (CSS :contains is not supported in jsdom)
    const spans = element.querySelectorAll('span');
    for (const span of spans) {
      if (span.textContent?.includes(spanText)) {
        // Check next sibling node
        let nextNode = span.nextSibling;
        while (nextNode) {
          if (nextNode.nodeType === 3) { // Text node
            const text = nextNode.textContent?.trim();
            if (text) return text;
          } else if (nextNode.nodeType === 1) { // Element node
            const text = (nextNode as Element).textContent?.trim();
            if (text) return text;
          }
          nextNode = nextNode.nextSibling;
        }
      }
    }
    return '';
  }

  private extractBuildingName(title: string): string {
    // Extract building name from title like "1LDK Apartment" -> "Apartment"
    // Or from more complex titles
    const parts = title.split(/\s+/);
    return parts.slice(1).join(' ') || title;
  }

  private extractUnitNumber(title: string): string | undefined {
    // Extract unit number if present in title
    const unitMatch = title.match(/(\d+[A-Z]?|\d+号室|[A-Z]\d+)$/);
    return unitMatch?.[1];
  }

  private parseLocation(area: string, ward: string): {
    prefecture: string;
    city: string;
    address: string;
  } {
    // Parse location from area and ward
    let prefecture = 'Tokyo';
    let city = ward;
    let address = area;

    // Extract city from ward if it contains "-ku"
    if (ward.includes('-ku')) {
      city = ward.replace(', Tokyo', '');
    }

    // Clean up address
    address = area || ward;

    return { prefecture, city, address };
  }

  private parsePrice(priceText: string): number {
    // Parse price from text like "¥120,000", "120000", etc.
    const cleanText = priceText.replace(/[¥円,\s]/g, '');
    const price = parseInt(cleanText);
    return isNaN(price) ? 0 : price;
  }

  private parseSize(sizeText: string): number {
    // Parse size from text like "30.06 m²", "30.06 square meters"
    const sizeMatch = sizeText.match(/(\d+\.?\d*)/);
    const size = parseFloat(sizeMatch?.[1] || '0');
    return isNaN(size) ? 0 : size;
  }

  private extractLayout(title: string): string {
    // Extract layout from title like "1LDK Apartment", "2K Apartment"
    const layoutMatch = title.match(/(\d+[SLDK]+)/i);
    return layoutMatch?.[1] || 'Unknown';
  }

  private parseDeposit(depositText: string): number | undefined {
    // Parse deposit from text like "¥0", "¥240,000", "2 months"
    if (depositText.includes('¥')) {
      const price = this.parsePrice(depositText);
      return price > 0 ? price : 0;
    }
    
    const monthsMatch = depositText.match(/(\d+\.?\d*)\s*(?:months?|ヶ月)/);
    const months = parseFloat(monthsMatch?.[1] || '0');
    return isNaN(months) ? undefined : months;
  }

  private parseKeyMoney(keyText: string): number | undefined {
    // Parse key money from text like "¥0", "¥240,000", "2 months"
    if (keyText.includes('¥')) {
      const price = this.parsePrice(keyText);
      return price > 0 ? price : 0;
    }
    
    const monthsMatch = keyText.match(/(\d+\.?\d*)\s*(?:months?|ヶ月)/);
    const months = parseFloat(monthsMatch?.[1] || '0');
    return isNaN(months) ? undefined : months;
  }

  private parseFloor(floorText: string): {
    floor: string | undefined;
    totalFloors: number | undefined;
  } {
    // Parse floor from text like "4 / 4F", "3 / 10F"
    const floorMatch = floorText.match(/(\d+)\s*\/\s*(\d+)F?/);
    
    const floor = floorMatch?.[1];
    const totalFloors = parseInt(floorMatch?.[2] || '0');
    
    return {
      floor,
      totalFloors: isNaN(totalFloors) ? undefined : totalFloors,
    };
  }

  private parseYear(yearText: string): number | undefined {
    // Parse year from text like "2014", "Built in 2014"
    const yearMatch = yearText.match(/(\d{4})/);
    const year = parseInt(yearMatch?.[1] || '0');
    return isNaN(year) || year < 1900 ? undefined : year;
  }

  private parseStation(stationText: string): {
    stationName: string;
    walkingMinutes: number;
  } {
    // Parse station from text like "Ikegami Station (7 min. walk)"
    const stationMatch = stationText.match(/([^(]+)/);
    const stationName = stationMatch?.[1]?.trim().replace(/\s+Station$/i, '') || '';
    
    const minutesMatch = stationText.match(/(\d+)\s*min/);
    const walkingMinutes = parseInt(minutesMatch?.[1] || '5');

    return {
      stationName,
      walkingMinutes: isNaN(walkingMinutes) ? 5 : walkingMinutes,
    };
  }

  private extractFeatures(element: Element): string[] {
    const features: string[] = [];
    
    // Common features to look for
    const featureSelectors = [
      '.amenity', '.feature', '.tag', '.badge',
      '*[class*="amenity"]', '*[class*="feature"]'
    ];

    for (const selector of featureSelectors) {
      const featureElements = element.querySelectorAll(selector);
      featureElements.forEach(el => {
        const feature = el.textContent?.trim();
        if (feature && !features.includes(feature)) {
          features.push(feature);
        }
      });
    }

    // Add common features based on text content
    const textContent = element.textContent?.toLowerCase() || '';
    const commonFeatures = [
      'Air Conditioning', 'Balcony', 'Parking', 'Elevator', 'Security',
      'Pet Friendly', 'Internet', 'Furnished', 'Washing Machine'
    ];

    for (const feature of commonFeatures) {
      if (textContent.includes(feature.toLowerCase()) && !features.includes(feature)) {
        features.push(feature);
      }
    }

    return features;
  }

  private extractImages(element: Element): string[] {
    const imageUrls: string[] = [];
    const imageElements = element.querySelectorAll('img');
    
    imageElements.forEach(img => {
      const src = img.getAttribute('src');
      if (src && src.startsWith('http')) {
        imageUrls.push(src);
      }
    });

    return imageUrls;
  }

  /**
   * Generate search URLs for realestate.co.jp with proper parameters
   */
  generateSearchUrls(options: {
    stationId?: string;
    trainlineId?: string;
    minPrice?: number;
    maxPrice?: number;
    minSize?: number;
    maxRooms?: number;
    maxWalkingDistance?: number;
    maxBuildingAge?: number;
    sortBy?: 'price' | 'size' | 'date' | 'relevance';
  } = {}): string[] {
    const {
      stationId,
      trainlineId,
      minPrice,
      maxPrice,
      minSize,
      maxRooms,
      maxWalkingDistance,
      maxBuildingAge,
      sortBy = 'relevance'
    } = options;

    const baseParams = new URLSearchParams({
      prefecture: 'JP-13', // Tokyo
      city: '',
      agent_id: '',
      building_type: '',
      updated_within: '',
      transaction_type: '',
      order: this.getSortOrder(sortBy),
      search: 'Search'
    });

    // Add optional parameters
    if (stationId) baseParams.set('station', stationId);
    if (trainlineId) baseParams.set('trainline', trainlineId);
    if (minPrice) baseParams.set('min_price', minPrice.toString());
    if (maxPrice) baseParams.set('max_price', maxPrice.toString());
    if (minSize) baseParams.set('min_meter', minSize.toString());
    if (maxRooms) baseParams.set('rooms', maxRooms.toString());
    if (maxWalkingDistance) baseParams.set('distance_station', maxWalkingDistance.toString());
    if (maxBuildingAge) baseParams.set('building_age', maxBuildingAge.toString());

    const searchUrl = `${this.baseUrl}/en/rent?${baseParams.toString()}`;
    
    // Generate pagination URLs (if needed)
    const urls = [searchUrl];
    
    // Add pagination pages (realestate.co.jp typically shows 20 results per page)
    for (let page = 2; page <= 5; page++) {
      const paginationParams = new URLSearchParams(baseParams);
      paginationParams.set('page', page.toString());
      urls.push(`${this.baseUrl}/en/rent?${paginationParams.toString()}`);
    }

    return urls;
  }

  private getSortOrder(sortBy: string): string {
    switch (sortBy) {
      case 'price': return 'price_asc';
      case 'size': return 'size_desc';
      case 'date': return 'date_desc';
      default: return 'relevance';
    }
  }
}

export const realEstateScraper = new RealEstateScraper();