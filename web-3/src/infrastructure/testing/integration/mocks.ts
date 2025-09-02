import { rest } from 'msw';
import { faker } from '@faker-js/faker';

// Mock external service responses
export const mockExternalServices = {
  // Mock SUUMO API responses
  suumo: {
    searchResults: () => ({
      properties: Array.from({ length: 10 }, () => ({
        id: faker.string.uuid(),
        title: faker.lorem.sentence(),
        rent: faker.number.int({ min: 50000, max: 300000 }),
        address: faker.location.streetAddress(),
        nearestStation: faker.location.city(),
        walkingTime: faker.number.int({ min: 1, max: 20 }),
      })),
      totalCount: 100,
      page: 1,
    }),

    propertyDetails: (id: string) => ({
      id,
      title: faker.lorem.sentence(),
      rent: faker.number.int({ min: 50000, max: 300000 }),
      size: faker.number.float({ min: 15, max: 100, precision: 0.1 }),
      layout: faker.helpers.arrayElement(['1K', '1DK', '1LDK', '2LDK']),
      age: faker.number.int({ min: 0, max: 50 }),
      floor: faker.number.int({ min: 1, max: 20 }),
      features: faker.lorem.words(5).split(' '),
      images: Array.from({ length: 5 }, () => faker.image.url()),
      description: faker.lorem.paragraph(),
    }),
  },

  // Mock transit API responses
  transit: {
    reachableStations: (originId: string, maxTime: number) => ({
      origin: originId,
      maxTime,
      stations: Array.from({ length: 15 }, () => ({
        stationId: faker.string.uuid(),
        name: faker.location.city(),
        time: faker.number.int({ min: 5, max: maxTime }),
        transfers: faker.number.int({ min: 0, max: 2 }),
        lines: faker.helpers.arrayElements(['Yamanote', 'Chuo', 'Sobu', 'Marunouchi'], 2),
      })),
    }),

    stationInfo: (stationId: string) => ({
      id: stationId,
      name: faker.location.city(),
      nameKana: faker.location.city(),
      lines: faker.helpers.arrayElements(['Yamanote', 'Chuo', 'Sobu', 'Marunouchi'], 2),
      latitude: parseFloat(faker.location.latitude()),
      longitude: parseFloat(faker.location.longitude()),
    }),
  },

  // Mock geocoding service
  geocoding: {
    addressToCoordinates: (address: string) => ({
      address,
      latitude: parseFloat(faker.location.latitude()),
      longitude: parseFloat(faker.location.longitude()),
      confidence: faker.number.float({ min: 0.8, max: 1, precision: 0.01 }),
    }),

    coordinatesToAddress: (lat: number, lng: number) => ({
      latitude: lat,
      longitude: lng,
      address: faker.location.streetAddress(),
      city: faker.location.city(),
      prefecture: 'Tokyo',
    }),
  },
};

// MSW handlers for external services
export const externalServiceHandlers = [
  // SUUMO API handlers
  rest.get('https://api.suumo.jp/v1/properties/search', (req, res, ctx) => {
    return res(ctx.json(mockExternalServices.suumo.searchResults()));
  }),

  rest.get('https://api.suumo.jp/v1/properties/:id', (req, res, ctx) => {
    const { id } = req.params;
    return res(ctx.json(mockExternalServices.suumo.propertyDetails(id as string)));
  }),

  // Transit API handlers
  rest.post('https://api.transit.jp/v1/reachable', async (req, res, ctx) => {
    const body = await req.json();
    return res(ctx.json(mockExternalServices.transit.reachableStations(body.originId, body.maxTime)));
  }),

  rest.get('https://api.transit.jp/v1/stations/:id', (req, res, ctx) => {
    const { id } = req.params;
    return res(ctx.json(mockExternalServices.transit.stationInfo(id as string)));
  }),

  // Geocoding API handlers
  rest.get('https://api.geocoding.jp/v1/geocode', (req, res, ctx) => {
    const address = req.url.searchParams.get('address');
    return res(ctx.json(mockExternalServices.geocoding.addressToCoordinates(address || '')));
  }),

  rest.get('https://api.geocoding.jp/v1/reverse', (req, res, ctx) => {
    const lat = parseFloat(req.url.searchParams.get('lat') || '0');
    const lng = parseFloat(req.url.searchParams.get('lng') || '0');
    return res(ctx.json(mockExternalServices.geocoding.coordinatesToAddress(lat, lng)));
  }),
];

// Mock scraper responses
export const mockScraperResponses = {
  suumo: {
    listPage: () => `
      <html>
        <div class="property-list">
          ${Array.from({ length: 10 }, (_, i) => `
            <div class="property-item" data-id="prop-${i}">
              <h3 class="title">${faker.lorem.sentence()}</h3>
              <span class="rent">${faker.number.int({ min: 5, max: 30 })}万円</span>
              <span class="station">${faker.location.city()}駅 徒歩${faker.number.int({ min: 1, max: 20 })}分</span>
            </div>
          `).join('')}
        </div>
      </html>
    `,

    detailPage: () => `
      <html>
        <div class="property-detail">
          <h1 class="title">${faker.lorem.sentence()}</h1>
          <div class="rent">${faker.number.int({ min: 5, max: 30 })}万円</div>
          <div class="size">${faker.number.int({ min: 15, max: 100 })}㎡</div>
          <div class="layout">${faker.helpers.arrayElement(['1K', '1DK', '1LDK', '2LDK'])}</div>
          <div class="description">${faker.lorem.paragraph()}</div>
          <div class="images">
            ${Array.from({ length: 5 }, () => `<img src="${faker.image.url()}" />`).join('')}
          </div>
        </div>
      </html>
    `,
  },

  homes: {
    searchResults: () => ({
      items: Array.from({ length: 10 }, () => ({
        id: faker.string.uuid(),
        name: faker.lorem.sentence(),
        price: faker.number.int({ min: 50000, max: 300000 }),
        area: faker.number.int({ min: 15, max: 100 }),
        station: {
          name: faker.location.city(),
          walkTime: faker.number.int({ min: 1, max: 20 }),
        },
      })),
    }),
  },
};

// Helper to mock failed external service
export const mockServiceFailure = (serviceName: string, errorMessage = 'Service unavailable') => {
  return rest.all('*', (req, res, ctx) => {
    if (req.url.href.includes(serviceName)) {
      return res(
        ctx.status(503),
        ctx.json({ error: errorMessage })
      );
    }
    return req.passthrough();
  });
};

// Helper to mock slow external service
export const mockServiceDelay = (serviceName: string, delayMs: number = 5000) => {
  return rest.all('*', (req, res, ctx) => {
    if (req.url.href.includes(serviceName)) {
      return res(ctx.delay(delayMs));
    }
    return req.passthrough();
  });
};