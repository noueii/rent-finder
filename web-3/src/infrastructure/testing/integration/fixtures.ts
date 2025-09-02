import { PrismaClient, Prisma } from '@prisma/client';
import { faker } from '@faker-js/faker';

// Test data factories
export const factories = {
  user: (overrides?: Partial<Prisma.UserCreateInput>): Prisma.UserCreateInput => ({
    email: faker.internet.email(),
    name: faker.person.fullName(),
    emailVerified: new Date(),
    ...overrides,
  }),

  station: (overrides?: Partial<Prisma.StationCreateInput>): Prisma.StationCreateInput => ({
    stationId: faker.string.uuid(),
    name: faker.location.city(),
    nameKana: faker.location.city(),
    latitude: parseFloat(faker.location.latitude()),
    longitude: parseFloat(faker.location.longitude()),
    lines: {
      create: [],
    },
    ...overrides,
  }),

  apartment: (overrides?: Partial<Prisma.ApartmentCreateInput>): Prisma.ApartmentCreateInput => ({
    externalId: faker.string.uuid(),
    title: faker.lorem.sentence(),
    address: faker.location.streetAddress(),
    rent: faker.number.int({ min: 50000, max: 300000 }),
    size: faker.number.float({ min: 15, max: 100, precision: 0.1 }),
    age: faker.number.int({ min: 0, max: 50 }),
    floor: faker.number.int({ min: 1, max: 20 }),
    totalFloors: faker.number.int({ min: 2, max: 30 }),
    deposit: faker.number.int({ min: 0, max: 3 }),
    keyMoney: faker.number.int({ min: 0, max: 3 }),
    managementFee: faker.number.int({ min: 0, max: 20000 }),
    layout: faker.helpers.arrayElement(['1K', '1DK', '1LDK', '2K', '2DK', '2LDK', '3LDK']),
    description: faker.lorem.paragraph(),
    features: faker.lorem.words(5).split(' '),
    images: Array.from({ length: 3 }, () => faker.image.url()),
    availableFrom: faker.date.future(),
    lastScraped: new Date(),
    sourceUrl: faker.internet.url(),
    source: faker.helpers.arrayElement(['SUUMO', 'HOMES', 'ATHOME']),
    latitude: parseFloat(faker.location.latitude()),
    longitude: parseFloat(faker.location.longitude()),
    ...overrides,
  }),

  searchPreset: (userId: string, overrides?: Partial<Prisma.SearchPresetCreateInput>): Prisma.SearchPresetCreateInput => ({
    name: faker.lorem.words(2),
    filters: {
      maxCommuteTime: faker.number.int({ min: 10, max: 60 }),
      maxRent: faker.number.int({ min: 50000, max: 200000 }),
      minSize: faker.number.int({ min: 15, max: 30 }),
      layout: faker.helpers.arrayElement(['1K', '1DK', '1LDK', '2LDK']),
    },
    user: {
      connect: { id: userId },
    },
    ...overrides,
  }),

  favorite: (userId: string, apartmentId: string): Prisma.FavoriteCreateInput => ({
    user: {
      connect: { id: userId },
    },
    apartment: {
      connect: { id: apartmentId },
    },
  }),
};

// Seed functions
export const seedDatabase = async (prisma: PrismaClient) => {
  // Create test users
  const users = await Promise.all(
    Array.from({ length: 3 }, () =>
      prisma.user.create({ data: factories.user() })
    )
  );

  // Create test stations
  const stations = await Promise.all(
    Array.from({ length: 10 }, () =>
      prisma.station.create({ data: factories.station() })
    )
  );

  // Create test apartments with nearby stations
  const apartments = await Promise.all(
    Array.from({ length: 20 }, () =>
      prisma.apartment.create({
        data: {
          ...factories.apartment(),
          nearbyStations: {
            create: Array.from({ length: faker.number.int({ min: 1, max: 3 }) }, () => ({
              station: {
                connect: { id: faker.helpers.arrayElement(stations).id },
              },
              walkingTime: faker.number.int({ min: 1, max: 20 }),
              distance: faker.number.int({ min: 50, max: 1500 }),
            })),
          },
        },
      })
    )
  );

  // Create search presets for users
  await Promise.all(
    users.map((user) =>
      prisma.searchPreset.create({
        data: factories.searchPreset(user.id),
      })
    )
  );

  // Create some favorites
  await Promise.all(
    users.slice(0, 2).map((user) =>
      Promise.all(
        faker.helpers.arrayElements(apartments, 3).map((apartment) =>
          prisma.favorite.create({
            data: factories.favorite(user.id, apartment.id),
          })
        )
      )
    )
  );

  return { users, stations, apartments };
};

// Create specific test scenarios
export const createTestScenarios = {
  // Scenario: User searching for apartments near work
  userWithWorkCommute: async (prisma: PrismaClient) => {
    const user = await prisma.user.create({
      data: factories.user({ email: 'commuter@test.com' }),
    });

    const workStation = await prisma.station.create({
      data: factories.station({ name: 'Tokyo Station' }),
    });

    const nearbyStations = await Promise.all(
      Array.from({ length: 5 }, () =>
        prisma.station.create({ data: factories.station() })
      )
    );

    const apartments = await Promise.all(
      nearbyStations.map((station) =>
        prisma.apartment.create({
          data: {
            ...factories.apartment(),
            nearbyStations: {
              create: [{
                station: { connect: { id: station.id } },
                walkingTime: faker.number.int({ min: 5, max: 15 }),
                distance: faker.number.int({ min: 200, max: 1000 }),
              }],
            },
          },
        })
      )
    );

    return { user, workStation, nearbyStations, apartments };
  },

  // Scenario: Apartments with various price ranges
  apartmentsByPriceRange: async (prisma: PrismaClient) => {
    const priceRanges = [
      { min: 50000, max: 80000, count: 5 },
      { min: 80000, max: 120000, count: 8 },
      { min: 120000, max: 200000, count: 4 },
      { min: 200000, max: 500000, count: 2 },
    ];

    const apartments = await Promise.all(
      priceRanges.flatMap(({ min, max, count }) =>
        Array.from({ length: count }, () =>
          prisma.apartment.create({
            data: factories.apartment({
              rent: faker.number.int({ min, max }),
            }),
          })
        )
      )
    );

    return { apartments, priceRanges };
  },
};

// Helper to create test data with relationships
export const createTestDataWithRelationships = async (prisma: PrismaClient) => {
  const data = await seedDatabase(prisma);
  
  // Add search history
  await Promise.all(
    data.users.map((user) =>
      prisma.searchHistory.create({
        data: {
          userId: user.id,
          query: faker.lorem.words(3),
          filters: {
            maxCommuteTime: 30,
            maxRent: 150000,
          },
          resultCount: faker.number.int({ min: 5, max: 50 }),
        },
      })
    )
  );

  return data;
};