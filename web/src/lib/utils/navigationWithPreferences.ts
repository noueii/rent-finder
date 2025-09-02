import { UserSettings } from '@/lib/stores/localStorage';

/**
 * Constructs URLs for navigation pages with user preferences
 */

type PageType = 'browse' | 'map';

interface BrowseParams {
  station?: string;
  maxTime?: number;
  maxRent?: number;
  minRooms?: number;
  minSize?: number;
  maxSize?: number;
  area?: string;
  sortBy?: string;
}

interface MapParams {
  station?: string;
  commuteTime?: number;
  minPrice?: number;
  maxPrice?: number;
  minSize?: number;
  maxSize?: number;
}

/**
 * Maps user preferences sort values to page-specific sort values
 */
function mapSortPreference(sortBy: string | undefined, page: PageType): string | undefined {
  if (!sortBy) return undefined;
  
  // Browse page uses different sort values
  if (page === 'browse') {
    const browseMap: Record<string, string> = {
      'price_asc': 'rent_asc',
      'price_desc': 'rent_desc',
      'size_asc': 'size_asc',
      'size_desc': 'size_desc',
      'commute_asc': 'commute_time',
      'updated_desc': 'newest',
    };
    return browseMap[sortBy] || sortBy;
  }
  
  return sortBy;
}

/**
 * Constructs a browse page URL with user preferences
 */
export function constructBrowseUrl(
  userSettings: UserSettings,
  overrides: BrowseParams = {}
): string {
  const params = new URLSearchParams();
  
  // Station and commute time
  const station = overrides.station || userSettings.defaultCommuteStation;
  const maxTime = overrides.maxTime ?? userSettings.defaultCommuteTime;
  
  if (station) params.set('station', station);
  if (maxTime) params.set('maxTime', maxTime.toString());
  
  // Price
  const maxRent = overrides.maxRent ?? userSettings.defaultPriceRange?.max;
  if (maxRent) params.set('maxRent', maxRent.toString());
  
  // Size
  const minSize = overrides.minSize ?? userSettings.defaultSizeRange?.min;
  const maxSize = overrides.maxSize ?? userSettings.defaultSizeRange?.max;
  if (minSize) params.set('minSize', minSize.toString());
  if (maxSize) params.set('maxSize', maxSize.toString());
  
  // Rooms (derived from layouts)
  if (overrides.minRooms) {
    params.set('minRooms', overrides.minRooms.toString());
  } else if (userSettings.defaultLayouts?.length) {
    // Extract room numbers from layouts like "1LDK", "2K", etc.
    const roomNumbers = userSettings.defaultLayouts
      .map(layout => parseInt(layout.match(/^(\d+)/)?.[1] || '0'))
      .filter(n => n > 0);
    if (roomNumbers.length > 0) {
      const minRooms = Math.min(...roomNumbers);
      params.set('minRooms', minRooms.toString());
    }
  }
  
  // Area and sort
  if (overrides.area) params.set('area', overrides.area);
  const sortBy = mapSortPreference(overrides.sortBy || userSettings.defaultSortBy, 'browse');
  if (sortBy) params.set('sortBy', sortBy);
  
  return `/browse?${params.toString()}`;
}

/**
 * Constructs a map page URL with user preferences
 */
export function constructMapUrl(
  userSettings: UserSettings,
  overrides: MapParams = {}
): string {
  const params = new URLSearchParams();
  
  // Station and commute time (required for map)
  const station = overrides.station || userSettings.defaultCommuteStation;
  const commuteTime = overrides.commuteTime ?? userSettings.defaultCommuteTime;
  
  if (station) params.set('station', station);
  if (commuteTime) params.set('commuteTime', commuteTime.toString());
  
  // Price range
  const minPrice = overrides.minPrice ?? userSettings.defaultPriceRange?.min;
  const maxPrice = overrides.maxPrice ?? userSettings.defaultPriceRange?.max;
  if (minPrice) params.set('minPrice', minPrice.toString());
  if (maxPrice) params.set('maxPrice', maxPrice.toString());
  
  // Size range
  const minSize = overrides.minSize ?? userSettings.defaultSizeRange?.min;
  const maxSize = overrides.maxSize ?? userSettings.defaultSizeRange?.max;
  if (minSize) params.set('minSize', minSize.toString());
  if (maxSize) params.set('maxSize', maxSize.toString());
  
  return `/map?${params.toString()}`;
}

/**
 * Main function to construct URLs with user preferences
 */
export function constructUrlWithPreferences(
  page: PageType,
  userSettings: UserSettings,
  overrides: Record<string, any> = {}
): string {
  switch (page) {
    case 'browse':
      return constructBrowseUrl(userSettings, overrides as BrowseParams);
    case 'map':
      return constructMapUrl(userSettings, overrides as MapParams);
    default:
      return `/${page}`;
  }
}