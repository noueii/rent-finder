/**
 * Mock factories for testing
 */

import { faker } from '@faker-js/faker';
import type { 
  UserId, 
  ApartmentId, 
  StationId,
  createUserId,
  createApartmentId,
  createStationId
} from '../types';

// Import the functions properly
import { 
  createUserId as createUserIdFn,
  createApartmentId as createApartmentIdFn,
  createStationId as createStationIdFn
} from '../types';

/**
 * Base factory interface
 */
export interface Factory<T> {
  build(overrides?: Partial<T>): T;
  buildMany(count: number, overrides?: Partial<T>): T[];
}

/**
 * Create a factory function
 */
export function createFactory<T>(
  builder: (overrides?: Partial<T>) => T
): Factory<T> {
  return {
    build: (overrides) => builder(overrides),
    buildMany: (count, overrides) => 
      Array.from({ length: count }, () => builder(overrides)),
  };
}

/**
 * User factory
 */
export interface MockUser {
  id: UserId;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export const userFactory = createFactory<MockUser>((overrides) => ({
  id: createUserIdFn(faker.string.uuid()),
  email: faker.internet.email(),
  name: faker.person.fullName(),
  createdAt: faker.date.past(),
  updatedAt: faker.date.recent(),
  ...overrides,
}));

/**
 * Station factory
 */
export interface MockStation {
  id: StationId;
  name: string;
  nameEn: string;
  lines: string[];
  latitude: number;
  longitude: number;
}

export const stationFactory = createFactory<MockStation>((overrides) => ({
  id: createStationIdFn(faker.string.uuid()),
  name: faker.location.city() + '駅',
  nameEn: faker.location.city() + ' Station',
  lines: [faker.company.name() + ' Line'],
  latitude: faker.location.latitude(),
  longitude: faker.location.longitude(),
  ...overrides,
}));

/**
 * Apartment factory
 */
export interface MockApartment {
  id: ApartmentId;
  title: string;
  rent: number;
  size: number;
  layout: string;
  address: string;
  nearestStationId: StationId;
  walkingMinutes: number;
  imageUrl?: string;
  availableFrom: Date;
}

export const apartmentFactory = createFactory<MockApartment>((overrides) => ({
  id: createApartmentIdFn(faker.string.uuid()),
  title: faker.lorem.sentence(3),
  rent: faker.number.int({ min: 50000, max: 300000 }),
  size: faker.number.float({ min: 15, max: 100, fractionDigits: 1 }),
  layout: faker.helpers.arrayElement(['1K', '1DK', '1LDK', '2K', '2DK', '2LDK', '3LDK']),
  address: faker.location.streetAddress(),
  nearestStationId: createStationIdFn(faker.string.uuid()),
  walkingMinutes: faker.number.int({ min: 1, max: 20 }),
  imageUrl: faker.image.url(),
  availableFrom: faker.date.future(),
  ...overrides,
}));

/**
 * Search criteria factory
 */
export interface MockSearchCriteria {
  workplaceStationId: StationId;
  maxCommuteTime: number;
  maxRent?: number;
  minSize?: number;
  layout?: string[];
}

export const searchCriteriaFactory = createFactory<MockSearchCriteria>((overrides) => ({
  workplaceStationId: createStationIdFn(faker.string.uuid()),
  maxCommuteTime: faker.number.int({ min: 15, max: 60 }),
  maxRent: faker.number.int({ min: 50000, max: 200000 }),
  minSize: faker.number.int({ min: 20, max: 50 }),
  layout: faker.helpers.arrayElements(['1K', '1DK', '1LDK', '2K', '2DK', '2LDK'], 2),
  ...overrides,
}));

/**
 * Scraper job factory
 */
export interface MockScraperJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  totalItems: number;
  processedItems: number;
  errors: string[];
  startedAt?: Date;
  completedAt?: Date;
}

export const scraperJobFactory = createFactory<MockScraperJob>((overrides) => {
  const status = overrides?.status || faker.helpers.arrayElement(['pending', 'running', 'completed', 'failed']);
  const totalItems = faker.number.int({ min: 10, max: 1000 });
  const processedItems = status === 'completed' 
    ? totalItems 
    : faker.number.int({ min: 0, max: totalItems });

  return {
    id: faker.string.uuid(),
    status,
    progress: (processedItems / totalItems) * 100,
    totalItems,
    processedItems,
    errors: status === 'failed' ? [faker.lorem.sentence()] : [],
    startedAt: status !== 'pending' ? faker.date.recent() : undefined,
    completedAt: status === 'completed' ? faker.date.recent() : undefined,
    ...overrides,
  };
});

/**
 * API response factory
 */
export interface MockApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
  headers: Record<string, string>;
}

export function createApiResponseFactory<T>(
  dataFactory: Factory<T>
): Factory<MockApiResponse<T>> {
  return createFactory<MockApiResponse<T>>((overrides) => {
    const isError = overrides?.error || faker.datatype.boolean({ probability: 0.1 });
    
    return {
      data: isError ? undefined : dataFactory.build(),
      error: isError ? faker.lorem.sentence() : undefined,
      status: isError ? faker.helpers.arrayElement([400, 401, 403, 404, 500]) : 200,
      headers: {
        'content-type': 'application/json',
        'x-request-id': faker.string.uuid(),
        ...overrides?.headers,
      },
      ...overrides,
    };
  });
}

/**
 * Database record factory helpers
 */
export function withTimestamps<T>(record: T): T & { createdAt: Date; updatedAt: Date } {
  return {
    ...record,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
  };
}

export function withId<T>(record: T, id?: string): T & { id: string } {
  return {
    ...record,
    id: id || faker.string.uuid(),
  };
}

/**
 * Create a sequence generator
 */
export function createSequence(prefix = ''): () => string {
  let counter = 0;
  return () => `${prefix}${++counter}`;
}

/**
 * Create a mock file
 */
export interface MockFile {
  name: string;
  size: number;
  type: string;
  content: string;
}

export const fileFactory = createFactory<MockFile>((overrides) => ({
  name: faker.system.fileName(),
  size: faker.number.int({ min: 100, max: 10000000 }),
  type: faker.system.mimeType(),
  content: faker.lorem.paragraphs(3),
  ...overrides,
}));

/**
 * Create mock dates
 */
export const dateFactory = {
  past: (years = 1) => faker.date.past({ years }),
  future: (years = 1) => faker.date.future({ years }),
  recent: (days = 10) => faker.date.recent({ days }),
  between: (from: Date, to: Date) => faker.date.between({ from, to }),
  soon: (days = 10) => faker.date.soon({ days }),
};

/**
 * Reset faker seed for consistent tests
 */
export function resetFactorySeed(seed = 123): void {
  faker.seed(seed);
}

/**
 * Export all factories
 */
export const factories = {
  user: userFactory,
  station: stationFactory,
  apartment: apartmentFactory,
  searchCriteria: searchCriteriaFactory,
  scraperJob: scraperJobFactory,
  file: fileFactory,
  date: dateFactory,
} as const;