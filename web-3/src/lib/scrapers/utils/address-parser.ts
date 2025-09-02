/**
 * Address parsing utilities for Japanese addresses
 */

// List of Tokyo's 23 special wards (without -ku suffix)
export const TOKYO_WARDS = [
  'Adachi', 'Arakawa', 'Bunkyo', 'Chiyoda', 'Chuo', 'Edogawa',
  'Itabashi', 'Katsushika', 'Kita', 'Koto', 'Meguro', 'Minato',
  'Nakano', 'Nerima', 'Ota', 'Setagaya', 'Shibuya', 'Shinagawa',
  'Shinjuku', 'Suginami', 'Sumida', 'Taito', 'Toshima'
] as const;

export type TokyoWard = typeof TOKYO_WARDS[number];

export interface ParsedAddress {
  fullAddress: string;
  area?: string;
  ward?: string;
  city?: string;
  prefecture?: string;
  postalCode?: string;
}

/**
 * Parse Japanese address components from various formats
 * 
 * Supported formats:
 * - "IriyaTaito-ku, Tokyo" -> area: Iriya, ward: Taito, city: Tokyo
 * - "Iriya, Taito-ku, Tokyo" -> area: Iriya, ward: Taito, city: Tokyo
 * - "Taito-ku, Tokyo" -> ward: Taito, city: Tokyo
 * - "1-2-3 Iriya, Taito-ku, Tokyo" -> area: Iriya, ward: Taito, city: Tokyo
 * - "〒123-4567 Tokyo, Taito-ku, Iriya 1-2-3" -> area: Iriya, ward: Taito, city: Tokyo, postalCode: 123-4567
 */
export function parseJapaneseAddress(address: string): ParsedAddress {
  if (!address) {
    return { fullAddress: '' };
  }

  let cleanAddress = address.trim();
  
  // Remove leading "in " if present (common in RealEstate.co.jp format)
  if (cleanAddress.toLowerCase().startsWith('in ')) {
    cleanAddress = cleanAddress.substring(3);
  }
  let area: string | undefined;
  let ward: string | undefined;
  let city: string | undefined;
  let prefecture: string | undefined;
  let postalCode: string | undefined;

  // Extract postal code if present
  const postalCodeMatch = cleanAddress.match(/〒?(\d{3}-?\d{4})/);
  if (postalCodeMatch) {
    postalCode = postalCodeMatch[1];
  }

  // Remove postal code from address for easier parsing
  const addressWithoutPostal = cleanAddress.replace(/〒?\d{3}-?\d{4}\s*/, '');

  // Try to detect if it's a specific format
  if (addressWithoutPostal.includes('-ku')) {
    // Format with -ku suffix
    const parts = addressWithoutPostal.split(',').map(p => p.trim());
    
    for (const part of parts) {
      if (part.includes('-ku')) {
        // This part contains the ward
        const wardMatch = extractWardFromKuString(part);
        if (wardMatch) {
          ward = wardMatch.ward;
          area = wardMatch.area;
        }
      } else if (isTokyoWard(part)) {
        ward = part;
      } else if (part === 'Tokyo' || part === '東京' || part === '東京都') {
        city = 'Tokyo';
        prefecture = 'Tokyo';
      } else if (!area && !part.match(/^\d/)) {
        // If not starting with number and no area yet, assume it's area
        area = part;
      }
    }
  } else {
    // Try to parse English format or other formats
    const parts = addressWithoutPostal.split(',').map(p => p.trim());
    
    for (const part of parts) {
      if (part.includes('Ward')) {
        // English format "Taito Ward"
        ward = part.replace(/\s*Ward\s*/, '');
      } else if (isTokyoWard(part)) {
        ward = part;
      } else if (part === 'Tokyo' || part === '東京' || part === '東京都') {
        city = 'Tokyo';
        prefecture = 'Tokyo';
      } else if (!area) {
        area = part;
      }
    }
  }

  // Default city and prefecture to Tokyo if ward is present but city isn't
  if (ward && !city) {
    city = 'Tokyo';
    prefecture = 'Tokyo';
  }

  // Build the structured address
  const addressParts: string[] = [];
  if (area) addressParts.push(area);
  if (ward) addressParts.push(`${ward}-ku`);
  if (city) addressParts.push(city);
  if (prefecture && prefecture !== city) addressParts.push(prefecture);

  return {
    fullAddress: addressParts.join(', ') || cleanAddress,
    area,
    ward,
    city,
    prefecture,
    postalCode
  };
}

/**
 * Extract ward and area from a string containing -ku
 * Examples:
 * - "IriyaTaito-ku" -> { area: "Iriya", ward: "Taito" }
 * - "Taito-ku" -> { ward: "Taito" }
 * - "1-2-3 Iriya, Taito-ku" -> { area: "Iriya", ward: "Taito" }
 */
function extractWardFromKuString(str: string): { ward?: string; area?: string } | null {
  const kuIndex = str.indexOf('-ku');
  if (kuIndex === -1) return null;

  const beforeKu = str.substring(0, kuIndex);
  
  // Check each Tokyo ward to see if it's in the string
  for (const wardName of TOKYO_WARDS) {
    const wardIndex = beforeKu.lastIndexOf(wardName);
    if (wardIndex !== -1) {
      const beforeWard = beforeKu.substring(0, wardIndex).trim();
      
      // Clean up area - remove building numbers if present
      let area: string | undefined;
      if (beforeWard) {
        // Remove leading numbers and hyphens (building/apartment numbers)
        area = beforeWard.replace(/^\d+(-\d+)*\s*/, '').trim();
        // If area contains comma, take the part after comma
        if (area.includes(',')) {
          const parts = area.split(',');
          area = parts[parts.length - 1].trim();
        }
      }
      
      return {
        ward: wardName,
        area: area || undefined
      };
    }
  }

  // If no known ward found, the whole string before -ku might be the ward
  return { ward: beforeKu.trim() };
}

/**
 * Check if a string is a Tokyo ward name
 */
function isTokyoWard(str: string): boolean {
  const normalized = str.trim().replace(/-ku$/, '');
  return TOKYO_WARDS.includes(normalized as TokyoWard);
}

/**
 * Format address components into a standard string
 */
export function formatAddress(components: Partial<ParsedAddress>): string {
  const parts: string[] = [];
  
  if (components.area) parts.push(components.area);
  if (components.ward) parts.push(`${components.ward}-ku`);
  if (components.city) parts.push(components.city);
  if (components.prefecture && components.prefecture !== components.city) {
    parts.push(components.prefecture);
  }
  
  return parts.join(', ');
}