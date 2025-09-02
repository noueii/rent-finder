import { JSDOM } from 'jsdom';
import { ScrapedApartment } from '../scraping-service';

export class AptsJpScraper {
  private baseUrl = 'https://apts.jp';
  private searchUrl = 'https://apts.jp/search';

  /**
   * Parse apartment data from apts.jp HTML
   */
  parseApartmentListing(html: string, sourceUrl: string): ScrapedApartment[] {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const apartments: ScrapedApartment[] = [];

    // Find all property listings
    const propertyElements = document.querySelectorAll('.property-card, .listing-item, .property-item');

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

  private parseApartmentElement(element: Element, sourceUrl: string): ScrapedApartment | null {
    try {
      // Extract basic information
      const titleElement = element.querySelector('.property-title, .listing-title, h3, h4');
      const title = titleElement?.textContent?.trim() || '';
      
      const buildingName = this.extractBuildingName(title);
      const unitNumber = this.extractUnitNumber(title);

      // Extract price information
      const priceElement = element.querySelector('.price, .rent, .monthly-rent');
      const priceText = priceElement?.textContent?.trim() || '';
      const rentMonthly = this.parsePrice(priceText);

      if (!rentMonthly || rentMonthly <= 0) {
        return null; // Skip invalid listings
      }

      // Extract size information
      const sizeElement = element.querySelector('.size, .area, .square-meters');
      const sizeText = sizeElement?.textContent?.trim() || '';
      const size = this.parseSize(sizeText);

      if (!size || size <= 0) {
        return null; // Skip invalid listings
      }

      // Extract layout
      const layoutElement = element.querySelector('.layout, .room-type, .bedroom');
      const layout = layoutElement?.textContent?.trim() || 'Unknown';

      // Extract location information
      const locationElement = element.querySelector('.location, .address');
      const locationText = locationElement?.textContent?.trim() || '';
      const { prefecture, city, address } = this.parseLocation(locationText);

      // Extract station information
      const stationElement = element.querySelector('.station, .nearest-station');
      const stationText = stationElement?.textContent?.trim() || '';
      const { stationName, walkingMinutes } = this.parseStation(stationText);

      if (!stationName) {
        return null; // Skip listings without station info
      }

      // Extract features
      const featuresElements = element.querySelectorAll('.feature, .amenity, .tag');
      const features: string[] = [];
      featuresElements.forEach(el => {
        const feature = el.textContent?.trim();
        if (feature) {
          features.push(feature);
        }
      });

      // Extract images
      const imageElements = element.querySelectorAll('img');
      const imageUrls: string[] = [];
      imageElements.forEach(img => {
        const src = img.getAttribute('src');
        if (src && src.startsWith('http')) {
          imageUrls.push(src);
        }
      });

      // Extract link
      const linkElement = element.querySelector('a');
      const propertyUrl = linkElement?.getAttribute('href') || sourceUrl;
      const fullUrl = propertyUrl.startsWith('http') ? propertyUrl : `${this.baseUrl}${propertyUrl}`;

      // Extract additional details
      const buildingAge = this.extractBuildingAge(element);
      const buildYear = this.extractBuildYear(element);
      const floor = this.extractFloor(element);
      const totalFloors = this.extractTotalFloors(element);

      return {
        sourceUrl: fullUrl,
        sourceSite: 'apts.jp',
        title,
        buildingName,
        unitNumber,
        rentMonthly,
        managementFee: this.extractManagementFee(element),
        keyMoney: this.extractKeyMoney(element),
        deposit: this.extractDeposit(element),
        size,
        layout,
        prefecture,
        city,
        address,
        buildingAge,
        buildYear,
        floor,
        totalFloors,
        features,
        imageUrls,
        stationName,
        walkingMinutes,
        isAvailable: true,
      };
    } catch (error) {
      console.warn('Error parsing apartment element:', error);
      return null;
    }
  }

  private extractBuildingName(title: string): string {
    // Try to extract building name from title
    // Common patterns: "Building Name Unit", "Building Name - Unit", etc.
    const parts = title.split(/[-–—\s]+/);
    return parts[0]?.trim() || title;
  }

  private extractUnitNumber(title: string): string | undefined {
    // Extract unit number from title
    const unitMatch = title.match(/(\d+[A-Z]?|\d+号室|[A-Z]\d+)$/);
    return unitMatch?.[1];
  }

  private parsePrice(priceText: string): number {
    // Parse price from text like "¥80,000", "80,000円", "80000"
    const cleanText = priceText.replace(/[¥円,\s]/g, '');
    const price = parseInt(cleanText);
    return isNaN(price) ? 0 : price;
  }

  private parseSize(sizeText: string): number {
    // Parse size from text like "20.47m²", "20.47 m2", "20.47 square meters"
    const sizeMatch = sizeText.match(/(\d+\.?\d*)/);
    const size = parseFloat(sizeMatch?.[1] || '0');
    return isNaN(size) ? 0 : size;
  }

  private parseLocation(locationText: string): {
    prefecture: string;
    city: string;
    address: string;
  } {
    // Parse location from text like "Edogawa-ku, Tokyo, Higashikoiwa 6-21-3"
    const parts = locationText.split(',').map(p => p.trim());
    
    let prefecture = 'Tokyo';
    let city = '';
    let address = locationText;

    if (parts.length >= 2) {
      // Find Tokyo in the parts
      const tokyoIndex = parts.findIndex(p => p.includes('Tokyo'));
      if (tokyoIndex >= 0) {
        prefecture = 'Tokyo';
        city = parts[tokyoIndex - 1] || parts[0];
        address = parts.slice(tokyoIndex + 1).join(', ') || locationText;
      } else {
        city = parts[0];
        address = parts.slice(1).join(', ');
      }
    }

    return { prefecture, city, address };
  }

  private parseStation(stationText: string): {
    stationName: string;
    walkingMinutes: number;
  } {
    // Parse station from text like "Edogawa Station (10 min walk)", "Edogawa 10分"
    const stationMatch = stationText.match(/([^(]+)/);
    const stationName = stationMatch?.[1]?.trim().replace(/\s+Station$/i, '') || '';
    
    const minutesMatch = stationText.match(/(\d+)\s*(?:min|分)/);
    const walkingMinutes = parseInt(minutesMatch?.[1] || '5');

    return {
      stationName,
      walkingMinutes: isNaN(walkingMinutes) ? 5 : walkingMinutes,
    };
  }

  private extractBuildingAge(element: Element): number | undefined {
    const ageElement = element.querySelector('.age, .building-age, .years-old');
    if (!ageElement) return undefined;

    const ageText = ageElement.textContent?.trim() || '';
    const ageMatch = ageText.match(/(\d+)\s*(?:years?|年)/);
    const age = parseInt(ageMatch?.[1] || '0');
    return isNaN(age) ? undefined : age;
  }

  private extractBuildYear(element: Element): number | undefined {
    const yearElement = element.querySelector('.year-built, .built-year');
    if (!yearElement) return undefined;

    const yearText = yearElement.textContent?.trim() || '';
    const yearMatch = yearText.match(/(\d{4})/);
    const year = parseInt(yearMatch?.[1] || '0');
    return isNaN(year) || year < 1900 ? undefined : year;
  }

  private extractFloor(element: Element): string | undefined {
    const floorElement = element.querySelector('.floor, .floor-number');
    if (!floorElement) return undefined;

    const floorText = floorElement.textContent?.trim() || '';
    const floorMatch = floorText.match(/(\d+)(?:F|階|floor)/i);
    return floorMatch?.[1];
  }

  private extractTotalFloors(element: Element): number | undefined {
    const totalElement = element.querySelector('.total-floors, .building-floors');
    if (!totalElement) return undefined;

    const totalText = totalElement.textContent?.trim() || '';
    const totalMatch = totalText.match(/(\d+)(?:F|階|floors?)/i);
    const total = parseInt(totalMatch?.[1] || '0');
    return isNaN(total) ? undefined : total;
  }

  private extractManagementFee(element: Element): number | undefined {
    const feeElement = element.querySelector('.management-fee, .common-fee');
    if (!feeElement) return undefined;

    const feeText = feeElement.textContent?.trim() || '';
    const fee = this.parsePrice(feeText);
    return fee > 0 ? fee : undefined;
  }

  private extractKeyMoney(element: Element): number | undefined {
    const keyElement = element.querySelector('.key-money, .reikin');
    if (!keyElement) return undefined;

    const keyText = keyElement.textContent?.trim() || '';
    const monthsMatch = keyText.match(/(\d+\.?\d*)\s*(?:months?|ヶ月)/);
    const months = parseFloat(monthsMatch?.[1] || '0');
    return isNaN(months) ? undefined : months;
  }

  private extractDeposit(element: Element): number | undefined {
    const depositElement = element.querySelector('.deposit, .shikikin');
    if (!depositElement) return undefined;

    const depositText = depositElement.textContent?.trim() || '';
    const monthsMatch = depositText.match(/(\d+\.?\d*)\s*(?:months?|ヶ月)/);
    const months = parseFloat(monthsMatch?.[1] || '0');
    return isNaN(months) ? undefined : months;
  }

  /**
   * Generate search URLs for apts.jp
   */
  generateSearchUrls(stationName?: string): string[] {
    const baseUrls = [
      `${this.searchUrl}?location=tokyo`,
      `${this.searchUrl}?location=tokyo&sort=price`,
      `${this.searchUrl}?location=tokyo&sort=size`,
    ];

    if (stationName) {
      baseUrls.push(`${this.searchUrl}?station=${encodeURIComponent(stationName)}`);
    }

    return baseUrls;
  }
}

export const aptsJpScraper = new AptsJpScraper();