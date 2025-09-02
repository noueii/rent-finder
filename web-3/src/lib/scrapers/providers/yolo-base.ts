import type * as cheerio from 'cheerio';
import { ApartmentScraper } from '../apartment-scraper';
import type {
  ScrapedApartmentData,
  ScrapedImageData,
  ScrapedStationData,
} from '~/types/scraper';

/**
 * Base class for YOLO Japan scrapers
 * Contains all parsing logic that can be shared between fast and normal scrapers
 */
export abstract class YoloBase extends ApartmentScraper {
  /**
   * Search/List page parsing methods
   */
  
  /**
   * Parse a single listing from search results page
   */
  protected parseListingFromSearchPage($: cheerio.Root, $item: cheerio.Cheerio): Partial<ScrapedApartmentData> {
    // Extract the detail URL and ID
    const link = $item.find('a.grid-item').attr('href') || 
                $item.find('a[href*="/property/"]').attr('href');
    
    if (!link) {
      throw new Error('No detail link found for listing');
    }
    
    const sourceUrl = link.startsWith('http') ? link : `https://home.yolo-japan.com${link}`;
    const externalId = this.extractExternalId(sourceUrl);
    
    if (!externalId) {
      throw new Error('Could not extract ID from URL');
    }
    
    // Extract title
    const title = this.cleanText($item.find('.property-title').text()) || `Property ${externalId}`;
    
    // Extract price
    const priceText = $item.find('.price').text();
    const price = this.extractPrice(priceText);
    
    if (!price) {
      throw new Error('Could not extract price');
    }
    
    // Extract size and layout
    const layoutText = $item.find('.room-type').text();
    const sizeMatch = layoutText.match(/(\d+(?:\.\d+)?)\s*m²/);
    const size = sizeMatch ? parseFloat(sizeMatch[1]) : undefined;
    
    const layoutMatch = layoutText.match(/([0-9]+[A-Z]+(?:[A-Z]+)?)/);
    const layout = layoutMatch ? layoutMatch[1] : undefined;
    
    // Extract location
    const location = this.cleanText($item.find('.location').text());
    
    // Extract floor (if available in search results)
    let floor: number | undefined;
    const floorText = $item.find('.floor').text();
    const floorMatch = floorText.match(/(\d+)F/);
    if (floorMatch) {
      floor = parseInt(floorMatch[1], 10);
    }
    
    return {
      externalId,
      sourceUrl,
      sourceSite: 'yolo-japan',
      title,
      price,
      size,
      layout,
      floor,
      address: location || 'Tokyo',
    };
  }
  
  /**
   * Parse basic fees from search page listing (YOLO doesn't show fees on search page)
   */
  protected parseBasicFeesFromSearchPage($item: cheerio.Cheerio): { deposit?: number; keyMoney?: number; feesTotal?: number } {
    // YOLO Japan doesn't typically show fees on search results
    return {};
  }
  
  /**
   * Parse thumbnail image from search page listing
   */
  protected parseThumbnailFromSearchPage($item: cheerio.Cheerio): ScrapedImageData[] {
    const images: ScrapedImageData[] = [];
    
    const $img = $item.find('.property-image img, .thumb img, img').first();
    const src = $img.attr('src') || $img.attr('data-src');
    
    if (src && !src.includes('no-image')) {
      images.push({
        url: src.startsWith('http') ? src : `https://home.yolo-japan.com${src}`,
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
    
    const stationText = $item.find('.station-info, .access').text();
    if (stationText) {
      const stationData = this.parseStationInfo(stationText);
      if (stationData) {
        nearestStations.push(stationData);
      }
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
    
    // Debug: Log the page structure
    console.log('[YOLO] Parsing detail page:', url);
    const pageTitle = $('title').text();
    console.log('[YOLO] Page title:', pageTitle);
    console.log('[YOLO] H1 tags:', $('h1').map((_, el) => $(el).text().trim()).get());
    console.log('[YOLO] Elements with "property" in class:', $('[class*="property"]').length);
    
    // Check if we got an error page or redirect
    if (pageTitle.toLowerCase().includes('404') || 
        pageTitle.toLowerCase().includes('not found') ||
        pageTitle.toLowerCase().includes('error') ||
        $('body').text().toLowerCase().includes('page not found')) {
      console.error('[YOLO] Detected error page for URL:', url);
      throw new Error('Property not found - received error page');
    }
    
    // Extract title - try multiple selectors
    let title = '';
    const titleSelectors = [
      '.property-title',
      'h1.title',
      'h1',
      '.property-name',
      '.listing-title',
      '[class*="title"]',
      '.detail-header h1',
      '.property-info h1'
    ];
    
    for (const selector of titleSelectors) {
      const candidateTitle = this.cleanText($(selector).first().text());
      if (candidateTitle) {
        title = candidateTitle;
        console.log(`[YOLO] Found title with selector "${selector}": ${title}`);
        break;
      }
    }
    
    if (!title) {
      // Try to extract from JSON-LD structured data
      const jsonLdScripts = $('script[type="application/ld+json"]');
      jsonLdScripts.each((_, script) => {
        try {
          const jsonData = JSON.parse($(script).html() || '');
          if (jsonData.name) {
            title = jsonData.name;
            console.log('[YOLO] Found title in JSON-LD:', title);
          }
        } catch (e) {
          // Ignore parse errors
        }
      });
    }
    
    if (!title) {
      // Try meta tags
      const metaTitle = $('meta[property="og:title"]').attr('content') || 
                       $('meta[name="title"]').attr('content');
      if (metaTitle) {
        title = this.cleanText(metaTitle);
        console.log('[YOLO] Found title in meta tags:', title);
      }
    }
    
    if (!title) {
      // Last resort - use external ID
      title = `YOLO Property ${externalId}`;
      console.warn('[YOLO] Using fallback title:', title);
      console.error('[YOLO] Could not find title. HTML snippet:', $.html().substring(0, 500));
    }
    
    // Extract price - try multiple selectors
    let price = 0;
    const priceSelectors = [
      // Look for the total in monthly fees section first (includes rent + management fees)
      '#monthly_fees .row-total .col-9.text-right span:first-child',
      '.detail-cost.monthly-cost .row-total .text-right span:first-child',
      '.monthly-cost .row-total span:first-child:not(:contains("yen"))',
      // Fallback to rental fee only if total not found
      '#monthly_fees .row:has(.content-title span:contains("Rental fee")) .col-6.text-right span:first-child',
      '.detail-cost.monthly-cost .row:has(.content-title span:contains("Rental fee")) .col-6.text-right span:first-child',
      '.monthly-cost .row-content .row:has(span:contains("Rental fee")) .text-right span:first-child',
      // Generic selectors
      '.price-amount',
      '.rent-price',
      '.property-price',
      '[class*="price"]',
      '.detail-price',
      'dd:contains("¥")',
      'span:contains("¥")'
    ];
    
    for (const selector of priceSelectors) {
      const $element = $(selector);
      if ($element.length > 0) {
        const priceText = $element.first().text();
        price = this.extractPrice(priceText);
        if (price > 0) {
          console.log(`[YOLO] Found price with selector "${selector}": ¥${price}`);
          break;
        }
      }
    }
    
    if (!price) {
      console.log('[YOLO] Checking monthly fees section specifically...');
      
      // Debug: Check if monthly_fees exists
      const monthlyFeesExists = $('#monthly_fees').length > 0;
      console.log('[YOLO] #monthly_fees element exists:', monthlyFeesExists);
      
      if (monthlyFeesExists) {
        console.log('[YOLO] Monthly fees HTML:', $('#monthly_fees').html()?.substring(0, 500));
      }
      
      // First, try to find the total in monthly fees
      const $totalRow = $('#monthly_fees .row-total, .detail-cost.monthly-cost .row-total');
      if ($totalRow.length > 0) {
        const totalSpan = $totalRow.find('.text-right span, .col-9.text-right span').first();
        const totalText = totalSpan.text().trim();
        console.log(`[YOLO] Found total row with price text: "${totalText}"`);
        
        if (totalText && !totalText.includes('yen')) {
          price = this.extractPrice(totalText);
          if (price > 0) {
            console.log(`[YOLO] Found total monthly fees: ¥${price}`);
          }
        }
      }
      
      // If total not found, look for rental fee only
      if (!price) {
        $('#monthly_fees .row-content .row, .detail-cost.monthly-cost .row-content .row').each((_, row) => {
          const $row = $(row);
          const titleText = $row.find('.content-title span').first().text().trim();
          console.log(`[YOLO] Checking row with title: "${titleText}"`);
          
          if (titleText && titleText === 'Rental fee') {
            // Only get the first span in the text-right column (the price, not "yen")
            const priceSpan = $row.find('.col-6.text-right span').first();
            const priceText = priceSpan.text().trim();
            console.log(`[YOLO] Found rental fee price text: "${priceText}"`);
            
            if (priceText && !priceText.includes('yen')) {
              price = this.extractPrice(priceText);
              if (price > 0) {
                console.log(`[YOLO] Found rental fee in monthly fees section: ¥${price}`);
                return false; // break the loop
              }
            }
          }
        });
      }
    }
    
    if (!price) {
      console.error('[YOLO] Could not find price. Looking for any numeric amounts...');
      // Look for pattern like "80,000" followed by "yen"
      const pricePattern = /(\d{1,3}(?:,\d{3})*)\s*(?:yen|円|¥)/gi;
      const matches = $.html().match(pricePattern);
      if (matches && matches.length > 0) {
        // Try to find the rental fee specifically
        for (const match of matches) {
          const numMatch = match.match(/(\d{1,3}(?:,\d{3})*)/);
          if (numMatch) {
            const potentialPrice = parseInt(numMatch[1].replace(/,/g, ''));
            // Reasonable rent range
            if (potentialPrice >= 30000 && potentialPrice <= 500000) {
              price = potentialPrice;
              console.log(`[YOLO] Found potential rent price: ¥${price}`);
              break;
            }
          }
        }
      }
    }
    
    if (!price) {
      // Last resort - look for the specific YOLO structure with data-v attributes
      console.log('[YOLO] Final attempt - looking for Vue component structure...');
      
      // Try to find any element that contains monthly fees total
      $('[data-v-33adf110], [class*="monthly"], [class*="fee"]').each((_, el) => {
        const $el = $(el);
        const text = $el.text();
        
        // First priority: Look for "Total" with a number
        if (text.includes('Total') && text.match(/\d{2,}/)) {
          console.log(`[YOLO] Found element with Total text: "${text.substring(0, 200)}"`);
          
          // Look for the pattern "Total ... number yen"
          const totalMatch = text.match(/Total[^0-9]*(\d{1,3}(?:,\d{3})*)\s*yen/);
          if (totalMatch) {
            const value = parseInt(totalMatch[1].replace(/,/g, ''));
            if (value >= 30000 && value <= 500000) {
              price = value;
              console.log(`[YOLO] Extracted total monthly fees using pattern match: ¥${price}`);
              return false; // break
            }
          }
        }
      });
    }
    
    if (!price) {
      // Log the page structure for debugging
      console.error('[YOLO] Failed to extract price. Page structure:');
      console.error('[YOLO] - Title tags:', $('title').text());
      console.error('[YOLO] - H1 count:', $('h1').length);
      console.error('[YOLO] - Elements with "monthly":', $('[class*="monthly"]').length);
      console.error('[YOLO] - Elements with "cost":', $('[class*="cost"]').length);
      console.error('[YOLO] - Elements with data-v attrs:', $('[data-v-33adf110]').length);
      
      throw new Error('Could not extract price from YOLO property page - price structure not found');
    }
    
    // Extract property details from detail info section
    const details: Record<string, string> = {};
    $('.property-details dl, .detail-info dl').each((_, el) => {
      const $dl = $(el);
      const dt = $dl.find('dt').text().trim();
      const dd = $dl.find('dd').text().trim();
      if (dt && dd) {
        details[dt] = dd;
      }
    });
    
    // Extract size - try multiple approaches
    let size = 0;
    const sizeText = details['Area'] || details['Size'] || details['面積'] || '';
    const sizeMatch = sizeText.match(/(\d+(?:\.\d+)?)\s*(?:m²|㎡|sqm)/i);
    if (sizeMatch) {
      size = parseFloat(sizeMatch[1]);
      console.log(`[YOLO] Found size in details: ${size}m²`);
    }
    
    if (!size) {
      // Try alternative selectors
      const sizeSelectors = [
        '.size',
        '.area',
        '.property-size',
        '[class*="area"]',
        'dt:contains("Area") + dd',
        'dt:contains("Size") + dd',
        'span:contains("m²")',
        'span:contains("㎡")'
      ];
      
      for (const selector of sizeSelectors) {
        const altSizeText = $(selector).text();
        const altSizeMatch = altSizeText.match(/(\d+(?:\.\d+)?)\s*(?:m²|㎡|sqm)/i);
        if (altSizeMatch) {
          size = parseFloat(altSizeMatch[1]);
          console.log(`[YOLO] Found size with selector "${selector}": ${size}m²`);
          break;
        }
      }
    }
    
    if (!size) {
      // Look in all text for size pattern
      const allText = $.text();
      const globalSizeMatch = allText.match(/(\d+(?:\.\d+)?)\s*(?:m²|㎡|sqm)/i);
      if (globalSizeMatch) {
        size = parseFloat(globalSizeMatch[1]);
        console.log(`[YOLO] Found size in page text: ${size}m²`);
      }
    }
    
    if (!size || size < 5 || size > 500) {
      // Use reasonable default
      size = 25;
      console.warn('[YOLO] Using default size:', size);
    }
    
    // Extract layout
    const layout = details['Layout'] || details['間取り'] || 
                  this.cleanText($('.layout, .room-type').text()) || 
                  undefined;
    
    // Extract floor info
    let floor: number | undefined;
    let totalFloors: number | undefined;
    const floorText = details['Floor'] || details['階数'] || '';
    const floorMatch = floorText.match(/(\d+)\s*\/\s*(\d+)/);
    if (floorMatch) {
      floor = parseInt(floorMatch[1], 10);
      totalFloors = parseInt(floorMatch[2], 10);
    }
    
    // Extract building age
    let buildingAge: number | undefined;
    const ageText = details['Building Age'] || details['築年数'] || '';
    const yearMatch = ageText.match(/(\d{4})/);
    if (yearMatch) {
      buildingAge = new Date().getFullYear() - parseInt(yearMatch[1], 10);
    } else {
      const ageMatch = ageText.match(/(\d+)\s*years?/);
      if (ageMatch) {
        buildingAge = parseInt(ageMatch[1], 10);
      }
    }
    
    // If not found in details, look for construction date in table
    if (!buildingAge) {
      console.log('[YOLO] Looking for construction date in table structure...');
      
      // Look for "Construction date" in table rows
      $('.form-table table tr, table tbody tr').each((_, row) => {
        const $row = $(row);
        const $firstTd = $row.find('td').first();
        const label = $firstTd.text().trim().toLowerCase();
        
        if (label.includes('construction date') || label.includes('built')) {
          const value = $row.find('td').eq(1).text().trim();
          console.log(`[YOLO] Found construction date in table: "${value}"`);
          
          // Extract year/month format like "2007/08"
          const dateMatch = value.match(/(\d{4})\/(\d{2})/);
          if (dateMatch) {
            const buildYear = parseInt(dateMatch[1], 10);
            const currentYear = new Date().getFullYear();
            buildingAge = currentYear - buildYear;
            console.log(`[YOLO] Calculated building age from ${buildYear}: ${buildingAge} years`);
            return false; // break the loop
          }
          
          // Try just year format
          const yearOnlyMatch = value.match(/(\d{4})/);
          if (yearOnlyMatch) {
            const buildYear = parseInt(yearOnlyMatch[1], 10);
            const currentYear = new Date().getFullYear();
            buildingAge = currentYear - buildYear;
            console.log(`[YOLO] Calculated building age from year ${buildYear}: ${buildingAge} years`);
            return false; // break the loop
          }
        }
      });
    }
    
    // Extract address - look for the txt-address div first
    let address = '';
    const $addressDiv = $('.txt-address').first();
    if ($addressDiv.length > 0) {
      // Remove the "View on Google Maps" link text
      const $clone = $addressDiv.clone();
      $clone.find('a').remove();
      address = this.cleanText($clone.text());
      console.log(`[YOLO] Found address in txt-address div: ${address}`);
    }
    
    if (!address) {
      address = details['Address'] || details['Location'] || details['住所'] || 
                this.cleanText($('.address, .location').text()) || 
                'Tokyo';
    }
    
    // Compose the apartment data
    const apartmentData: ScrapedApartmentData = {
      externalId,
      sourceUrl: url,
      sourceSite: 'yolo-japan',
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
      nearestStations: this.parseDetailedStationInfoFromDetailPage($, details),
    };
    
    // Parse fees
    const fees = this.parseFullFeesFromDetailPage($, details, price);
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
  protected parseFullFeesFromDetailPage($: cheerio.Root, details: Record<string, string>, monthlyRent: number): { feesTotal: number; feesJson: any } {
    const feesJson: any = {
      deposit: 0,
      keyMoney: 0,
      agencyFee: 0,
      guarantorFee: 0,
      insurance: 0,
      other: {}
    };
    
    let feesTotal = 0;
    
    // Helper to extract amount or months
    const extractFeeAmount = (text: string): number => {
      // First try direct yen amount
      const yenMatch = text.match(/[¥￥]\s*([0-9,]+)/);
      if (yenMatch) {
        return parseInt(yenMatch[1].replace(/,/g, ''), 10);
      }
      
      // Then try months format
      const monthsMatch = text.match(/(\d+(?:\.\d+)?)\s*months?/i);
      if (monthsMatch && monthlyRent > 0) {
        return Math.round(parseFloat(monthsMatch[1]) * monthlyRent);
      }
      
      return 0;
    };
    
    // Check details object for fees
    if (details['Deposit'] || details['敷金']) {
      const deposit = extractFeeAmount(details['Deposit'] || details['敷金']);
      if (deposit > 0) {
        feesJson.deposit = deposit;
        feesTotal += deposit;
      }
    }
    
    if (details['Key Money'] || details['礼金']) {
      const keyMoney = extractFeeAmount(details['Key Money'] || details['礼金']);
      if (keyMoney > 0) {
        feesJson.keyMoney = keyMoney;
        feesTotal += keyMoney;
      }
    }
    
    if (details['Agency Fee'] || details['仲介手数料']) {
      const agencyFee = extractFeeAmount(details['Agency Fee'] || details['仲介手数料']);
      if (agencyFee > 0) {
        feesJson.agencyFee = agencyFee;
        feesTotal += agencyFee;
      }
    }
    
    // Look for fees in a dedicated fees section
    $('.fees-section dl, .initial-costs dl').each((_, el) => {
      const $dl = $(el);
      const label = $dl.find('dt').text().trim();
      const value = $dl.find('dd').text().trim();
      
      if (label.includes('Deposit') && !feesJson.deposit) {
        const deposit = extractFeeAmount(value);
        if (deposit > 0) {
          feesJson.deposit = deposit;
          feesTotal += deposit;
        }
      } else if (label.includes('Key Money') && !feesJson.keyMoney) {
        const keyMoney = extractFeeAmount(value);
        if (keyMoney > 0) {
          feesJson.keyMoney = keyMoney;
          feesTotal += keyMoney;
        }
      } else if ((label.includes('Agency') || label.includes('Brokerage')) && !feesJson.agencyFee) {
        const agencyFee = extractFeeAmount(value);
        if (agencyFee > 0) {
          feesJson.agencyFee = agencyFee;
          feesTotal += agencyFee;
        }
      } else if (label.includes('Insurance')) {
        const insurance = extractFeeAmount(value);
        if (insurance > 0) {
          feesJson.insurance = insurance;
          feesTotal += insurance;
        }
      } else if (label.includes('Guarantor')) {
        const guarantorFee = extractFeeAmount(value);
        if (guarantorFee > 0) {
          feesJson.guarantorFee = guarantorFee;
          feesTotal += guarantorFee;
        }
      }
    });
    
    // Look for fees in the new YOLO structure with detail-cost initial-cost
    console.log('[YOLO] Looking for initial fees in detail-cost structure...');
    $('.detail-cost.initial-cost .row-content .row').each((_, row) => {
      const $row = $(row);
      const titleText = $row.find('.content-title span').text().trim();
      const valueSpan = $row.find('.text-right span').first();
      const valueText = valueSpan.text().trim();
      
      console.log(`[YOLO] Checking fee row: "${titleText}" = "${valueText}"`);
      
      if (titleText && valueText && !valueText.includes('yen')) {
        const amount = parseInt(valueText.replace(/,/g, ''));
        
        if (titleText.includes('Security deposit')) {
          feesJson.deposit = amount;
          console.log(`[YOLO] Found security deposit: ¥${amount}`);
        } else if (titleText.includes('Key money')) {
          feesJson.keyMoney = amount;
          console.log(`[YOLO] Found key money: ¥${amount}`);
        } else if (titleText.includes('Introduction fee')) {
          feesJson.agencyFee = amount;
          console.log(`[YOLO] Found introduction/agency fee: ¥${amount}`);
        } else if (titleText.includes('Advance rent')) {
          feesJson.other['advanceRent'] = amount;
          console.log(`[YOLO] Found advance rent: ¥${amount}`);
        }
      }
    });
    
    // Look for the total in the row-total
    const totalRow = $('.detail-cost.initial-cost .row-total');
    if (totalRow.length > 0) {
      const totalText = totalRow.find('.text-right span').first().text().trim();
      const totalAmount = parseInt(totalText.replace(/,/g, ''));
      if (totalAmount > 0) {
        feesTotal = totalAmount;
        console.log(`[YOLO] Found total initial fees: ¥${feesTotal}`);
      }
    }
    
    // If we didn't find a total, calculate it
    if (feesTotal === 0) {
      feesTotal = Object.entries(feesJson).reduce((sum: number, [key, val]: [string, any]) => {
        if (key === 'other' && typeof val === 'object') {
          return sum + Object.values(val).reduce((otherSum: number, otherVal: any) => otherSum + (otherVal || 0), 0);
        }
        return sum + (val || 0);
      }, 0);
      console.log(`[YOLO] Calculated total fees: ¥${feesTotal}`);
    }
    
    return { feesTotal, feesJson };
  }
  
  /**
   * Parse all images from detail page gallery
   */
  protected parseImageGalleryFromDetailPage($: cheerio.Root): ScrapedImageData[] {
    const images: ScrapedImageData[] = [];
    let imageOrder = 0;
    
    // YOLO Japan gallery selectors
    const gallerySelectors = [
      '.property-gallery img',
      '.gallery-images img',
      '.property-images img',
      '.swiper-slide img',
      '.carousel img',
      '[class*="gallery"] img',
      '[class*="photo"] img'
    ];
    
    const addedUrls = new Set<string>();
    
    gallerySelectors.forEach(selector => {
      $(selector).each((_, element) => {
        const $img = $(element);
        const src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-lazy');
        
        if (src && 
            !src.includes('no-image') && 
            !src.includes('placeholder') &&
            !src.includes('logo')) {
          const fullUrl = src.startsWith('http') ? src : `https://home.yolo-japan.com${src}`;
          
          if (!addedUrls.has(fullUrl)) {
            addedUrls.add(fullUrl);
            
            images.push({
              url: fullUrl,
              caption: $img.attr('alt') || undefined,
              order: imageOrder++,
            });
          }
        }
      });
    });
    
    return images;
  }
  
  /**
   * Parse coordinates from detail page
   */
  protected parseCoordinatesFromDetailPage($: cheerio.Root): { latitude?: number; longitude?: number } {
    const coordinates: { latitude?: number; longitude?: number } = {};
    
    // Look for map data
    const mapData = $('[data-lat][data-lng]').first();
    if (mapData.length > 0) {
      const lat = mapData.attr('data-lat');
      const lng = mapData.attr('data-lng');
      if (lat && lng) {
        coordinates.latitude = parseFloat(lat);
        coordinates.longitude = parseFloat(lng);
      }
    }
    
    // Look for Google Maps link with coordinates
    const mapLink = $('a[href*="maps.google.com/maps?q="]').first();
    if (mapLink.length > 0) {
      const href = mapLink.attr('href') || '';
      console.log(`[YOLO] Found Google Maps link: ${href}`);
      
      // Extract coordinates from q= parameter
      const coordMatch = href.match(/q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
      if (coordMatch) {
        coordinates.latitude = parseFloat(coordMatch[1]);
        coordinates.longitude = parseFloat(coordMatch[2]);
        console.log(`[YOLO] Extracted coordinates from Google Maps link: ${coordinates.latitude}, ${coordinates.longitude}`);
      }
    }
    
    // Alternative: look in JavaScript
    if (!coordinates.latitude || !coordinates.longitude) {
      const scriptContent = $('script').text();
      const latMatch = scriptContent.match(/(?:lat|latitude)['"]?\s*:\s*(-?\d+\.?\d*)/);
      const lngMatch = scriptContent.match(/(?:lng|longitude)['"]?\s*:\s*(-?\d+\.?\d*)/);
      
      if (latMatch && lngMatch) {
        coordinates.latitude = parseFloat(latMatch[1]);
        coordinates.longitude = parseFloat(lngMatch[1]);
        console.log(`[YOLO] Found coordinates in script: ${coordinates.latitude}, ${coordinates.longitude}`);
      }
    }
    
    return coordinates;
  }
  
  /**
   * Parse amenities from detail page
   */
  protected parseAmenitiesFromDetailPage($: cheerio.Root): string[] {
    const amenities: string[] = [];
    
    // YOLO specific amenity selectors
    $('.amenities li, .features li, .facilities li, .equipment li').each((_, el) => {
      const text = this.cleanText($(el).text());
      if (text && !amenities.includes(text)) {
        amenities.push(text);
      }
    });
    
    // Also check icon-based amenities
    $('.amenity-icon, .feature-icon').each((_, el) => {
      const $el = $(el);
      const title = $el.attr('title') || $el.find('span').text();
      if (title && !amenities.includes(title)) {
        amenities.push(title);
      }
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
      '.detail-text',
      '[class*="description"]',
      '.property-info'
    ];
    
    for (const selector of descSelectors) {
      const descText = this.cleanText($(selector).text());
      if (descText && descText.length > 20) {
        return descText;
      }
    }
    
    return undefined;
  }
  
  /**
   * Parse detailed station information from detail page
   */
  protected parseDetailedStationInfoFromDetailPage($: cheerio.Root, details: Record<string, string>): ScrapedStationData[] {
    const nearestStations: ScrapedStationData[] = [];
    
    // Check details object first
    const stationInfo = details['Nearest Station'] || details['Station'] || details['最寄り駅'] || '';
    if (stationInfo) {
      const stationData = this.parseStationInfo(stationInfo);
      if (stationData) {
        nearestStations.push(stationData);
      }
    }
    
    // Look for station section
    $('.station-info, .access-info, .transportation').each((_, el) => {
      const text = $(el).text();
      const stationData = this.parseStationInfo(text);
      if (stationData && !nearestStations.some(s => s.name === stationData.name)) {
        nearestStations.push(stationData);
      }
    });
    
    // Look for multiple stations in a list
    $('.station-list li, .access-list li').each((_, el) => {
      const text = $(el).text();
      const stationData = this.parseStationInfo(text);
      if (stationData && !nearestStations.some(s => s.name === stationData.name)) {
        nearestStations.push(stationData);
      }
    });
    
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
  
  protected extractExternalId(url: string): string | null {
    // URL pattern: https://home.yolo-japan.com/en/property/1411616
    const match = url.match(/property\/(\d+)/);
    return match ? match[1] : null;
  }
  
  protected buildDetailUrl(externalId: string): string {
    return `https://home.yolo-japan.com/en/property/${externalId}`;
  }
  
  protected cleanText(text: string): string {
    return text.trim().replace(/\s+/g, ' ');
  }
  
  private parseStationInfo(text: string): ScrapedStationData | null {
    const cleanedText = this.cleanText(text);
    if (!cleanedText) return null;
    
    // Look for station name
    const stationMatch = cleanedText.match(/([^\s]+(?:\s+Station)?)/i);
    if (!stationMatch) return null;
    
    let stationName = stationMatch[1];
    if (!stationName.includes('Station')) {
      stationName += ' Station';
    }
    
    // Extract walking minutes
    const walkingMatch = cleanedText.match(/(\d+)\s*(?:min|minutes?|分)/i);
    const walkingMinutes = walkingMatch ? parseInt(walkingMatch[1]) : 99;
    
    // Extract train lines if mentioned
    const lines: string[] = [];
    const lineMatch = cleanedText.match(/\(([^)]+(?:Line|線)[^)]*)\)/);
    if (lineMatch) {
      lines.push(lineMatch[1]);
    }
    
    return {
      name: stationName,
      walkingMinutes,
      lines: lines.length > 0 ? lines : undefined,
    };
  }
  
  protected $: typeof cheerio.load = require('cheerio').load;
}