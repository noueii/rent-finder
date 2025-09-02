import type { OTPRoute } from './simplified-otp-service';
import type { TransitStation, ReachableStation } from './index';

/**
 * Mock Transit Service for Testing
 * 
 * @deprecated Consider using the simplified OTP service with transit graph fallback instead.
 * This mock service provides unrealistic distance-based calculations and should only be
 * used for unit testing when you need predictable results.
 * 
 * For realistic testing, use:
 * ```typescript
 * import { getSimplifiedOTPService } from './simplified-otp-service';
 * const service = await getSimplifiedOTPService();
 * ```
 */
export class MockTransitService {
  async calculateCommute(
    fromLat: number,
    fromLon: number,
    toLat: number,
    toLon: number,
    maxMinutes: number = 120
  ): Promise<number | null> {
    // Return a mock commute time based on distance
    const distance = this.calculateDistance(fromLat, fromLon, toLat, toLon);
    // Assume 40km/h average speed
    const minutes = Math.round((distance / 1000) * 1.5);
    return minutes <= maxMinutes ? minutes : null;
  }

  async getRoute(
    fromLat: number,
    fromLon: number,
    toLat: number,
    toLon: number,
    maxMinutes: number = 120
  ): Promise<OTPRoute | null> {
    const minutes = await this.calculateCommute(fromLat, fromLon, toLat, toLon, maxMinutes);
    if (!minutes) return null;

    return {
      duration: minutes * 60,
      walkTime: 300, // 5 minutes mock walk time
      transitTime: (minutes - 5) * 60,
      waitingTime: 0,
      transfers: 0,
      legs: [{
        mode: 'TRANSIT',
        from: { name: 'Start', lat: fromLat, lon: fromLon },
        to: { name: 'End', lat: toLat, lon: toLon },
        duration: minutes * 60,
        route: {
          id: 'mock',
          shortName: 'Direct',
          longName: 'Mock Direct Route',
          type: 'SUBWAY'
        }
      }]
    };
  }

  async findReachableLocations(
    fromLat: number,
    fromLon: number,
    maxMinutes: number
  ): Promise<ReachableStation[]> {
    // Return empty array for mock
    return [];
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

// Export mock service factory
export async function getMockTransitService(): Promise<MockTransitService> {
  return new MockTransitService();
}