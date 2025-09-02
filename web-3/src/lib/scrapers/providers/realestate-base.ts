import type * as cheerio from 'cheerio';
import { ApartmentScraper } from '../apartment-scraper';
import type {
  ScrapedApartmentData,
  ScrapedImageData,
  ScrapedStationData,
} from '~/types/scraper';

/**
 * Base class for RealEstate.co.jp scrapers
 * Contains all parsing logic that can be shared between fast and normal scrapers
 */
export abstract class RealEstateBase extends ApartmentScraper {
  /**
   * Search/List page parsing methods
   */
  
  /**
   * Parse a single listing from search results page
   */
  protected parseListingFromSearchPage($: cheerio.Root, $item: cheerio.Cheerio): Partial<ScrapedApartmentData> {
    // Extract the detail URL
    const detailLink = $item.find('.listing-title a[href*="/rent/view/"], a.btn-primary[href*="/rent/view/"]').first();
    const href = detailLink.attr('href');
    if (!href) {
      throw new Error('No detail link found for listing');
    }
    
    const detailUrl = new URL(href, this.config.baseUrl).toString();
    const externalId = this.extractExternalId(detailUrl);
    if (!externalId) {
      throw new Error('Could not extract ID from URL');
    }
    
    // Extract title and location
    const titleEl = $item.find('.listing-title');
    const titleType = this.cleanText(titleEl.find('.text-semi-strong').text());
    let location = this.cleanText(titleEl.find('span').not('.text-semi-strong').text());
    
    // Remove "in " prefix if present
    if (location.toLowerCase().startsWith('in ')) {
      location = location.substring(3);
    }
    
    const title = `${titleType} ${location}`.trim();
    
    // Extract price
    const priceText = $item.find('.listing-item:contains("Monthly Costs")').text();
    const price = this.extractPrice(priceText);
    
    // Extract size
    const sizeText = $item.find('.listing-item:contains("Size")').text();
    const sizeMatch = sizeText.match(/([\d.]+)\s*m²/);
    const size = sizeMatch ? parseFloat(sizeMatch[1]) : undefined;
    
    // Extract floor
    const floorText = $item.find('.listing-item:contains("Floor")').text();
    const floorMatch = floorText.match(/(\d+)\s*\/\s*(\d+)F/);
    const floor = floorMatch ? parseInt(floorMatch[1]) : undefined;
    const totalFloors = floorMatch ? parseInt(floorMatch[2]) : undefined;
    
    // Extract building age
    const yearText = $item.find('.listing-item:contains("Year Built")').text();
    const yearMatch = yearText.match(/(\d{4})/);
    let buildingAge: number | undefined;
    if (yearMatch) {
      const yearBuilt = parseInt(yearMatch[1]);
      buildingAge = new Date().getFullYear() - yearBuilt;
    }
    
    return {
      externalId,
      sourceUrl: detailUrl,
      sourceSite: 'realestate.co.jp',
      title,
      price,
      size,
      layout: titleType,
      floor,
      totalFloors,
      buildingAge,
      address: location,
    };
  }
  
  /**
   * Parse basic fees from search page listing
   */
  protected parseBasicFeesFromSearchPage($item: cheerio.Cheerio): { deposit?: number; keyMoney?: number; feesTotal?: number } {
    const $listingItems = $item.find('.listing-item');
    let depositAmount: number | undefined;
    let keyMoneyAmount: number | undefined;
    
    $listingItems.each((i, item) => {
      const $itemEl = this.$(item);
      const text = $itemEl.text().trim();
      
      if ($itemEl.find('.text-strong').text().includes('Deposit')) {
        const amountText = text.replace('Deposit', '').trim();
        depositAmount = this.extractPrice(amountText);
      } else if ($itemEl.find('.text-strong').text().includes('Key Money')) {
        const amountText = text.replace('Key Money', '').trim();
        keyMoneyAmount = this.extractPrice(amountText);
      }
    });
    
    const feesTotal = (depositAmount || 0) + (keyMoneyAmount || 0);
    
    return {
      deposit: depositAmount,
      keyMoney: keyMoneyAmount,
      feesTotal: feesTotal > 0 ? feesTotal : undefined,
    };
  }
  
  /**
   * Parse thumbnail image from search page listing
   */
  protected parseThumbnailFromSearchPage($item: cheerio.Cheerio): ScrapedImageData[] {
    const images: ScrapedImageData[] = [];
    const mainImage = $item.find('.listing-image').attr('src');
    
    if (mainImage) {
      images.push({
        url: mainImage.startsWith('http') ? mainImage : new URL(mainImage, this.config.baseUrl).toString(),
        order: 0,
      });
    }
    
    return images;
  }
  
  /**
   * Parse basic station info from search page listing
   */
  protected parseBasicStationInfoFromSearchPage($item: cheerio.Cheerio): ScrapedStationData[] {
    const nearestStations: ScrapedStationData[] = [];
    const stationText = $item.find('.listing-item:contains("Nearest Station") span').text();
    const stationMatch = stationText.match(/(.+?)\s*\((\d+)\s*min/);
    
    if (stationMatch) {
      nearestStations.push({
        name: stationMatch[1].trim(),
        walkingMinutes: parseInt(stationMatch[2]),
      });
    }
    
    return nearestStations;
  }
  
  /**
   * Detail page parsing methods
   */
  
  /**
   * Parse complete apartment data from detail page
   */
  protected parseApartmentFromDetailPage($: cheerio.Root, url: string): ScrapedApartmentData {
    const externalId = this.extractExternalId(url);
    if (!externalId) {
      throw new Error('Could not extract external ID from URL');
    }
    
    // Title
    const title = this.cleanText($('h1').first().text()) || 
                 this.cleanText($('.property-title').text()) ||
                 this.cleanText($('[class*="title"]').first().text());
    
    if (!title) {
      throw new Error('Could not extract title');
    }
    
    // Price
    const priceSelectors = [
      '.rent-price',
      '.monthly-cost',
      '[class*="price"]',
      'dt:contains("Rent") + dd',
      'dt:contains("Monthly") + dd',
    ];
    
    let price = 0;
    for (const selector of priceSelectors) {
      const priceText = $(selector).text();
      if (priceText) {
        price = this.extractPrice(priceText);
        if (price) break;
      }
    }
    
    if (!price) {
      throw new Error('Could not extract price');
    }
    
    // Size
    const sizeSelectors = [
      '.property-size',
      '[class*="size"]',
      'dt:contains("Size") + dd',
      'dt:contains("Area") + dd',
    ];
    
    let size = 0;
    for (const selector of sizeSelectors) {
      const sizeText = $(selector).text();
      const sizeMatch = sizeText.match(/([\d.]+)\s*m²/);
      if (sizeMatch) {
        size = parseFloat(sizeMatch[1]);
        break;
      }
    }
    
    if (!size) {
      size = 25; // Default size
    }
    
    // Layout
    let layout: string | undefined;
    const layoutSelectors = [
      '.property-layout',
      '.room-type',
      'dt:contains("Layout") + dd',
      'dt:contains("Type") + dd',
    ];
    
    for (const selector of layoutSelectors) {
      const layoutText = this.cleanText($(selector).text());
      if (layoutText) {
        layout = layoutText;
        break;
      }
    }
    
    // Floor
    let floor: number | undefined;
    let totalFloors: number | undefined;
    const floorSelectors = [
      '.property-floor',
      'dt:contains("Floor") + dd',
    ];
    
    for (const selector of floorSelectors) {
      const floorText = $(selector).text();
      const floorMatch = floorText.match(/(\d+)\s*(?:\/\s*(\d+))?/);
      if (floorMatch) {
        floor = parseInt(floorMatch[1]);
        if (floorMatch[2]) {
          totalFloors = parseInt(floorMatch[2]);
        }
        break;
      }
    }
    
    // Building age
    let buildingAge: number | undefined;
    const yearSelectors = [
      '.year-built',
      'dt:contains("Year Built") + dd',
      'dt:contains("Built") + dd',
      'dt:contains("Construction Completed") + dd',
      'dt:contains("Construction") + dd',
    ];
    
    for (const selector of yearSelectors) {
      const yearText = $(selector).text();
      console.log(`[RealEstate] Checking building age with selector "${selector}": "${yearText}"`);
      
      // Match various year formats: "2004", "August 2004", "2004年8月"
      const yearMatch = yearText.match(/(\d{4})/);
      if (yearMatch) {
        const yearBuilt = parseInt(yearMatch[1]);
        buildingAge = new Date().getFullYear() - yearBuilt;
        console.log(`[RealEstate] Found construction year ${yearBuilt}, building age: ${buildingAge} years`);
        break;
      }
    }
    
    // Address
    const addressSelectors = [
      '.property-address',
      '.location',
      '[class*="address"]',
      'dt:contains("Address") + dd',
      'dt:contains("Location") + dd',
    ];
    
    let address = '';
    for (const selector of addressSelectors) {
      const addressText = this.cleanText($(selector).text());
      if (addressText) {
        address = addressText;
        break;
      }
    }
    
    if (!address) {
      address = 'Tokyo'; // Default
    }
    
    // Compose the base apartment data
    const apartmentData: ScrapedApartmentData = {
      externalId,
      sourceUrl: url,
      sourceSite: 'realestate.co.jp',
      title,
      price,
      size,
      layout,
      floor,
      totalFloors,
      buildingAge,
      address,
      area: undefined,
      ward: undefined,
      city: undefined,
      prefecture: undefined,
      latitude: undefined,
      longitude: undefined,
      description: this.parseDescriptionFromDetailPage($),
      amenities: this.parseAmenitiesFromDetailPage($),
      availability: 'available',
      images: this.parseImageGalleryFromDetailPage($),
      nearestStations: this.parseDetailedStationInfoFromDetailPage($),
    };
    
    // Parse fees
    const fees = this.parseFullFeesFromDetailPage($);
    if (fees.feesTotal && fees.feesTotal > 0) {
      apartmentData.feesTotal = fees.feesTotal;
      apartmentData.feesJson = fees.feesJson;
    }
    
    // Parse coordinates
    const coords = this.parseCoordinatesFromDetailPage($);
    if (coords.latitude) apartmentData.latitude = coords.latitude;
    if (coords.longitude) apartmentData.longitude = coords.longitude;
    
    return apartmentData;
  }
  
  /**
   * Parse complete fee breakdown from detail page
   */
  protected parseFullFeesFromDetailPage($: cheerio.Root): { feesTotal: number; feesJson: any } {
    const feesJson: any = {
      deposit: 0,
      keyMoney: 0,
      agencyFee: 0,
      guarantorFee: 0,
      insurance: 0,
      other: {}
    };
    
    let feesTotal = 0;
    
    // Look for the fees list - RealEstate.co.jp uses a <dl> structure
    const feesList = $('dl').filter((_, el) => {
      const text = $(el).text();
      return text.includes('Total Move-In Fees') || text.includes('Agency Fee') || text.includes('Key Money');
    }).first();
    
    if (feesList.length > 0) {
      console.log('[RealEstate] Found fees list, parsing fees...');
      
      feesList.find('dt').each((_, dt) => {
        const $dt = $(dt);
        const label = $dt.text().trim();
        const $dd = $dt.next('dd');
        const valueText = $dd.text().trim();
        const value = parseInt(valueText.replace(/[¥,￥]/g, '')) || 0;
        
        console.log(`[RealEstate] Fee: "${label}" = ¥${value.toLocaleString()}`);
        
        // Map each fee type to the appropriate field
        if (label.includes('Security Deposit')) {
          feesJson.other['securityDeposit'] = value;
        } else if (label === 'Deposit' || (label.includes('Deposit') && !label.includes('Security'))) {
          feesJson.deposit = value;
        } else if (label.includes('Key Money')) {
          feesJson.keyMoney = value;
        } else if (label.includes('Agency Fee')) {
          feesJson.agencyFee = value;
        } else if (label.includes('Guarantor Fee')) {
          feesJson.guarantorFee = value;
        } else if (label.includes('Lock Exchange')) {
          feesJson.other['lockExchange'] = value;
        } else if (label.includes('Fire Insurance')) {
          feesJson.insurance = value;
        } else if (label === 'Other') {
          feesJson.other['miscellaneous'] = value;
        } else if (label.includes('Total Move-In Fees')) {
          feesTotal = value;
        }
      });
      
      console.log('[RealEstate] Total move-in fees:', feesTotal);
      console.log('[RealEstate] Parsed fees:', JSON.stringify(feesJson, null, 2));
    }
    
    // Fallback: Look for the old "Total to Move In" section structure
    if (feesTotal === 0) {
      const moveInSection = $('h5:contains("Total to Move In")').parent();
      if (moveInSection.length > 0) {
        moveInSection.find('dt').each((_, dt) => {
          const $dt = $(dt);
          const label = $dt.text().trim();
          const valueText = $dt.next('dd').text().trim();
          const value = parseInt(valueText.replace(/[¥,]/g, '')) || 0;
          
          if (label.includes('Security Deposit')) {
            feesJson.other['securityDeposit'] = value;
          } else if (label.includes('Deposit')) {
            feesJson.deposit = value;
          } else if (label.includes('Key Money')) {
            feesJson.keyMoney = value;
          } else if (label.includes('Agency Fee')) {
            feesJson.agencyFee = value;
          } else if (label.includes('Guarantor Fee')) {
            feesJson.guarantorFee = value;
          } else if (label.includes('Fire Insurance')) {
            feesJson.insurance = value;
          } else if (label.includes('Lock Exchange')) {
            feesJson.other['lockExchange'] = value;
          } else if (label === 'Total Move-In Fees') {
            feesTotal = value;
          }
        });
      }
    }
    
    // Calculate total if not provided
    if (feesTotal === 0) {
      feesTotal = Object.entries(feesJson).reduce((sum: number, [key, val]: [string, any]) => {
        if (key === 'other' && typeof val === 'object') {
          return sum + Object.values(val).reduce((otherSum: number, otherVal: any) => otherSum + (otherVal || 0), 0);
        }
        return sum + (val || 0);
      }, 0);
    }
    
    return { feesTotal, feesJson };
  }
  
  /**
   * Parse all images from detail page gallery
   */
  protected parseImageGalleryFromDetailPage($: cheerio.Root): ScrapedImageData[] {
    const images: ScrapedImageData[] = [];
    
    // Try multiple selectors for gallery images
    const gallerySelectors = [
      '.gallery-thumbnails a[href]',
      '.thumbnails a.thumbnail',
      '.gallery a[href*=".jpg"], .gallery a[href*=".jpeg"]',
      'a.thumbnail[href]',
    ];
    
    for (const selector of gallerySelectors) {
      const galleryLinks = $(selector);
      if (galleryLinks.length > 0) {
        galleryLinks.each((index, el) => {
          const href = $(el).attr('href');
          if (href && (href.includes('.jpg') || href.includes('.jpeg') || href.includes('.png'))) {
            images.push({
              url: href.startsWith('http') ? href : new URL(href, this.config.baseUrl).toString(),
              order: index,
            });
          }
        });
        if (images.length > 0) break;
      }
    }
    
    // Fallback to img elements
    if (images.length === 0) {
      const imgSelectors = [
        '.gallery-main img',
        '.main-image img',
        '.property-image img',
        'img[src*="/store/"]',
      ];
      
      for (const selector of imgSelectors) {
        const imgs = $(selector);
        imgs.each((index, el) => {
          const src = $(el).attr('src') || $(el).attr('data-src');
          if (src && !src.includes('_w100_h100_c') && !src.includes('thumbnail')) {
            images.push({
              url: src.startsWith('http') ? src : new URL(src, this.config.baseUrl).toString(),
              order: index,
            });
          }
        });
        if (images.length > 0) break;
      }
    }
    
    return images;
  }
  
  /**
   * Parse coordinates from detail page
   */
  protected parseCoordinatesFromDetailPage($: cheerio.Root): { latitude?: number; longitude?: number } {
    const coordinates: { latitude?: number; longitude?: number } = {};
    
    // Extract from data-coordinates attribute
    const coordinatesData = $('[data-coordinates]').attr('data-coordinates');
    if (coordinatesData) {
      try {
        // Decode HTML entities
        const decodedData = coordinatesData
          .replace(/&#x5B;/g, '[')
          .replace(/&#x5D;/g, ']')
          .replace(/&#x7B;/g, '{')
          .replace(/&#x7D;/g, '}')
          .replace(/&quot;/g, '"')
          .replace(/&#x3A;/g, ':')
          .replace(/&#x2C;/g, ',');
        
        const coords = JSON.parse(decodedData);
        if (coords && coords[0]) {
          coordinates.latitude = coords[0].lat;
          coordinates.longitude = coords[0].lng;
        }
      } catch (error) {
        console.error('Error parsing coordinates:', error);
      }
    }
    
    return coordinates;
  }
  
  /**
   * Parse amenities from detail page
   */
  protected parseAmenitiesFromDetailPage($: cheerio.Root): string[] {
    const amenities: string[] = [];
    
    $('.amenities li, .features li, .facilities li').each((_, el) => {
      const text = this.cleanText($(el).text());
      if (text) amenities.push(text);
    });
    
    return amenities;
  }
  
  /**
   * Parse description from detail page
   */
  protected parseDescriptionFromDetailPage($: cheerio.Root): string | undefined {
    const descSelectors = [
      '.property-description',
      '.description',
      '[class*="description"]',
    ];
    
    for (const selector of descSelectors) {
      const descText = this.cleanText($(selector).text());
      if (descText) {
        return descText;
      }
    }
    
    return undefined;
  }
  
  /**
   * Parse detailed station information from detail page
   */
  protected parseDetailedStationInfoFromDetailPage($: cheerio.Root): ScrapedStationData[] {
    const nearestStations: ScrapedStationData[] = [];
    
    // Look for Transportation section
    const transportSection = $('h4.section-title:contains("Transportation")').next('.detail-item');
    if (transportSection.length > 0) {
      transportSection.find('div').each((_, el) => {
        const stationEl = $(el);
        const stationName = stationEl.find('.text-semi-strong').text().trim();
        const walkingText = stationEl.find('li.has-icon').text();
        const walkingMatch = walkingText.match(/(\d+)\s*min/);
        
        if (stationName && walkingMatch) {
          const nameMatch = stationName.match(/^(.+?)\s*(?:Station)?\s*\((.+)\)$/);
          let name = stationName;
          let lines: string[] = [];
          
          if (nameMatch) {
            name = nameMatch[1].trim() + ' Station';
            lines = [nameMatch[2].trim()];
          }
          
          nearestStations.push({
            name: name,
            lines: lines,
            walkingMinutes: parseInt(walkingMatch[1]),
          });
        }
      });
    }
    
    // Fallback to other selectors
    if (nearestStations.length === 0) {
      const stationSelectors = [
        '.station-info',
        '.nearest-station',
        'dt:contains("Station") + dd',
        'dt:contains("Access") + dd',
      ];
      
      for (const selector of stationSelectors) {
        const stationText = $(selector).text();
        const stationMatch = stationText.match(/(.+?)\s*\((\d+)\s*min/);
        if (stationMatch) {
          nearestStations.push({
            name: stationMatch[1].trim(),
            walkingMinutes: parseInt(stationMatch[2]),
          });
        }
      }
    }
    
    return nearestStations;
  }
  
  /**
   * Common utility methods
   */
  
  protected extractPrice(text: string): number {
    const cleanText = text.replace(/[¥￥,]/g, '').trim();
    const match = cleanText.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  }
  
  protected extractSize(text: string): number {
    const match = text.match(/([\d.]+)\s*m²/);
    return match ? parseFloat(match[1]) : 0;
  }
  
  protected extractExternalId(url: string): string | null {
    // URL pattern: https://realestate.co.jp/en/rent/view/1249374
    const match = url.match(/\/view\/(\d+)/);
    return match ? match[1] : null;
  }
  
  protected buildDetailUrl(externalId: string): string {
    return `${this.config.baseUrl}/en/rent/view/${externalId}`;
  }
  
  protected cleanText(text: string): string {
    return text.trim().replace(/\s+/g, ' ');
  }
  
  protected $: typeof cheerio.load = require('cheerio').load;
}