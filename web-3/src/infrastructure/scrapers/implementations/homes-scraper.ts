/**
 * Homes.co.jp Scraper Implementation
 * Example of how to use the unified base scraper
 */

import * as cheerio from 'cheerio';
import {
  BaseScraper,
  SCRAPER_CONFIGS
} from '../base';
import type {
  BaseApartment,
  ScrapeParams,
  ScraperSelectors,
  StationInfo
} from '../base';

interface HomesApartment extends BaseApartment {
  buildingId?: string;
  roomCount?: number;
}

export class HomesScraper extends BaseScraper<HomesApartment> {
  constructor() {
    super(SCRAPER_CONFIGS.homes || {
      mode: 'fast',
      rateLimit: {
        requests: 30,
        perSeconds: 60,
        burst: 5
      },
      maxRetries: 3,
      retryDelay: 1000,
      retryBackoff: 'exponential',
      concurrency: 3,
      requestTimeout: 30000,
      totalTimeout: 600000,
      features: {
        screenshots: false,
        cache: true,
        proxy: false
      }
    });
  }
  
  protected getScraperName(): string {
    return 'homes';
  }
  
  protected async buildUrls(params: ScrapeParams): Promise<string[]> {
    const { prefecture, city, trainLines, priceRange } = params;
    const baseUrl = 'https://www.homes.co.jp/chintai/tokyo/list/';
    
    const urls: string[] = [];
    
    // Build URLs based on parameters
    if (trainLines && trainLines.length > 0) {
      // Build URLs for each train line
      trainLines.forEach(line => {
        const encoded = this.encodeHomesTrainLine(line);
        urls.push(`${baseUrl}?railway=${encoded}`);
      });
    } else if (city) {
      // Build URL for city search
      urls.push(`${baseUrl}?city=${encodeURIComponent(city)}`);
    } else {
      // Default to Tokyo search
      urls.push(baseUrl);
    }
    
    // Add price range if specified
    if (priceRange) {
      urls.forEach((url, index) => {
        const separator = url.includes('?') ? '&' : '?';
        urls[index] = `${url}${separator}price_min=${priceRange.min}&price_max=${priceRange.max}`;
      });
    }
    
    return urls;
  }
  
  protected extractListingUrls(html: string): string[] {
    const $ = cheerio.load(html);
    const urls: string[] = [];
    
    // Homes-specific selectors for listing URLs
    $('.mod-mergeBuilding').each((_: number, element: any) => {
      const href = $(element).find('h2.object-header a').attr('href');
      if (href) {
        // Convert relative URLs to absolute
        const absoluteUrl = href.startsWith('http') 
          ? href 
          : `https://www.homes.co.jp${href}`;
        urls.push(absoluteUrl);
      }
    });
    
    // Also check for pagination
    const nextPageUrl = $('a.next-page').attr('href');
    if (nextPageUrl) {
      const absoluteUrl = nextPageUrl.startsWith('http')
        ? nextPageUrl
        : `https://www.homes.co.jp${nextPageUrl}`;
      urls.push(absoluteUrl);
    }
    
    return urls;
  }
  
  protected extractApartmentData(html: string, url: string): HomesApartment {
    const $ = cheerio.load(html);
    const selectors = this.getSelectors();
    
    // Extract basic information
    const apartment: HomesApartment = {
      id: this.generateHomesId($),
      url,
      title: $(selectors.title).text().trim(),
      rent: this.parseHomesPrice($(selectors.rent).text()),
      size: this.parseSize($(selectors.size).text()),
      layout: $(selectors.layout).text().trim(),
      buildingType: this.extractBuildingType($),
      age: this.parseAge($(selectors.age).text()),
      floor: $(selectors.floor).text().trim(),
      address: $(selectors.address).text().trim(),
      station: this.extractStationInfo($),
      coordinates: this.extractCoordinates($),
      images: this.extractImages($),
      features: this.extractFeatures($),
      management: this.parseHomesPrice($(selectors.management).text()),
      deposit: this.parseHomesDeposit($(selectors.deposit).text()),
      keyMoney: this.parseHomesKeyMoney($(selectors.keyMoney).text()),
      agent: 'Homes.co.jp',
      scrapedAt: new Date(),
      source: 'homes',
      // Homes-specific fields
      buildingId: this.extractBuildingId($),
      roomCount: this.extractRoomCount($)
    };
    
    return apartment;
  }
  
  protected getSelectors(): ScraperSelectors {
    return {
      title: 'h1.object-header__title',
      rent: '.price-main .price',
      size: '.floor-plan .area',
      layout: '.floor-plan .plan',
      buildingType: '.building-type',
      age: '.building-age',
      floor: '.floor-info',
      address: '.address',
      station: '.traffic-info',
      management: '.management-fee',
      deposit: '.deposit',
      keyMoney: '.key-money'
    };
  }
  
  // Homes-specific helper methods (the 15% unique logic)
  private encodeHomesTrainLine(line: string): string {
    // Homes has specific encoding for train lines
    const lineMap: Record<string, string> = {
      'Yamanote Line': 'jre_yamanote',
      'Chuo Line': 'jre_chuo',
      'Sobu Line': 'jre_sobu',
      'Keihin-Tohoku Line': 'jre_keihin_tohoku',
      'Saikyo Line': 'jre_saikyo',
      'Marunouchi Line': 'tokyo_metro_marunouchi',
      'Ginza Line': 'tokyo_metro_ginza',
      'Hibiya Line': 'tokyo_metro_hibiya',
      'Tozai Line': 'tokyo_metro_tozai',
      'Chiyoda Line': 'tokyo_metro_chiyoda',
      'Yurakucho Line': 'tokyo_metro_yurakucho',
      'Hanzomon Line': 'tokyo_metro_hanzomon',
      'Namboku Line': 'tokyo_metro_namboku',
      'Fukutoshin Line': 'tokyo_metro_fukutoshin'
    };
    
    return lineMap[line] || encodeURIComponent(line);
  }
  
  private parseHomesPrice(text: string): number {
    // Homes format: "5.8万円" or "58,000円"
    const normalized = text.replace(/[,、]/g, '').trim();
    
    // Check for 万円 format
    const manMatch = normalized.match(/([\d.]+)万円/);
    if (manMatch && manMatch[1]) {
      return parseFloat(manMatch[1]) * 10000;
    }
    
    // Check for regular 円 format
    const yenMatch = normalized.match(/([\d]+)円/);
    if (yenMatch && yenMatch[1]) {
      return parseInt(yenMatch[1], 10);
    }
    
    return 0;
  }
  
  private parseSize(text: string): number {
    // Format: "25.5㎡" or "25.5m²"
    const match = text.match(/([\d.]+)/);
    return match && match[1] ? parseFloat(match[1]) : 0;
  }
  
  private parseAge(text: string): number {
    // Format: "築5年" or "2018年築"
    const chikuMatch = text.match(/築(\d+)年/);
    if (chikuMatch && chikuMatch[1]) {
      return parseInt(chikuMatch[1], 10);
    }
    
    const yearMatch = text.match(/(\d{4})年築/);
    if (yearMatch && yearMatch[1]) {
      const builtYear = parseInt(yearMatch[1], 10);
      return new Date().getFullYear() - builtYear;
    }
    
    return 0;
  }
  
  private extractBuildingType($: cheerio.Root): string {
    const typeText = $('.building-type').text().trim();
    
    // Normalize building types
    if (typeText.includes('マンション')) return 'マンション';
    if (typeText.includes('アパート')) return 'アパート';
    if (typeText.includes('一戸建')) return '一戸建て';
    
    return typeText || '不明';
  }
  
  private extractStationInfo($: cheerio.Root): StationInfo {
    const stationText = $('.traffic-info').first().text().trim();
    
    // Parse format: "JR山手線 渋谷駅 徒歩5分"
    const match = stationText.match(/(.+線)\s+(.+駅)\s+徒歩(\d+)分/);
    
    if (match && match[1] && match[2] && match[3]) {
      return {
        line: match[1],
        name: match[2],
        walkTime: parseInt(match[3], 10)
      };
    }
    
    return {
      line: '',
      name: '',
      walkTime: 0
    };
  }
  
  private extractCoordinates($: cheerio.Root): { lat: number; lng: number } | undefined {
    // Look for map data
    const mapData = $('script:contains("mapOptions")').text();
    const latMatch = mapData.match(/lat[\'\"]\s*:\s*([\d.]+)/);
    const lngMatch = mapData.match(/lng[\'\"]\s*:\s*([\d.]+)/);
    
    if (latMatch && lngMatch && latMatch[1] && lngMatch[1]) {
      return {
        lat: parseFloat(latMatch[1]),
        lng: parseFloat(lngMatch[1])
      };
    }
    
    return undefined;
  }
  
  private extractImages($: cheerio.Root): string[] {
    const images: string[] = [];
    
    $('.photo-list img').each((_: number, element: any) => {
      const src = $(element).attr('src') || $(element).attr('data-src');
      if (src) {
        // Convert thumbnail to full-size image URL
        const fullSizeUrl = src.replace('/thumb/', '/large/');
        images.push(fullSizeUrl);
      }
    });
    
    return images;
  }
  
  private extractFeatures($: cheerio.Root): string[] {
    const features: string[] = [];
    
    $('.merit-list li').each((_: number, element: any) => {
      const feature = $(element).text().trim();
      if (feature) {
        features.push(feature);
      }
    });
    
    return features;
  }
  
  private parseHomesDeposit(text: string): number {
    // Format: "敷金1ヶ月" or "敷金10万円"
    const monthMatch = text.match(/敷金(\d+)ヶ月/);
    if (monthMatch && monthMatch[1]) {
      // Will need to multiply by rent later
      return parseFloat(monthMatch[1]);
    }
    
    return this.parseHomesPrice(text);
  }
  
  private parseHomesKeyMoney(text: string): number {
    // Format: "礼金1ヶ月" or "礼金10万円"
    const monthMatch = text.match(/礼金(\d+)ヶ月/);
    if (monthMatch && monthMatch[1]) {
      // Will need to multiply by rent later
      return parseFloat(monthMatch[1]);
    }
    
    return this.parseHomesPrice(text);
  }
  
  private generateHomesId($: cheerio.Root): string {
    // Try to extract Homes-specific ID from page
    const propertyId = $('meta[property="homes:property_id"]').attr('content');
    if (propertyId) {
      return `homes-${propertyId}`;
    }
    
    // Fallback to URL-based ID
    const urlMatch = $('link[rel="canonical"]').attr('href')?.match(/\/(\d+)\//);
    if (urlMatch) {
      return `homes-${urlMatch[1]}`;
    }
    
    // Final fallback
    return `homes-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private extractBuildingId($: cheerio.Root): string | undefined {
    return $('meta[property="homes:building_id"]').attr('content');
  }
  
  private extractRoomCount($: cheerio.Root): number | undefined {
    const layout = $('.floor-plan .plan').text().trim();
    const match = layout.match(/(\d+)[LDKS]/);
    
    return match && match[1] ? parseInt(match[1], 10) : undefined;
  }
}