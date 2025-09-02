import { 
  calculateCostBreakdown, 
  formatPrice, 
  formatPriceCompact,
  getPriceRangeLabel,
  calculatePricePerSqm
} from '../price-calculator';
import type { Apartment } from '~/types';

describe('price-calculator', () => {
  const mockApartment: Apartment = {
    id: '1',
    title: 'Test Apartment',
    price: 100000,
    size: 50,
    stationId: 'station-1',
    station: {
      id: 'station-1',
      name: 'Tokyo Station',
      nameKanji: '東京駅',
      lines: [],
      prefecture: 'Tokyo',
      ward: 'Chiyoda',
      latitude: 35.6812,
      longitude: 139.7671,
    },
    layout: '2LDK',
    age: 5,
    floor: 3,
    address: 'Tokyo, Chiyoda-ku',
    description: 'Nice apartment',
    images: [],
    url: 'https://example.com',
    available: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    scrapedAt: new Date(),
    source: 'test',
    nearbyStations: [],
  };

  describe('calculateCostBreakdown', () => {
    it('calculates cost breakdown with all fees provided', () => {
      const apartment = {
        ...mockApartment,
        deposit: 200000,
        keyMoney: 100000,
        reikin: 50000,
        agencyFee: 100000,
      };

      const breakdown = calculateCostBreakdown(apartment);

      expect(breakdown).toEqual({
        monthlyRent: 100000,
        deposit: 200000,
        keyMoney: 100000,
        reikin: 50000,
        agencyFee: 100000,
        totalInitialCost: 450000,
        twoYearTotal: 2850000, // 450000 + (100000 * 24)
        monthlyAverage: 118750, // 2850000 / 24
      });
    });

    it('uses default values when fees not provided', () => {
      const breakdown = calculateCostBreakdown(mockApartment);

      expect(breakdown).toEqual({
        monthlyRent: 100000,
        deposit: 200000, // 2 months default
        keyMoney: 0,
        reikin: 0,
        agencyFee: 100000, // 1 month default
        totalInitialCost: 300000,
        twoYearTotal: 2700000,
        monthlyAverage: 112500,
      });
    });

    it('handles partial fee information', () => {
      const apartment = {
        ...mockApartment,
        deposit: 150000,
        keyMoney: 50000,
      };

      const breakdown = calculateCostBreakdown(apartment);

      expect(breakdown).toEqual({
        monthlyRent: 100000,
        deposit: 150000,
        keyMoney: 50000,
        reikin: 0,
        agencyFee: 100000, // Default 1 month
        totalInitialCost: 300000,
        twoYearTotal: 2700000,
        monthlyAverage: 112500,
      });
    });

    it('handles zero rent correctly', () => {
      const apartment = { ...mockApartment, price: 0 };
      const breakdown = calculateCostBreakdown(apartment);

      expect(breakdown.monthlyRent).toBe(0);
      expect(breakdown.deposit).toBe(0); // 2 * 0
      expect(breakdown.agencyFee).toBe(0); // 1 * 0
      expect(breakdown.monthlyAverage).toBe(0);
    });
  });

  describe('formatPrice', () => {
    it('formats price in Japanese Yen', () => {
      expect(formatPrice(100000)).toBe('¥100,000');
      expect(formatPrice(0)).toBe('¥0');
      expect(formatPrice(123456)).toBe('¥123,456');
    });

    it('handles large numbers', () => {
      expect(formatPrice(1000000)).toBe('¥1,000,000');
      expect(formatPrice(10000000)).toBe('¥10,000,000');
    });

    it('handles decimal values by rounding', () => {
      expect(formatPrice(100000.99)).toBe('¥100,001');
      expect(formatPrice(99999.49)).toBe('¥99,999');
    });
  });

  describe('formatPriceCompact', () => {
    it('formats price without full currency formatting', () => {
      expect(formatPriceCompact(100000)).toBe('¥100,000');
      expect(formatPriceCompact(0)).toBe('¥0');
      expect(formatPriceCompact(1234567)).toBe('¥1,234,567');
    });
  });

  describe('getPriceRangeLabel', () => {
    it('returns correct labels for price ranges', () => {
      expect(getPriceRangeLabel(30000)).toBe('Budget');
      expect(getPriceRangeLabel(49999)).toBe('Budget');
      expect(getPriceRangeLabel(50000)).toBe('Affordable');
      expect(getPriceRangeLabel(99999)).toBe('Affordable');
      expect(getPriceRangeLabel(100000)).toBe('Mid-range');
      expect(getPriceRangeLabel(149999)).toBe('Mid-range');
      expect(getPriceRangeLabel(150000)).toBe('Premium');
      expect(getPriceRangeLabel(199999)).toBe('Premium');
      expect(getPriceRangeLabel(200000)).toBe('Luxury');
      expect(getPriceRangeLabel(500000)).toBe('Luxury');
    });
  });

  describe('calculatePricePerSqm', () => {
    it('calculates price per square meter', () => {
      expect(calculatePricePerSqm(100000, 50)).toBe(2000);
      expect(calculatePricePerSqm(120000, 40)).toBe(3000);
      expect(calculatePricePerSqm(80000, 30)).toBe(2667);
    });

    it('handles zero size', () => {
      expect(calculatePricePerSqm(100000, 0)).toBe(0);
    });

    it('handles missing size', () => {
      expect(calculatePricePerSqm(100000, null as any)).toBe(0);
      expect(calculatePricePerSqm(100000, undefined as any)).toBe(0);
    });

    it('rounds to nearest integer', () => {
      expect(calculatePricePerSqm(100000, 33)).toBe(3030); // 3030.303...
      expect(calculatePricePerSqm(150000, 47)).toBe(3191); // 3191.489...
    });
  });
});