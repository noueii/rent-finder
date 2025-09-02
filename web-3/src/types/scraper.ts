// Scraper-related types
export interface ScraperConfig {
  name: string;
  baseUrl: string;
  rateLimit: number; // milliseconds between requests
  maxRetries: number;
  timeout: number; // request timeout in milliseconds
  headers?: Record<string, string>;
  proxies?: ProxyConfig[];
}

export interface ProxyConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  protocol?: 'http' | 'https' | 'socks4' | 'socks5';
}

export interface ScrapeResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: ScraperError;
  metadata?: ScrapeMetadata;
}

export interface ScrapeMetadata {
  url: string;
  scrapedAt: Date;
  duration: number; // milliseconds
  retries: number;
  proxy?: string;
}

export interface ScraperError {
  code: ScraperErrorCode;
  message: string;
  details?: unknown;
  retryable: boolean;
}

export enum ScraperErrorCode {
  RATE_LIMIT = 'RATE_LIMIT',
  TIMEOUT = 'TIMEOUT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PARSE_ERROR = 'PARSE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  BLOCKED = 'BLOCKED',
  NOT_FOUND = 'NOT_FOUND',
  UNKNOWN = 'UNKNOWN',
}

// Apartment data validation schema types
export interface ScrapedApartmentData {
  externalId: string;
  sourceUrl: string;
  sourceSite: string;
  agent?: string;
  
  // Basic info
  title: string;
  price: number;
  size: number;
  layout?: string;
  floor?: number;
  totalFloors?: number;
  buildingAge?: number;
  
  // Location
  address: string;
  area?: string;      // Neighborhood/area (e.g., "Iriya")
  ward?: string;      // Ward name without -ku suffix (e.g., "Taito")
  city?: string;      // City (e.g., "Tokyo")
  prefecture?: string; // Prefecture (e.g., "Tokyo")
  latitude?: number;
  longitude?: number;
  
  // Details
  description?: string;
  amenities: string[];
  availability: 'available' | 'occupied' | 'unknown';
  
  // Fees
  feesTotal?: number;
  feesJson?: {
    deposit?: number;         // 敷金 (shikikin)
    keyMoney?: number;        // 礼金 (reikin)
    agencyFee?: number;       // 仲介手数料 (chukai tesuryo)
    guarantorFee?: number;    // 保証会社利用料 (hosho kaisha)
    insurance?: number;       // 火災保険 (kasai hoken)
    managementFee?: number;   // 管理費・共益費 (kanrihi/kyoekihi)
    other?: Record<string, number>; // Other fees like key exchange, cleaning, etc.
  };
  
  // Images
  images: ScrapedImageData[];
  
  // Station info
  nearestStations: ScrapedStationData[];
  
  // Internal fields (added by scrapers for removal detection)
  _isRemoved?: boolean;
  _removalReason?: string;
  _removalConfidence?: 'high' | 'medium' | 'low';
}

export interface ScrapedImageData {
  url: string;
  caption?: string;
  order?: number;
}

export interface ScrapedStationData {
  name: string;
  walkingMinutes: number;
  distance?: number;
  lines?: string[];
}

// Search parameters for scrapers
export interface ScraperSearchParams {
  minPrice?: number;
  maxPrice?: number;
  minSize?: number;
  maxSize?: number;
  layout?: string[];
  maxWalkingMinutes?: number;
  stationNames?: string[];
  page?: number;
  limit?: number;
  fetchAll?: boolean; // If true, fetch all available pages instead of respecting limit
  onProgress?: ScrapeProgressCallback; // Progress callback
}

// Progress tracking for long-running scrapes
export interface ScrapeProgress {
  total: number;
  completed: number;
  failed: number;
  currentPage?: number;
  totalPages?: number;
  startedAt: Date;
  estimatedTimeRemaining?: number;
}

export type ScrapeProgressCallback = (progress: ScrapeProgress) => void;