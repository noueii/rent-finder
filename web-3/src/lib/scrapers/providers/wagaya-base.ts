import type * as cheerio from 'cheerio';
import { ApartmentScraper } from '../apartment-scraper';
import type {
  ScrapedApartmentData,
  ScrapedImageData,
  ScrapedStationData,
} from '~/types/scraper';

/**
 * Base class for Wagaya Japan scrapers
 * Contains all parsing logic that can be shared between fast and normal scrapers
 */
export abstract class WagayaBase extends ApartmentScraper {
  /**
   * Search/List page parsing methods
   */
  
  /**
   * Parse a single listing from search results page
   */
  protected parseListingFromSearchPage($: cheerio.Root, $item: cheerio.Cheerio): Partial<ScrapedApartmentData> {
    // Extract detail URL for external ID
    const detailLink = $item.find('a[href*="chintai_detail.php"]').first();
    const href = detailLink.attr('href');
    if (!href) {
      throw new Error('No detail link found for listing');
    }
    
    // Extract external ID from URL
    const idMatch = href.match(/[?&]id=(\d+)/);
    const externalId = idMatch ? idMatch[1] : null;
    if (!externalId) {
      throw new Error('No ID found in URL');
    }
    
    // Build full URL
    let sourceUrl: string;
    if (href.startsWith('http')) {
      sourceUrl = href;
    } else if (href.startsWith('/')) {
      sourceUrl = new URL(href, this.config.baseUrl).toString();
    } else {
      sourceUrl = new URL(href, this.config.baseUrl).toString();
    }
    
    // Extract title/building name
    const title = this.cleanText($item.find('p.pro-search-item__ttl').text()) || `Property ${externalId}`;
    
    // Extract price
    let priceText = '';
    const $priceElement = $item.find('p.emph').first();
    if ($priceElement.length > 0) {
      priceText = $priceElement.text().trim();
    }
    
    // If not found, look in floor list columns
    if (!priceText) {
      const $floorList = $item.find('.pro-floor-list__col');
      $floorList.each((_, col) => {
        const text = $(col).text();
        if (text.includes('￥') && !priceText) {
          const match = text.match(/￥[\d,]+/);
          if (match) {
            priceText = match[0];
            return false;
          }
        }
      });
    }
    
    const price = this.extractPrice(priceText);
    
    // Extract size and layout
    let size: number | undefined;
    let layout: string | undefined;
    
    const $floorListCols = $item.find('.pro-floor-list__col');
    $floorListCols.each((_, col) => {
      const text = $(col).text();
      const layoutMatch = text.match(/([0-9][A-Z]+(?:[A-Z]+)?)\s*\(([0-9.]+)m²?\)/);
      if (layoutMatch) {
        layout = layoutMatch[1];
        size = parseFloat(layoutMatch[2]);
        return false;
      }
    });
    
    // Extract address
    let address = '';
    const $addressDiv = $item.find('.pro-access').first();
    if ($addressDiv.length > 0) {
      const $addressDd = $addressDiv.find('dd').first();
      if ($addressDd.length > 0) {
        address = this.cleanText($addressDd.text());
      }
    }
    
    if (!address) {
      address = 'Tokyo'; // Default fallback
    }
    
    // Extract floor
    let floor: number | undefined;
    $floorListCols.each((_, col) => {
      const text = $(col).text().trim();
      const floorMatch = text.match(/^(\d+)F$/);
      if (floorMatch) {
        floor = parseInt(floorMatch[1], 10);
        return false;
      }
    });
    
    // Extract building age
    let buildingAge: number | undefined;
    const ageText = $item.find('[class*="age"], [class*="built"], [class*="construction"]').text();
    if (ageText) {
      const yearMatch = ageText.match(/(\d{4})/);
      if (yearMatch) {
        const buildYear = parseInt(yearMatch[1], 10);
        buildingAge = new Date().getFullYear() - buildYear;
      } else {
        const ageMatch = ageText.match(/(\d+)\s*years?/);
        if (ageMatch) {
          buildingAge = parseInt(ageMatch[1], 10);
        }
      }
    }
    
    return {
      externalId,
      sourceUrl,
      sourceSite: 'wagaya-japan.com',
      title,
      price,
      size,
      layout,
      floor,
      buildingAge,
      address,
    };
  }
  
  /**
   * Parse basic fees from search page listing
   */
  protected parseBasicFeesFromSearchPage($item: cheerio.Cheerio): { deposit?: number; keyMoney?: number; feesTotal?: number } {
    const fees: { deposit?: number; keyMoney?: number; feesTotal?: number } = {};
    
    // Look for deposit/key money in format "0months\n1months"
    const $floorListCols = $item.find('.pro-floor-list__col');
    
    $floorListCols.each((colIndex, col) => {
      const text = $(col).text();
      if (text.includes('months')) {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length >= 2) {
          const depositMatch = lines[0].match(/(\d+(?:\.\d+)?)\s*months?/);
          const keyMoneyMatch = lines[1].match(/(\d+(?:\.\d+)?)\s*months?/);
          
          if (depositMatch && keyMoneyMatch) {
            const price = this.parseListingFromSearchPage(this.$, $item).price || 0;
            const depositMonths = parseFloat(depositMatch[1]);
            const keyMoneyMonths = parseFloat(keyMoneyMatch[1]);
            
            fees.deposit = Math.round(depositMonths * price);
            fees.keyMoney = Math.round(keyMoneyMonths * price);
            fees.feesTotal = fees.deposit + fees.keyMoney;
            
            return false; // Break the loop
          }
        }
      }
    });
    
    return fees;
  }
  
  /**
   * Parse thumbnail image from search page listing
   */
  protected parseThumbnailFromSearchPage($item: cheerio.Cheerio): ScrapedImageData[] {
    const images: ScrapedImageData[] = [];
    
    const imgSelectors = [
      '.bukken_image img',
      '.property-image img',
      '.thumbnail img',
      'img[src*="property"]',
      'img[src*="bukken"]'
    ];
    
    for (const selector of imgSelectors) {
      const $img = $item.find(selector).first();
      const src = $img.attr('src') || $img.attr('data-src');
      if (src && !src.includes('no-image')) {
        const fullUrl = new URL(src, this.config.baseUrl).toString();
        images.push({
          url: fullUrl,
          caption: $img.attr('alt') || 'Property image',
          order: 0,
        });
        break;
      }
    }
    
    return images;
  }
  
  /**
   * Parse basic station info from search page listing
   */
  protected parseBasicStationInfoFromSearchPage($item: cheerio.Cheerio): ScrapedStationData[] {
    const nearestStations: ScrapedStationData[] = [];
    
    const $addressDiv = $item.find('.pro-access').first();
    const $stationDd = $addressDiv.find('dd').eq(1); // Second dd contains station info
    
    if ($stationDd.length > 0) {
      const stationText = $stationDd.text();
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
    
    // Initialize fees
    const feesJson = {
      deposit: 0,
      keyMoney: 0,
      agencyFee: 0,
      guarantorFee: 0,
      insurance: 0,
      other: {}
    };
    
    // Collect property data from dl/dt/dd structure
    const propertyData: Record<string, string> = {};
    this.collectPropertyData($, propertyData);
    
    // Extract title
    let title = this.extractTitle($, propertyData);
    if (!title) {
      throw new Error('Could not extract title');
    }
    
    // Extract price
    const price = this.extractPriceFromDetail($, propertyData);
    if (!price) {
      throw new Error('Could not extract valid price');
    }
    
    // Extract size
    let size = this.extractSizeFromDetail(propertyData);
    if (!size) {
      // Try alternative extraction from page
      console.log('[Wagaya] Trying alternative size extraction methods...');
      
      // Look for size in various page elements
      const sizeSelectors = [
        '.property-size',
        '.room-size',
        '.area',
        '[class*="size"]',
        '[class*="area"]',
        'td:contains("m²")',
        'td:contains("m2")',
        'span:contains("m²")',
        'span:contains("m2")'
      ];
      
      for (const selector of sizeSelectors) {
        const sizeText = $(selector).text();
        const match = sizeText.match(/([\d.]+)\s*(?:m²|m2|㎡|sqm)/i);
        if (match) {
          size = parseFloat(match[1]);
          if (size > 5 && size < 500) {
            console.log(`[Wagaya] Found size with selector "${selector}": ${size}m²`);
            break;
          }
        }
      }
      
      // Last resort - look in all text
      if (!size) {
        const allText = $.text();
        const matches = allText.match(/([\d.]+)\s*(?:m²|m2|㎡|sqm)/gi);
        if (matches) {
          for (const match of matches) {
            const sizeMatch = match.match(/([\d.]+)/);
            if (sizeMatch) {
              const potentialSize = parseFloat(sizeMatch[1]);
              if (potentialSize > 10 && potentialSize < 200) {
                size = potentialSize;
                console.log(`[Wagaya] Found size in page text: ${size}m²`);
                break;
              }
            }
          }
        }
      }
      
      // Use default if still not found
      if (!size) {
        size = 25;
        console.warn('[Wagaya] Could not extract size, using default:', size);
      }
    }
    
    // Extract layout
    const layout = this.extractLayoutFromDetail(propertyData);
    
    // Extract floor info
    const floorInfo = this.extractFloorInfoFromDetail(propertyData);
    
    // Extract building age
    const buildingAge = this.extractBuildingAgeFromDetail(propertyData);
    
    // Extract address
    let address = this.extractAddressFromDetail(propertyData);
    if (!address) {
      console.log('[Wagaya] Trying alternative address extraction...');
      
      // Try to find address in page
      const addressSelectors = [
        '.property-address',
        '.address',
        '[class*="address"]',
        '.location',
        'dt:contains("Address") + dd',
        'dt:contains("Location") + dd'
      ];
      
      for (const selector of addressSelectors) {
        const addressText = $(selector).text().trim();
        if (addressText && addressText.length > 5) {
          address = addressText;
          console.log(`[Wagaya] Found address with selector "${selector}": ${address}`);
          break;
        }
      }
      
      if (!address) {
        // Default to Tokyo
        address = 'Tokyo, Japan';
        console.warn('[Wagaya] Could not extract address, using default:', address);
      }
    }
    
    // Compose the apartment data
    const apartmentData: ScrapedApartmentData = {
      externalId,
      sourceUrl: url,
      sourceSite: 'wagaya-japan.com',
      title,
      price,
      size,
      layout,
      floor: floorInfo.floor,
      totalFloors: floorInfo.totalFloors,
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
      availability: this.parseAvailabilityFromDetail(propertyData),
      images: this.parseImageGalleryFromDetailPage($),
      nearestStations: this.parseDetailedStationInfoFromDetailPage($, propertyData),
    };
    
    // Parse fees
    const fees = this.parseFullFeesFromDetailPage($, propertyData, price);
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
  protected parseFullFeesFromDetailPage($: cheerio.Root, propertyData: Record<string, string>, monthlyRent: number): { feesTotal: number; feesJson: any } {
    const feesJson: any = {
      deposit: 0,
      keyMoney: 0,
      agencyFee: 0,
      guarantorFee: 0,
      insurance: 0,
      other: {}
    };
    
    let feesTotal = 0;
    
    // Helper to extract months from fee text
    const extractMonths = (text: string): number => {
      const yenMatch = text.match(/[¥￥]\s*([0-9,]+)/);
      if (yenMatch && monthlyRent > 0) {
        const amount = parseInt(yenMatch[1].replace(/,/g, ''), 10);
        return Math.round(amount / monthlyRent);
      }
      
      const monthsMatch = text.match(/(\d+(?:\.\d+)?)\s*months?/i);
      if (monthsMatch) {
        return parseFloat(monthsMatch[1]);
      }
      
      const numberMatch = text.match(/^(\d+(?:\.\d+)?)$/);
      if (numberMatch) {
        return parseFloat(numberMatch[1]);
      }
      
      return 0;
    };
    
    // Look for deposit
    const depositField = Object.entries(propertyData).find(([key]) => 
      key.toLowerCase() === 'deposit' ||
      key.toLowerCase() === 'deposit:' ||
      key.toLowerCase().includes('deposit')
    );
    if (depositField && monthlyRent > 0) {
      console.log(`[Wagaya] Found deposit field: "${depositField[0]}" = "${depositField[1]}"`);
      const months = extractMonths(depositField[1]);
      console.log(`[Wagaya] Deposit months: ${months}`);
      // Always calculate deposit, even if 0 months
      const deposit = Math.round(months * monthlyRent);
      feesJson.deposit = deposit;
      feesTotal += deposit;
      console.log(`[Wagaya] Deposit amount: ¥${deposit}`);
    }
    
    // Look for key money
    const keyMoneyField = Object.entries(propertyData).find(([key]) => 
      key.toLowerCase() === 'key money' ||
      key.toLowerCase() === 'key money:' ||
      key.toLowerCase().includes('key money')
    );
    if (keyMoneyField && monthlyRent > 0) {
      console.log(`[Wagaya] Found key money field: "${keyMoneyField[0]}" = "${keyMoneyField[1]}"`);
      const months = extractMonths(keyMoneyField[1]);
      console.log(`[Wagaya] Key money months: ${months}`);
      // Always calculate key money, even if 0 months
      const keyMoney = Math.round(months * monthlyRent);
      feesJson.keyMoney = keyMoney;
      feesTotal += keyMoney;
      console.log(`[Wagaya] Key money amount: ¥${keyMoney}`);
    }
    
    // Look for agent fee
    const agentFeeField = Object.entries(propertyData).find(([key]) => 
      key.toLowerCase() === 'agent fee' ||
      key.toLowerCase() === 'agency fee' ||
      key.toLowerCase() === 'brokerage fee' ||
      (key.toLowerCase().includes('agent') && key.toLowerCase().includes('fee'))
    );
    if (agentFeeField && monthlyRent > 0) {
      console.log(`[Wagaya] Found agent fee field: "${agentFeeField[0]}" = "${agentFeeField[1]}"`);
      const months = extractMonths(agentFeeField[1]);
      console.log(`[Wagaya] Agent fee months: ${months}`);
      if (months > 0) {
        const agencyFee = Math.round(months * monthlyRent);
        feesJson.agencyFee = agencyFee;
        feesTotal += agencyFee;
        console.log(`[Wagaya] Agency fee amount: ¥${agencyFee}`);
      }
    }
    
    // Look for renewal fee
    const renewalFeeField = Object.entries(propertyData).find(([key]) => 
      key.toLowerCase() === 'renewal fee' ||
      key.toLowerCase() === 'renewal' ||
      key.toLowerCase().includes('renewal')
    );
    if (renewalFeeField && monthlyRent > 0) {
      const months = extractMonths(renewalFeeField[1]);
      if (months > 0) {
        if (!feesJson.other) feesJson.other = {};
        const renewalFee = Math.round(months * monthlyRent);
        feesJson.other.renewalFee = renewalFee;
        console.log(`[Wagaya] Renewal fee: ¥${renewalFee}`);
      }
    }
    
    // Look for initial guarantee fee
    const guaranteeField = Object.entries(propertyData).find(([key]) => 
      key.toLowerCase().includes('initial guarantee') ||
      key.toLowerCase().includes('guarantee fee') ||
      key.toLowerCase().includes('guarantor')
    );
    if (guaranteeField) {
      console.log(`[Wagaya] Found guarantee field: "${guaranteeField[0]}" = "${guaranteeField[1]}"`);
      // Check if it's not just a dash or N/A
      if (!guaranteeField[1].includes('-') && !guaranteeField[1].toLowerCase().includes('n/a')) {
        const months = extractMonths(guaranteeField[1]);
        if (months > 0 && monthlyRent > 0) {
          const guarantorFee = Math.round(months * monthlyRent);
          feesJson.guarantorFee = guarantorFee;
          feesTotal += guarantorFee;
          console.log(`[Wagaya] Guarantor fee: ¥${guarantorFee}`);
        }
      }
    }
    
    console.log(`[Wagaya] Total fees calculated: ¥${feesTotal}`);
    console.log(`[Wagaya] Fee breakdown:`, feesJson);
    
    return { feesTotal, feesJson };
  }
  
  /**
   * Parse all images from detail page gallery
   */
  protected parseImageGalleryFromDetailPage($: cheerio.Root): ScrapedImageData[] {
    const images: ScrapedImageData[] = [];
    let imageOrder = 0;
    
    console.log(`[Wagaya] Starting image gallery parsing...`);
    
    const imageSelectors = [
      '.detail__photoTail-list-item img',
      '.detail__photoTail-mainImg img',
      '.detail__photoTail-madori img',
      'img[src*="property"]',
      'img[src*="bukken"]',
      'img[src*="room"]',
      'img[src*="_photo"]',
      '.property-images img',
      '.gallery img',
      '[class*="photo"] img'
    ];
    
    const addedUrls = new Set<string>();
    
    imageSelectors.forEach(selector => {
      const $elements = $(selector);
      console.log(`[Wagaya] Selector "${selector}" found ${$elements.length} elements`);
      
      $elements.each((_, element) => {
        const src = $(element).attr('src') || $(element).attr('data-src') || $(element).attr('data-original');
        if (src && 
            !src.includes('no-image') && 
            !src.includes('noimage') &&
            !src.includes('logo') &&
            !src.includes('header') &&
            !src.includes('icon') &&
            !src.includes('banner')) {
          const fullUrl = new URL(src, this.config.baseUrl).toString();
          
          if (!addedUrls.has(fullUrl)) {
            addedUrls.add(fullUrl);
            
            let caption = $(element).attr('alt');
            const onclickAttr = $(element).attr('onclick');
            if (onclickAttr) {
              const captionMatch = onclickAttr.match(/fnc_IMG_TIT\('【([^】]+)】'/);
              if (captionMatch) {
                caption = captionMatch[1];
              }
            }
            
            if (caption === '*' || caption === 'undefined' || !caption) {
              caption = undefined;
            }
            
            console.log(`[Wagaya] Adding image ${imageOrder + 1}: ${fullUrl}`);
            images.push({
              url: fullUrl,
              caption,
              order: imageOrder++,
            });
          }
        }
      });
    });
    
    console.log(`[Wagaya] Total images found: ${images.length}`);
    return images;
  }
  
  /**
   * Parse coordinates from detail page
   */
  protected parseCoordinatesFromDetailPage($: cheerio.Root): { latitude?: number; longitude?: number } {
    const coordinates: { latitude?: number; longitude?: number } = {};
    
    // Look for Google Maps iframe with coordinates in URL
    const mapIframe = $('.accessMap-mapWrap iframe, iframe[src*="google.com/maps"], iframe[src*="maps.google"], iframe[src*="google.com/maps/embed"]').first();
    if (mapIframe.length > 0) {
      const iframeSrc = mapIframe.attr('src');
      if (iframeSrc) {
        console.log(`[Wagaya] Found map iframe with src: ${iframeSrc.substring(0, 200)}...`);
        
        // Extract coordinates from Google Maps embed URL
        // Pattern 1: q=35.570483789667,139.70680561718
        const coordMatch = iframeSrc.match(/q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
        if (coordMatch) {
          coordinates.latitude = parseFloat(coordMatch[1]);
          coordinates.longitude = parseFloat(coordMatch[2]);
          console.log(`[Wagaya] Found coordinates in Google Maps iframe (q=): ${coordinates.latitude}, ${coordinates.longitude}`);
          return coordinates;
        }
        
        // Pattern 2: ll=35.570483789667,139.70680561718
        const llMatch = iframeSrc.match(/ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
        if (llMatch) {
          coordinates.latitude = parseFloat(llMatch[1]);
          coordinates.longitude = parseFloat(llMatch[2]);
          console.log(`[Wagaya] Found coordinates in Google Maps iframe (ll): ${coordinates.latitude}, ${coordinates.longitude}`);
          return coordinates;
        }
        
        // Pattern 3: center=35.570483789667,139.70680561718
        const centerMatch = iframeSrc.match(/center=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
        if (centerMatch) {
          coordinates.latitude = parseFloat(centerMatch[1]);
          coordinates.longitude = parseFloat(centerMatch[2]);
          console.log(`[Wagaya] Found coordinates in Google Maps iframe (center): ${coordinates.latitude}, ${coordinates.longitude}`);
          return coordinates;
        }
      }
    }
    
    // If no iframe found, log for debugging
    if (!coordinates.latitude) {
      console.log('[Wagaya] No coordinates found - checking what iframes exist...');
      const allIframes = $('iframe');
      console.log(`[Wagaya] Total iframes on page: ${allIframes.length}`);
      allIframes.each((i, iframe) => {
        const src = $(iframe).attr('src');
        if (src && src.includes('google')) {
          console.log(`[Wagaya] Google iframe ${i}: ${src.substring(0, 100)}...`);
        }
      });
    }
    
    return coordinates;
  }
  
  /**
   * Parse amenities from detail page
   */
  protected parseAmenitiesFromDetailPage($: cheerio.Root): string[] {
    const amenities: string[] = [];
    
    $('.amenities li, .features li, .equipment li').each((_, el) => {
      const text = this.cleanText($(el).text());
      if (text) amenities.push(text);
    });
    
    return amenities;
  }
  
  /**
   * Parse description from detail page
   */
  protected parseDescriptionFromDetailPage($: cheerio.Root): string | undefined {
    const description = this.cleanText($('.property-description').text()) ||
                       this.cleanText($('.detail-text').text()) ||
                       undefined;
    
    return description;
  }
  
  /**
   * Parse detailed station information from detail page
   */
  protected parseDetailedStationInfoFromDetailPage($: cheerio.Root, propertyData: Record<string, string>): ScrapedStationData[] {
    const nearestStations: ScrapedStationData[] = [];
    
    // First check the detail title section
    const stationDD = $('.detail__title .ttl dd').text();
    if (stationDD) {
      console.log(`[Wagaya] Found station info in detail title: "${stationDD}"`);
      // Split by <br> tags or newlines
      const htmlContent = $('.detail__title .ttl dd').html();
      const parts = htmlContent ? htmlContent.split(/<br\s*\/?>/i) : stationDD.split(/\n/);
      
      parts.forEach(part => {
        // Remove HTML tags if any remain
        const cleanPart = part.replace(/<[^>]*>/g, '').trim();
        if (cleanPart) {
          const stationData = this.parseStationInfo(cleanPart);
          if (stationData && !nearestStations.some(s => s.name === stationData.name)) {
            nearestStations.push(stationData);
          }
        }
      });
    }
    
    // Also check property data
    const stationField = Object.entries(propertyData).find(([key]) => 
      key.toLowerCase().includes('route') ||
      key.toLowerCase().includes('station') || 
      key.toLowerCase().includes('access') ||
      key.toLowerCase().includes('azesuto')
    );
    
    if (stationField && stationField[1] !== stationDD) {
      const stationParts = stationField[1].split(/[。\n]/);
      stationParts.forEach(part => {
        const stationData = this.parseStationInfo(part);
        if (stationData && !nearestStations.some(s => s.name === stationData.name)) {
          nearestStations.push(stationData);
        }
      });
    }
    
    return nearestStations;
  }
  
  /**
   * Helper methods
   */
  
  private collectPropertyData($: cheerio.Root, propertyData: Record<string, string>): void {
    // Include detail__spec selector to capture fee information
    $('.detail__spec dl, .estate_detail dl, .property-detail dl, .detail-content dl, #estate_detail dl, #property_detail dl').each((_, dl) => {
      const $dl = $(dl);
      const dt = $dl.find('dt').first().text().trim();
      const dd = $dl.find('dd').first().text().trim();
      
      if (dt && dd && !dt.includes('required') && dd.length < 500) {
        propertyData[dt] = dd;
        // Log fee-related fields for debugging
        if (dt.toLowerCase().includes('deposit') || dt.toLowerCase().includes('key money') || 
            dt.toLowerCase().includes('agent fee') || dt.toLowerCase().includes('guarantee')) {
          console.log(`[Wagaya] Found fee field: "${dt}" = "${dd}"`);
        }
      }
    });
    
    // If no data found with specific selectors, try more generic
    if (Object.keys(propertyData).length === 0) {
      $('dl').each((_, dl) => {
        const $dl = $(dl);
        const dt = $dl.find('dt').first().text().trim();
        const dd = $dl.find('dd').first().text().trim();
        
        if (dt && dd && 
            !dt.includes('required') && 
            !dt.includes('Languages') && 
            !dt.includes('Your Japanese') &&
            !dt.includes('Are you currently') &&
            !dt.includes('Moving date') &&
            dd.length < 200) {
          propertyData[dt] = dd;
        }
      });
    }
    
    // Also check for dt/dd pairs not in dl containers
    $('dt').each((_, dt) => {
      const $dt = $(dt);
      const $dd = $dt.next('dd');
      if ($dd.length > 0) {
        const key = $dt.text().trim();
        const value = $dd.text().trim();
        if (key && value && !propertyData[key]) {
          propertyData[key] = value;
        }
      }
    });
  }
  
  private extractTitle($: cheerio.Root, propertyData: Record<string, string>): string | null {
    let title = '';
    
    // Try h1 first
    const h1Text = $('h1').first().text();
    const h1Match = h1Text.match(/^([^\-\|]+)/);
    if (h1Match) {
      const extracted = this.cleanText(h1Match[1]);
      if (extracted && !extracted.match(/^\d{4}\/\d/) && extracted.length > 3) {
        title = extracted;
      }
    }
    
    // Look for building name in property data
    if (!title) {
      const buildingNameField = Object.entries(propertyData).find(([key]) => 
        key.toLowerCase().includes('azesuto') || 
        key === 'azesutohorikishishoubuentsu'
      );
      if (buildingNameField) {
        const match = buildingNameField[1].match(/^([^:]+):/);
        if (match) {
          title = this.cleanText(match[1]);
        } else {
          const nameMatch = buildingNameField[1].match(/^([^\d]+)/);
          if (nameMatch) {
            title = this.cleanText(nameMatch[1]);
          }
        }
      }
    }
    
    // Fallback to common field names
    if (!title) {
      const titleFields = ['Property Name', 'Building Name', 'Name', 'Property', 'Building'];
      for (const field of titleFields) {
        const value = Object.entries(propertyData).find(([key]) => 
          key.toLowerCase().includes(field.toLowerCase())
        )?.[1];
        if (value) {
          title = this.cleanText(value);
          break;
        }
      }
    }
    
    return title || null;
  }
  
  private extractPriceFromDetail($: cheerio.Root, propertyData: Record<string, string>): number | null {
    let priceText = '';
    
    // Check property data first
    const priceField = Object.entries(propertyData).find(([key, value]) => 
      (key === 'Rent' || 
       key === 'Rent:' ||
       key.toLowerCase() === 'rent' || 
       key.toLowerCase() === 'rent:' ||
       key.toLowerCase().includes('rent')) &&
      value && 
      (value.includes('¥') || value.includes('￥'))
    );
    if (priceField) {
      priceText = priceField[1];
    }
    
    // If not found, look for price in specific locations
    if (!priceText) {
      const priceSelectors = [
        '.price.sp-block',
        '.rating .price',
        '.detail__title .price',
        '.price_pc .price',
        '.rent_price',
        '.estate_price',
        'h2.rent',
        'h3.rent',
        'span.rent',
        '.estate_detail_rent',
        '#rent_price'
      ];
      
      for (const selector of priceSelectors) {
        const $el = $(selector).first();
        if ($el.length > 0) {
          const fullText = $el.text();
          const mainText = $el.clone().children().remove().end().text().trim();
          
          if (mainText && (mainText.includes('￥') || mainText.includes('¥'))) {
            priceText = mainText;
            break;
          } else if (fullText && (fullText.includes('￥') || fullText.includes('¥'))) {
            const priceMatch = fullText.match(/[¥￥]\s*([0-9,]+)/);
            if (priceMatch) {
              priceText = priceMatch[0];
              break;
            }
          }
        }
      }
    }
    
    return this.extractPrice(priceText) || null;
  }
  
  private extractSizeFromDetail(propertyData: Record<string, string>): number | null {
    console.log('[Wagaya] Looking for size in property data:', Object.keys(propertyData));
    
    // Try various field names that might contain size
    const sizeFieldNames = [
      'size', 'area', 'floor area', 'room size', 'space',
      'total area', 'living area', 'square meters', 'sqm',
      'm2', 'm²', '面積', '広さ', 'floor space'
    ];
    
    for (const [key, value] of Object.entries(propertyData)) {
      const keyLower = key.toLowerCase();
      
      // Check if key matches any size field name
      if (sizeFieldNames.some(name => keyLower.includes(name))) {
        console.log(`[Wagaya] Found potential size field: "${key}" = "${value}"`);
        
        // Try to extract size from value - support various formats
        const patterns = [
          /([\d.]+)\s*(?:m²|m2|㎡|sqm|square\s*meters?)/i,
          /([\d.]+)\s*平米/,
          /^([\d.]+)$/  // Just a number
        ];
        
        for (const pattern of patterns) {
          const match = value.match(pattern);
          if (match) {
            const size = parseFloat(match[1]);
            if (size > 0 && size < 500) {
              console.log(`[Wagaya] Extracted size: ${size}m²`);
              return size;
            }
          }
        }
      }
    }
    
    // Log all fields for debugging
    console.log('[Wagaya] All property data fields:', propertyData);
    
    // Try to find size in any field value
    for (const [key, value] of Object.entries(propertyData)) {
      const match = value.match(/([\d.]+)\s*(?:m²|m2|㎡|sqm)/i);
      if (match) {
        const size = parseFloat(match[1]);
        if (size > 5 && size < 500) {
          console.log(`[Wagaya] Found size in field "${key}": ${size}m²`);
          return size;
        }
      }
    }
    
    console.error('[Wagaya] Could not extract size from property data');
    return null;
  }
  
  private extractLayoutFromDetail(propertyData: Record<string, string>): string | undefined {
    const layoutField = Object.entries(propertyData).find(([key]) => 
      key.toLowerCase().includes('layout') || 
      key.toLowerCase().includes('floor plan') ||
      key.toLowerCase().includes('room type') ||
      key.toLowerCase().includes('madori')
    );
    
    return layoutField ? this.cleanText(layoutField[1]) : undefined;
  }
  
  private extractFloorInfoFromDetail(propertyData: Record<string, string>): { floor?: number; totalFloors?: number } {
    const floorField = Object.entries(propertyData).find(([key]) => 
      key.toLowerCase() === 'floor' ||
      key.toLowerCase() === 'floor:' ||
      key.toLowerCase().includes('floor')
    );
    
    if (floorField) {
      const floorText = floorField[1];
      const floorMatch = floorText.match(/(\d+)F?\s*\/\s*(\d+)-?story/);
      if (floorMatch) {
        return {
          floor: parseInt(floorMatch[1], 10),
          totalFloors: parseInt(floorMatch[2], 10)
        };
      }
      
      const simpleMatch = floorText.match(/(\d+)F?\s*\/\s*(\d+)/);
      if (simpleMatch) {
        return {
          floor: parseInt(simpleMatch[1], 10),
          totalFloors: parseInt(simpleMatch[2], 10)
        };
      }
    }
    
    return {};
  }
  
  private extractBuildingAgeFromDetail(propertyData: Record<string, string>): number | undefined {
    console.log('[Wagaya] Looking for building age in property data...');
    
    // First try to find in property data fields
    const ageField = Object.entries(propertyData).find(([key]) => 
      key.toLowerCase().includes('building age') || 
      key.toLowerCase().includes('built') ||
      key.toLowerCase().includes('construction')
    );
    
    if (ageField) {
      console.log(`[Wagaya] Found age field: "${ageField[0]}" = "${ageField[1]}"`);
      
      // Check for age in years format like "(17years)"
      const yearsMatch = ageField[1].match(/（(\d+)years?）/);
      if (yearsMatch) {
        const age = parseInt(yearsMatch[1], 10);
        console.log(`[Wagaya] Extracted building age: ${age} years`);
        return age;
      }
      
      // Check for year format like "2007"
      const yearMatch = ageField[1].match(/(\d{4})/);
      if (yearMatch) {
        const buildYear = parseInt(yearMatch[1], 10);
        const currentYear = new Date().getFullYear();
        const age = currentYear - buildYear;
        console.log(`[Wagaya] Calculated building age from year ${buildYear}: ${age} years`);
        return age;
      }
    }
    
    return undefined;
  }
  
  private extractAddressFromDetail(propertyData: Record<string, string>): string | null {
    const addressField = Object.entries(propertyData).find(([key]) => 
      key.toLowerCase() === 'location' ||
      key.toLowerCase() === 'location:' ||
      key.toLowerCase().includes('location') ||
      key.toLowerCase().includes('address')
    );
    
    return addressField ? this.cleanText(addressField[1]) : null;
  }
  
  private parseAvailabilityFromDetail(propertyData: Record<string, string>): 'available' | 'occupied' | 'unknown' {
    const availabilityField = Object.entries(propertyData).find(([key]) => 
      key.toLowerCase().includes('current status') ||
      key.toLowerCase().includes('status') || 
      key.toLowerCase().includes('availability')
    );
    
    if (!availabilityField) return 'unknown';
    
    const cleaned = this.cleanText(availabilityField[1]).toLowerCase();
    
    if (cleaned.includes('available') || cleaned.includes('vacant') || cleaned.includes('空室')) {
      return 'available';
    }
    
    if (cleaned.includes('occupied') || cleaned.includes('rented') || cleaned.includes('満室')) {
      return 'occupied';
    }
    
    return 'unknown';
  }
  
  /**
   * Common utility methods
   */
  
  protected extractPrice(text: string): number {
    const cleanText = text.replace(/[¥￥]/g, '').trim();
    const match = cleanText.match(/[\d,]+/);
    return match ? parseInt(match[0].replace(/,/g, ''), 10) : 0;
  }
  
  protected extractExternalId(url: string): string | null {
    const match = url.match(/[?&]id=(\d+)/);
    return match ? match[1] : null;
  }
  
  protected buildDetailUrl(externalId: string): string {
    return `${this.config.baseUrl}/en/chintai_detail.php?id=${externalId}`;
  }
  
  protected cleanText(text: string): string {
    return text.trim().replace(/\s+/g, ' ');
  }
  
  private parseStationInfo(text: string): ScrapedStationData | null {
    const cleanedText = this.cleanText(text);
    if (!cleanedText) return null;
    
    console.log(`[Wagaya] Parsing station info from: "${cleanedText}"`);
    
    // Wagaya format: "6 min walk from Kunitachi Sta., JR Chuo Main Line."
    // Pattern to match: number + "min walk from" + station name + "Sta." + optional line info
    const walkFromMatch = cleanedText.match(/(\d+)\s*min\s+walk\s+from\s+([^,]+?)\s*Sta\./i);
    if (walkFromMatch) {
      const walkingMinutes = parseInt(walkFromMatch[1], 10);
      const stationName = walkFromMatch[2].trim() + ' Station';
      
      // Extract line info after the comma
      const lineMatch = cleanedText.match(/,\s*([^.]+)/);
      const lines: string[] = [];
      if (lineMatch) {
        lines.push(lineMatch[1].trim());
      }
      
      console.log(`[Wagaya] Extracted station: ${stationName}, ${walkingMinutes} min, lines: ${lines.join(', ')}`);
      
      return {
        name: stationName,
        walkingMinutes,
        lines: lines.length > 0 ? lines : undefined,
      };
    }
    
    // Fallback to original pattern for other formats
    const stationMatch = cleanedText.match(/([^\s]+\s*Station|[^\s]+駅)/i);
    if (!stationMatch) return null;
    
    const stationName = stationMatch[1];
    
    // Extract walking minutes
    const walkingMatch = cleanedText.match(/(\d+)\s*(?:min|minutes?|分)/i);
    const walkingMinutes = walkingMatch ? parseInt(walkingMatch[1], 10) : 99;
    
    // Extract train lines if mentioned
    const lines: string[] = [];
    const lineMatch = cleanedText.match(/([^\s]+\s*Line|[^\s]+線)/i);
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