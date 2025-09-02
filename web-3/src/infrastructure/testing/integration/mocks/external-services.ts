import { jest } from '@jest/globals';
import type { ReachableStation } from '~/lib/transit/types';

/**
 * Mock external services for integration testing
 * Provides consistent, predictable responses for external APIs
 */
export const mockExternalServices = {
  transitService: {
    getReachableStations: jest.fn((stationId: string, maxMinutes: number): ReachableStation[] => {
      // Predictable mock data based on input
      const baseStations: Record<string, ReachableStation[]> = {
        'station-1': [
          { stationId: 'station-1', travelTime: 0 },
          { stationId: 'station-2', travelTime: 15 },
          { stationId: 'station-3', travelTime: 25 },
          { stationId: 'station-4', travelTime: 35 },
          { stationId: 'station-5', travelTime: 45 },
          { stationId: 'station-6', travelTime: 55 },
        ],
        'station-2': [
          { stationId: 'station-2', travelTime: 0 },
          { stationId: 'station-1', travelTime: 15 },
          { stationId: 'station-3', travelTime: 10 },
          { stationId: 'station-7', travelTime: 20 },
          { stationId: 'station-8', travelTime: 30 },
        ],
        'station-3': [
          { stationId: 'station-3', travelTime: 0 },
          { stationId: 'station-2', travelTime: 10 },
          { stationId: 'station-1', travelTime: 25 },
          { stationId: 'station-9', travelTime: 15 },
          { stationId: 'station-10', travelTime: 40 },
        ],
      };
      
      const allStations = baseStations[stationId] || [
        { stationId, travelTime: 0 }
      ];
      
      return allStations.filter(s => s.travelTime <= maxMinutes);
    })
  },
  
  geocodingService: {
    geocodeAddress: jest.fn(async (address: string) => {
      // Mock geocoding based on address patterns
      if (address.includes('Tokyo Station')) {
        return { lat: 35.6812, lng: 139.7671 };
      } else if (address.includes('Shibuya')) {
        return { lat: 35.6580, lng: 139.7016 };
      } else if (address.includes('Shinjuku')) {
        return { lat: 35.6896, lng: 139.6995 };
      }
      // Default Tokyo coordinates
      return { lat: 35.6762, lng: 139.6503 };
    }),
    
    reverseGeocode: jest.fn(async (lat: number, lng: number) => {
      // Mock reverse geocoding
      if (Math.abs(lat - 35.6812) < 0.01 && Math.abs(lng - 139.7671) < 0.01) {
        return 'Near Tokyo Station, Chiyoda, Tokyo';
      } else if (Math.abs(lat - 35.6580) < 0.01 && Math.abs(lng - 139.7016) < 0.01) {
        return 'Near Shibuya Station, Shibuya, Tokyo';
      }
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}, Tokyo`;
    })
  },
  
  mapService: {
    getMapUrl: jest.fn((lat: number, lng: number, zoom: number = 15) => {
      return `https://maps.example.com/?lat=${lat}&lng=${lng}&zoom=${zoom}`;
    }),
    
    getDirectionsUrl: jest.fn((from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
      return `https://maps.example.com/directions?from=${from.lat},${from.lng}&to=${to.lat},${to.lng}`;
    })
  },
  
  scraperMocks: {
    realEstate: jest.fn(async (url: string) => {
      // Mock HTML response for real estate scraper
      return `
        <html>
          <body>
            <div class="property-list">
              <div class="property-unit">
                <h3>Mock Apartment 1</h3>
                <div class="price">¥85,000</div>
                <div class="details">
                  <span>25m²</span>
                  <span>1K</span>
                  <span>3rd floor</span>
                </div>
                <div class="location">Shibuya - 5 min walk</div>
              </div>
              <div class="property-unit">
                <h3>Mock Apartment 2</h3>
                <div class="price">¥120,000</div>
                <div class="details">
                  <span>40m²</span>
                  <span>1LDK</span>
                  <span>7th floor</span>
                </div>
                <div class="location">Shinjuku - 8 min walk</div>
              </div>
            </div>
          </body>
        </html>
      `;
    }),
    
    yoloJapan: jest.fn(async (url: string) => {
      return `
        <html>
          <body>
            <div class="listing-container">
              <article class="listing-item">
                <h2>Yolo Mock Room</h2>
                <span class="price">¥75,000/month</span>
                <div class="specs">30m² | 1DK | 2F</div>
                <div class="station">Tokyo Station - 10 min</div>
              </article>
            </div>
          </body>
        </html>
      `;
    })
  },
  
  emailService: {
    sendEmail: jest.fn(async (to: string, subject: string, body: string) => {
      console.log(`Mock email sent to ${to}: ${subject}`);
      return { success: true, messageId: `mock-${Date.now()}` };
    }),
    
    sendVerificationEmail: jest.fn(async (email: string, token: string) => {
      console.log(`Mock verification email sent to ${email} with token ${token}`);
      return { success: true };
    }),
    
    sendPasswordResetEmail: jest.fn(async (email: string, token: string) => {
      console.log(`Mock password reset email sent to ${email} with token ${token}`);
      return { success: true };
    })
  },
  
  // Control methods
  start: async () => {
    // Setup any necessary mocks
    console.log('Mock external services started');
    
    // Mock fetch for scraper requests
    global.fetch = jest.fn(async (url: string | URL | Request) => {
      const urlString = typeof url === 'string' ? url : url.toString();
      
      if (urlString.includes('realestate')) {
        const html = await mockExternalServices.scraperMocks.realEstate(urlString);
        return new Response(html, {
          status: 200,
          headers: { 'content-type': 'text/html' }
        });
      } else if (urlString.includes('yolo')) {
        const html = await mockExternalServices.scraperMocks.yoloJapan(urlString);
        return new Response(html, {
          status: 200,
          headers: { 'content-type': 'text/html' }
        });
      }
      
      // Default response
      return new Response('Not found', { status: 404 });
    }) as any;
  },
  
  stop: async () => {
    // Cleanup mocks
    jest.restoreAllMocks();
    console.log('Mock external services stopped');
  },
  
  reset: () => {
    // Reset all mock function calls
    jest.clearAllMocks();
  }
};

// Type exports for better TypeScript support
export type MockExternalServices = typeof mockExternalServices;