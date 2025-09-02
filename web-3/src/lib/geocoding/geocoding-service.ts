import { z } from 'zod';

// Nominatim response schema
const NominatimResultSchema = z.object({
  place_id: z.number(),
  lat: z.string(),
  lon: z.string(),
  display_name: z.string(),
  boundingbox: z.array(z.string()).optional(),
});

type NominatimResult = z.infer<typeof NominatimResultSchema>;

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  displayName: string;
  confidence: number; // 0-1 confidence score
}

interface GeocodeResult extends GeocodingResult {}

// Common Tokyo ward translations (all 23 special wards + surrounding cities)
const WARD_TRANSLATIONS: Record<string, string> = {
  // 23 Special Wards (特別区)
  'Chiyoda': '千代田区',
  'Chuo': '中央区',
  'Minato': '港区',
  'Shinjuku': '新宿区',
  'Bunkyo': '文京区',
  'Taito': '台東区',
  'Sumida': '墨田区',
  'Koto': '江東区',
  'Shinagawa': '品川区',
  'Meguro': '目黒区',
  'Ota': '大田区',
  'Setagaya': '世田谷区',
  'Shibuya': '渋谷区',
  'Nakano': '中野区',
  'Suginami': '杉並区',
  'Toshima': '豊島区',
  'Kita': '北区',
  'Arakawa': '荒川区',
  'Itabashi': '板橋区',
  'Nerima': '練馬区',
  'Adachi': '足立区',
  'Katsushika': '葛飾区',
  'Edogawa': '江戸川区',
  
  // Common surrounding cities (市)
  'Hachioji': '八王子市',
  'Tachikawa': '立川市',
  'Musashino': '武蔵野市',
  'Mitaka': '三鷹市',
  'Ome': '青梅市',
  'Fuchu': '府中市',
  'Akishima': '昭島市',
  'Chofu': '調布市',
  'Machida': '町田市',
  'Koganei': '小金井市',
  'Kodaira': '小平市',
  'Hino': '日野市',
  'Higashimurayama': '東村山市',
  'Kokubunji': '国分寺市',
  'Kunitachi': '国立市',
  'Fussa': '福生市',
  'Komae': '狛江市',
  'Higashiyamato': '東大和市',
  'Kiyose': '清瀬市',
  'Higashikurume': '東久留米市',
  'Musashimurayama': '武蔵村山市',
  'Tama': '多摩市',
  'Inagi': '稲城市',
  'Hamura': '羽村市',
  'Akiruno': 'あきる野市',
  'Nishitokyo': '西東京市',
};

// Address parsing patterns
const ADDRESS_PATTERNS = {
  // Matches: "3-5-5 Shimo Ochiai, Shinjuku-ku, Tokyo"
  englishFormat: /^([\d\-]+)\s+([^,]+),\s*([^,]+)(?:-ku)?,\s*Tokyo$/i,
  // Matches: "東京都新宿区下落合3-5-5"
  japaneseFormat: /^東京都([^区]+区)(.+)$/,
  // Matches mixed format with numbers
  mixedFormat: /([^区]+区)\s*([^\d]+)\s*([\d\-]+)/,
  // Matches: "Tokyo Ota Ku西蒲田7丁目" or "Tokyo Itabashi-ku 本町 41-12"
  tokyoWardMixed: /^Tokyo\s+([\w-]+)(?:\s+Ku|-ku)\s*(.+)$/i,
  // Matches: "Tokyo Adachi Ku花畑4丁目" (no space after Ku)
  tokyoWardCompact: /^Tokyo\s+([\w-]+)\s+Ku([^\s].+)$/i,
  // Matches: "Tokyo Akiruno Shi二宮" (city format)
  tokyoCityMixed: /^Tokyo\s+([\w-]+)\s+Shi\s*(.+)$/i,
  // Matches: "Tokyo Koto Ku白河4丁目" (ward with space before Japanese)
  tokyoWardWithSpace: /^Tokyo\s+([\w-]+)\s+Ku\s+(.+)$/i,
  // Matches: "Tokyo Akishima Shi宮沢町2丁目" (city with no space)
  tokyoCityCompact: /^Tokyo\s+([\w-]+)\s+Shi([^\s].+)$/i,
  // General pattern: "Tokyo [Ward/City] [Ku/Shi] [Japanese text]"
  tokyoGeneral: /^Tokyo\s+([\w-]+)\s+(Ku|Shi)\s*(.+)$/i,
};

export class GeocodingService {
  private static instance: GeocodingService;
  private cache = new Map<string, GeocodeResult>();
  private requestCount = 0;
  private lastRequestTime = 0;
  private readonly RATE_LIMIT_MS = 1000; // 1 request per second for Nominatim
  private readonly USER_AGENT = 'TokyoRentFinder/1.0';

  private constructor() {}

  static getInstance(): GeocodingService {
    if (!GeocodingService.instance) {
      GeocodingService.instance = new GeocodingService();
    }
    return GeocodingService.instance;
  }

  /**
   * Convert an address to coordinates
   */
  async geocodeAddress(address: string): Promise<GeocodeResult | null> {
    console.log(`[Geocoding] geocodeAddress called with: "${address}"`);
    
    // Clean and validate address
    const cleanedAddress = this.cleanAddress(address);
    console.log(`[Geocoding] Cleaned address: "${cleanedAddress}"`);
    
    if (!cleanedAddress) {
      console.warn(`[Geocoding] Invalid address after cleaning: ${address}`);
      return null;
    }
    
    // Check cache first
    const cached = this.cache.get(cleanedAddress);
    if (cached) {
      console.log(`[Geocoding] Cache hit for: ${cleanedAddress}`);
      return cached;
    }

    // Parse and convert address to Japanese format
    const japaneseAddress = this.convertToJapaneseAddress(cleanedAddress);
    if (!japaneseAddress) {
      console.error(`[Geocoding] Failed to parse address: ${cleanedAddress}`);
      return null;
    }

    console.log(`[Geocoding] Converted "${address}" to "${japaneseAddress}"`);

    // Rate limiting
    await this.enforceRateLimit();

    try {
      const params = new URLSearchParams({
        q: japaneseAddress,
        format: 'json',
        limit: '1',
        countrycodes: 'jp',
        'accept-language': 'ja',
      });

      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: {
          'User-Agent': this.USER_AGENT,
        },
      });

      if (!response.ok) {
        throw new Error(`Nominatim API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!Array.isArray(data) || data.length === 0) {
        console.warn(`[Geocoding] No results found for: ${japaneseAddress}`);
        return null;
      }

      const result = NominatimResultSchema.parse(data[0]);
      
      const geocodeResult: GeocodeResult = {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        displayName: result.display_name,
        confidence: this.calculateConfidence(address, result),
      };

      // Cache the result
      this.cache.set(cleanedAddress, geocodeResult);
      
      console.log(`[Geocoding] Found coordinates for ${cleanedAddress}: ${geocodeResult.latitude}, ${geocodeResult.longitude}`);
      
      return geocodeResult;
    } catch (error) {
      console.error(`[Geocoding] Error geocoding address "${address}":`, error);
      return null;
    }
  }

  /**
   * Batch geocode multiple addresses
   */
  async geocodeAddresses(addresses: string[]): Promise<Map<string, GeocodeResult | null>> {
    const results = new Map<string, GeocodeResult | null>();
    
    for (const address of addresses) {
      const result = await this.geocodeAddress(address);
      results.set(address, result);
    }
    
    return results;
  }

  /**
   * Convert various address formats to Japanese
   */
  private convertToJapaneseAddress(address: string): string | null {
    console.log(`[Geocoding] Converting address: "${address}"`);
    
    // Already in Japanese format
    if (address.includes('東京都')) {
      console.log(`[Geocoding] Address already in Japanese format`);
      // Remove building numbers for better geocoding (e.g., "20番17号")
      const cleanedAddress = this.removeBuildingNumbers(address);
      console.log(`[Geocoding] Cleaned Japanese address: "${cleanedAddress}"`);
      return cleanedAddress;
    }

    // Try Tokyo Ward With Space format: "Tokyo Koto Ku白河4丁目"
    const tokyoWardWithSpaceMatch = address.match(ADDRESS_PATTERNS.tokyoWardWithSpace);
    if (tokyoWardWithSpaceMatch) {
      const [, ward, rest] = tokyoWardWithSpaceMatch;
      const wardJa = this.getWardInJapanese(ward);
      console.log(`[Geocoding] Tokyo ward with space format - Ward "${ward}" -> "${wardJa}"`);
      if (wardJa) {
        const result = this.removeBuildingNumbers(`東京都${wardJa}${rest.trim()}`);
        console.log(`[Geocoding] Converted to: "${result}"`);
        return result;
      }
    }

    // Try Tokyo Ward Compact format: "Tokyo Adachi Ku花畑4丁目" (no space after Ku)
    const tokyoWardCompactMatch = address.match(ADDRESS_PATTERNS.tokyoWardCompact);
    if (tokyoWardCompactMatch) {
      const [, ward, rest] = tokyoWardCompactMatch;
      const wardJa = this.getWardInJapanese(ward);
      console.log(`[Geocoding] Tokyo ward compact format - Ward "${ward}" -> "${wardJa}"`);
      if (wardJa) {
        const result = this.removeBuildingNumbers(`東京都${wardJa}${rest.trim()}`);
        console.log(`[Geocoding] Converted to: "${result}"`);
        return result;
      }
    }

    // Try Tokyo City Compact format: "Tokyo Akishima Shi宮沢町2丁目" (no space after Shi)
    const tokyoCityCompactMatch = address.match(ADDRESS_PATTERNS.tokyoCityCompact);
    if (tokyoCityCompactMatch) {
      const [, city, rest] = tokyoCityCompactMatch;
      console.log(`[Geocoding] Tokyo city compact format - City "${city}" with rest "${rest}"`);
      // Check if we have a translation for this city
      const cityJa = WARD_TRANSLATIONS[city];
      if (cityJa && cityJa.includes('市')) {
        // Use the translated city name
        const result = this.removeBuildingNumbers(`東京都${cityJa}${rest.trim()}`);
        console.log(`[Geocoding] Converted to: "${result}"`);
        return result;
      } else {
        // Default format for unknown cities
        const result = this.removeBuildingNumbers(`東京都${city}市${rest.trim()}`);
        console.log(`[Geocoding] Converted to: "${result}"`);
        return result;
      }
    }

    // Try Tokyo City format: "Tokyo Akiruno Shi二宮"
    const tokyoCityMatch = address.match(ADDRESS_PATTERNS.tokyoCityMixed);
    if (tokyoCityMatch) {
      const [, city, rest] = tokyoCityMatch;
      console.log(`[Geocoding] Tokyo city format - City "${city}" with rest "${rest}"`);
      // Check if we have a translation for this city
      const cityJa = WARD_TRANSLATIONS[city];
      if (cityJa && cityJa.includes('市')) {
        // Use the translated city name
        const result = this.removeBuildingNumbers(`東京都${cityJa}${rest.trim()}`);
        console.log(`[Geocoding] Converted to: "${result}"`);
        return result;
      } else {
        // Default format for unknown cities
        const result = this.removeBuildingNumbers(`東京都${city}市${rest.trim()}`);
        console.log(`[Geocoding] Converted to: "${result}"`);
        return result;
      }
    }

    // Try Tokyo Ward Mixed format: "Tokyo Ota Ku西蒲田7丁目" or "Tokyo Itabashi-ku 本町 41-12"
    const tokyoWardMatch = address.match(ADDRESS_PATTERNS.tokyoWardMixed);
    if (tokyoWardMatch) {
      const [, ward, rest] = tokyoWardMatch;
      const wardJa = this.getWardInJapanese(ward);
      console.log(`[Geocoding] Tokyo ward mixed format - Ward "${ward}" -> "${wardJa}"`);
      if (wardJa) {
        const result = this.removeBuildingNumbers(`東京都${wardJa}${rest.trim()}`);
        console.log(`[Geocoding] Converted to: "${result}"`);
        return result;
      }
    }

    // Try English format: "3-5-5 Shimo Ochiai, Shinjuku-ku, Tokyo"
    const englishMatch = address.match(ADDRESS_PATTERNS.englishFormat);
    console.log(`[Geocoding] English format match:`, englishMatch);
    
    if (englishMatch) {
      const [, numbers, area, ward] = englishMatch;
      const wardJa = this.getWardInJapanese(ward);
      console.log(`[Geocoding] Ward "${ward}" -> "${wardJa}"`);
      if (wardJa) {
        const result = this.removeBuildingNumbers(`東京都${wardJa}${area}${numbers}`);
        console.log(`[Geocoding] Converted to: "${result}"`);
        return result;
      }
    }

    // Try mixed format
    const mixedMatch = address.match(ADDRESS_PATTERNS.mixedFormat);
    if (mixedMatch) {
      const [, ward, area, numbers] = mixedMatch;
      const result = this.removeBuildingNumbers(`東京都${ward}${area}${numbers}`);
      return result;
    }

    // Try general Tokyo pattern as last resort: "Tokyo [Ward/City] [Ku/Shi] [Japanese text]"
    const tokyoGeneralMatch = address.match(ADDRESS_PATTERNS.tokyoGeneral);
    if (tokyoGeneralMatch) {
      const [, place, type, rest] = tokyoGeneralMatch;
      console.log(`[Geocoding] Tokyo general format - Place "${place}" Type "${type}" Rest "${rest}"`);
      
      if (type.toLowerCase() === 'ku') {
        const wardJa = this.getWardInJapanese(place);
        if (wardJa) {
          const result = this.removeBuildingNumbers(`東京都${wardJa}${rest.trim()}`);
          console.log(`[Geocoding] Converted to: "${result}"`);
          return result;
        }
      } else if (type.toLowerCase() === 'shi') {
        const cityJa = WARD_TRANSLATIONS[place];
        if (cityJa && cityJa.includes('市')) {
          const result = this.removeBuildingNumbers(`東京都${cityJa}${rest.trim()}`);
          console.log(`[Geocoding] Converted to: "${result}"`);
          return result;
        } else {
          const result = this.removeBuildingNumbers(`東京都${place}市${rest.trim()}`);
          console.log(`[Geocoding] Converted to: "${result}"`);
          return result;
        }
      }
    }

    // Try to extract ward and build address
    for (const [wardEn, wardJa] of Object.entries(WARD_TRANSLATIONS)) {
      if (address.includes(wardEn)) {
        // Extract the part after ward name
        const parts = address.split(wardEn);
        if (parts.length > 1) {
          const rest = parts[1].replace(/^[,\s-]+|[,\s]+$/g, '');
          const result = this.removeBuildingNumbers(`東京都${wardJa}${rest}`);
          return result;
        }
      }
    }

    // Fallback: Just prepend Tokyo if not present
    if (!address.includes('Tokyo') && !address.includes('東京')) {
      const result = this.removeBuildingNumbers(`東京都${address}`);
      return result;
    }

    return null;
  }

  /**
   * Get ward name in Japanese
   */
  private getWardInJapanese(ward: string): string | null {
    const normalized = ward.replace(/[-\s]ku$/i, '').trim();
    
    // Direct lookup
    if (WARD_TRANSLATIONS[normalized]) {
      return WARD_TRANSLATIONS[normalized];
    }

    // Case-insensitive lookup
    for (const [key, value] of Object.entries(WARD_TRANSLATIONS)) {
      if (key.toLowerCase() === normalized.toLowerCase()) {
        return value;
      }
    }

    // Check if already in Japanese
    if (normalized.includes('区')) {
      return normalized;
    }

    return null;
  }

  /**
   * Calculate confidence score based on result
   */
  private calculateConfidence(originalAddress: string, result: NominatimResult): number {
    let confidence = 0.5; // Base confidence

    // Check if result contains expected ward
    const hasWard = Object.values(WARD_TRANSLATIONS).some(ward => 
      result.display_name.includes(ward)
    );
    if (hasWard) confidence += 0.2;

    // Check if result contains numbers from original address
    const numbers = originalAddress.match(/[\d\-]+/g);
    if (numbers) {
      const hasNumbers = numbers.some(num => result.display_name.includes(num));
      if (hasNumbers) confidence += 0.2;
    }

    // Penalize if result is too generic (large bounding box)
    if (result.boundingbox) {
      const [south, north, west, east] = result.boundingbox.map(parseFloat);
      const area = (north - south) * (east - west);
      if (area > 0.001) confidence -= 0.1; // Large area, less precise
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Enforce rate limiting
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.RATE_LIMIT_MS) {
      const waitTime = this.RATE_LIMIT_MS - timeSinceLastRequest;
      console.log(`[Geocoding] Rate limiting: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      requestCount: this.requestCount,
      cacheHitRate: this.cache.size > 0 ? this.cache.size / this.requestCount : 0,
    };
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clean address string
   */
  private cleanAddress(address: string): string {
    if (!address || typeof address !== 'string') {
      return '';
    }
    
    // Remove extra whitespace and trim
    let cleaned = address.trim().replace(/\s+/g, ' ');
    
    // Remove common unwanted characters
    cleaned = cleaned.replace(/[\n\r\t]/g, ' ');
    
    // Remove multiple spaces
    cleaned = cleaned.replace(/\s{2,}/g, ' ');
    
    return cleaned;
  }

  /**
   * Remove building numbers from Japanese addresses for better geocoding
   * Examples:
   * - "三田2丁目 20番17号" -> "三田2丁目"
   * - "花畑4丁目33番5号" -> "花畑4丁目"
   * - "本町 41-12" -> "本町"
   * - "二宮 1180-1" -> "二宮"
   * - "西蒲田7丁目12番12号" -> "西蒲田7丁目"
   */
  private removeBuildingNumbers(address: string): string {
    // Remove patterns like "20番17号" or "33番5号" or "12番12号"
    let cleaned = address.replace(/\s*\d+番\d+号/g, '');
    
    // Remove patterns like "1番", "2番" etc without 号
    cleaned = cleaned.replace(/\s+\d+番(?!号)/g, '');
    
    // Remove patterns like "41-12" or "1180-1" (hyphenated building numbers anywhere in the string)
    cleaned = cleaned.replace(/\s+\d+-\d+/g, '');
    
    // Remove trailing numbers that might be building numbers (but keep 丁目 numbers)
    cleaned = cleaned.replace(/\s+\d+(?!丁目)$/g, '');
    
    // Clean up any extra spaces
    cleaned = cleaned.trim().replace(/\s+/g, ' ');
    
    return cleaned;
  }
}

// Export singleton instance
export const geocodingService = GeocodingService.getInstance();