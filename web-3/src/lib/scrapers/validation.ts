import { z } from 'zod';
import { ScrapedApartmentData, ScrapedImageData, ScrapedStationData } from '~/types/scraper';

/**
 * Validation schemas for scraped data
 */

// Image validation
export const imageSchema = z.object({
  url: z.string().url('Invalid image URL'),
  caption: z.string().optional(),
  order: z.number().int().min(0).optional(),
});

// Station validation
export const stationSchema = z.object({
  name: z.string().min(1, 'Station name is required'),
  walkingMinutes: z.number().int().positive('Walking minutes must be positive'),
  distance: z.number().positive().optional(),
  lines: z.array(z.string()).optional(),
});

// Main apartment validation
export const apartmentSchema = z.object({
  externalId: z.string().min(1, 'External ID is required'),
  sourceUrl: z.string().url('Invalid source URL'),
  sourceSite: z.string().min(1, 'Source site is required'),
  
  // Basic info
  title: z.string().min(1, 'Title is required'),
  price: z.number().positive('Price must be positive'),
  size: z.number().positive('Size must be positive'),
  layout: z.string().optional(),
  floor: z.number().int().optional(),
  totalFloors: z.number().int().positive().optional(),
  buildingAge: z.number().int().min(0).optional(),
  
  // Location
  address: z.string().min(1, 'Address is required'),
  area: z.string().optional(),
  ward: z.string().optional(),
  city: z.string().optional(),
  prefecture: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  
  // Details
  description: z.string().optional(),
  amenities: z.array(z.string()),
  availability: z.enum(['available', 'occupied', 'unknown']),
  
  // Fees
  feesTotal: z.number().int().min(0).optional(),
  feesJson: z.object({
    deposit: z.number().optional(),
    keyMoney: z.number().optional(),
    agencyFee: z.number().optional(),
    guarantorFee: z.number().optional(),
    insurance: z.number().optional(),
    managementFee: z.number().optional(),
    other: z.record(z.string(), z.number()).optional(),
  }).optional(),
  
  // Related data
  images: z.array(imageSchema),
  nearestStations: z.array(stationSchema).min(1, 'At least one station is required'),
});

/**
 * Validate apartment data with detailed error reporting
 */
export function validateApartmentData(
  data: unknown
): { success: true; data: ScrapedApartmentData } | { success: false; errors: string[] } {
  try {
    const validated = apartmentSchema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      return { success: false, errors };
    }
    return { success: false, errors: ['Unknown validation error'] };
  }
}

/**
 * Sanitize and normalize apartment data
 */
export function sanitizeApartmentData(data: Partial<ScrapedApartmentData>): Partial<ScrapedApartmentData> {
  const sanitized: Partial<ScrapedApartmentData> = {};
  
  // Basic info
  if (data.externalId) sanitized.externalId = data.externalId.trim();
  if (data.sourceUrl) sanitized.sourceUrl = data.sourceUrl.trim();
  if (data.sourceSite) sanitized.sourceSite = data.sourceSite.trim().toLowerCase();
  
  if (data.title) sanitized.title = sanitizeText(data.title);
  if (typeof data.price === 'number') sanitized.price = Math.round(data.price);
  if (typeof data.size === 'number') sanitized.size = Math.round(data.size * 100) / 100;
  
  if (data.layout) sanitized.layout = data.layout.trim().toUpperCase();
  if (typeof data.floor === 'number') sanitized.floor = Math.floor(data.floor);
  if (typeof data.totalFloors === 'number') sanitized.totalFloors = Math.floor(data.totalFloors);
  if (typeof data.buildingAge === 'number') sanitized.buildingAge = Math.floor(data.buildingAge);
  
  // Location
  if (data.address) sanitized.address = sanitizeText(data.address);
  if (typeof data.latitude === 'number') sanitized.latitude = data.latitude;
  if (typeof data.longitude === 'number') sanitized.longitude = data.longitude;
  
  // Details
  if (data.description) sanitized.description = sanitizeText(data.description);
  if (Array.isArray(data.amenities)) {
    sanitized.amenities = data.amenities
      .map(a => sanitizeText(a))
      .filter(a => a.length > 0);
  }
  if (data.availability) sanitized.availability = data.availability;
  
  // Images
  if (Array.isArray(data.images)) {
    sanitized.images = data.images
      .filter(img => img.url && isValidUrl(img.url))
      .map((img, index) => ({
        url: img.url.trim(),
        caption: img.caption ? sanitizeText(img.caption) : undefined,
        order: img.order ?? index,
      }));
  }
  
  // Stations
  if (Array.isArray(data.nearestStations)) {
    sanitized.nearestStations = data.nearestStations
      .filter(station => station.name && station.walkingMinutes > 0)
      .map(station => ({
        name: sanitizeText(station.name),
        walkingMinutes: Math.round(station.walkingMinutes),
        distance: station.distance ? Math.round(station.distance) : undefined,
        lines: station.lines?.map(line => sanitizeText(line)).filter(l => l.length > 0),
      }));
  }
  
  return sanitized;
}

/**
 * Sanitize text by removing excessive whitespace and control characters
 */
function sanitizeText(text: string): string {
  return text
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Check if a string is a valid URL
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Merge multiple apartment data objects (for updating)
 */
export function mergeApartmentData(
  existing: ScrapedApartmentData,
  updates: Partial<ScrapedApartmentData>
): ScrapedApartmentData {
  const merged = { ...existing };
  
  // Update simple fields
  Object.keys(updates).forEach(key => {
    const value = updates[key as keyof ScrapedApartmentData];
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        // For arrays, replace entirely (don't merge)
        (merged as any)[key] = value;
      } else if (typeof value === 'object') {
        // For objects, shallow merge
        (merged as any)[key] = { ...(existing as any)[key], ...value };
      } else {
        // For primitives, direct assignment
        (merged as any)[key] = value;
      }
    }
  });
  
  return merged;
}

/**
 * Check if apartment data is complete enough to save
 */
export function isCompleteApartmentData(data: Partial<ScrapedApartmentData>): boolean {
  return !!(
    data.externalId &&
    data.sourceUrl &&
    data.sourceSite &&
    data.title &&
    data.price &&
    data.size &&
    data.address &&
    data.nearestStations &&
    data.nearestStations.length > 0
  );
}

/**
 * Calculate a quality score for apartment data (0-100)
 */
export function calculateDataQuality(data: ScrapedApartmentData): number {
  let score = 0;
  const weights = {
    basic: 40,    // Required fields
    location: 20, // Coordinates
    details: 20,  // Description, amenities
    images: 20,   // Images
  };
  
  // Basic required fields (always present if validated)
  score += weights.basic;
  
  // Location data
  if (data.latitude && data.longitude) {
    score += weights.location;
  }
  
  // Details
  const detailScore = weights.details;
  let detailPoints = 0;
  
  if (data.description && data.description.length > 50) {
    detailPoints += 0.4;
  }
  if (data.amenities.length > 3) {
    detailPoints += 0.3;
  }
  if (data.layout) {
    detailPoints += 0.1;
  }
  if (data.floor !== undefined && data.totalFloors !== undefined) {
    detailPoints += 0.1;
  }
  if (data.buildingAge !== undefined) {
    detailPoints += 0.1;
  }
  
  score += detailScore * detailPoints;
  
  // Images
  if (data.images.length > 0) {
    const imagePoints = Math.min(data.images.length / 5, 1); // Max points at 5 images
    score += weights.images * imagePoints;
  }
  
  return Math.round(score);
}