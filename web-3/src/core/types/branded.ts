/**
 * Branded types for type-safe IDs and values
 */

/**
 * Create a branded type
 */
export type Brand<K, T> = K & { __brand: T };

/**
 * User ID branded type
 */
export type UserId = Brand<string, 'UserId'>;

/**
 * Apartment ID branded type
 */
export type ApartmentId = Brand<string, 'ApartmentId'>;

/**
 * Station ID branded type
 */
export type StationId = Brand<string, 'StationId'>;

/**
 * Session ID branded type
 */
export type SessionId = Brand<string, 'SessionId'>;

/**
 * Scraper Job ID branded type
 */
export type ScraperJobId = Brand<string, 'ScraperJobId'>;

/**
 * Email branded type
 */
export type Email = Brand<string, 'Email'>;

/**
 * URL branded type
 */
export type Url = Brand<string, 'Url'>;

/**
 * Positive number branded type
 */
export type PositiveNumber = Brand<number, 'PositiveNumber'>;

/**
 * Non-negative number branded type
 */
export type NonNegativeNumber = Brand<number, 'NonNegativeNumber'>;

/**
 * Percentage branded type (0-100)
 */
export type Percentage = Brand<number, 'Percentage'>;

/**
 * Timestamp branded type
 */
export type Timestamp = Brand<number, 'Timestamp'>;

/**
 * Date string branded type (ISO 8601)
 */
export type DateString = Brand<string, 'DateString'>;

/**
 * Currency amount branded type
 */
export type CurrencyAmount = Brand<number, 'CurrencyAmount'>;

/**
 * Create a UserId
 */
export function createUserId(id: string): UserId {
  return id as UserId;
}

/**
 * Create an ApartmentId
 */
export function createApartmentId(id: string): ApartmentId {
  return id as ApartmentId;
}

/**
 * Create a StationId
 */
export function createStationId(id: string): StationId {
  return id as StationId;
}

/**
 * Create a SessionId
 */
export function createSessionId(id: string): SessionId {
  return id as SessionId;
}

/**
 * Create a ScraperJobId
 */
export function createScraperJobId(id: string): ScraperJobId {
  return id as ScraperJobId;
}

/**
 * Create an Email (with validation)
 */
export function createEmail(email: string): Email | null {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return null;
  }
  return email as Email;
}

/**
 * Create a URL (with validation)
 */
export function createUrl(url: string): Url | null {
  try {
    new URL(url);
    return url as Url;
  } catch {
    return null;
  }
}

/**
 * Create a PositiveNumber
 */
export function createPositiveNumber(n: number): PositiveNumber | null {
  if (n <= 0) return null;
  return n as PositiveNumber;
}

/**
 * Create a NonNegativeNumber
 */
export function createNonNegativeNumber(n: number): NonNegativeNumber | null {
  if (n < 0) return null;
  return n as NonNegativeNumber;
}

/**
 * Create a Percentage
 */
export function createPercentage(n: number): Percentage | null {
  if (n < 0 || n > 100) return null;
  return n as Percentage;
}

/**
 * Create a Timestamp
 */
export function createTimestamp(date: Date = new Date()): Timestamp {
  return date.getTime() as Timestamp;
}

/**
 * Create a DateString
 */
export function createDateString(date: Date = new Date()): DateString {
  return date.toISOString() as DateString;
}

/**
 * Create a CurrencyAmount
 */
export function createCurrencyAmount(amount: number): CurrencyAmount | null {
  if (amount < 0) return null;
  // Round to 2 decimal places
  const rounded = Math.round(amount * 100) / 100;
  return rounded as CurrencyAmount;
}

/**
 * Type guard for branded types
 */
export function isBranded<T extends Brand<any, any>>(
  value: unknown,
  validator: (v: unknown) => boolean
): value is T {
  return validator(value);
}

/**
 * Extract the base type from a branded type
 */
export type UnBrand<T> = T extends Brand<infer K, any> ? K : T;

/**
 * Create a branded type factory
 */
export function brandFactory<T extends Brand<any, any>>(
  validator: (value: any) => boolean
) {
  return (value: UnBrand<T>): T | null => {
    if (!validator(value)) return null;
    return value as T;
  };
}