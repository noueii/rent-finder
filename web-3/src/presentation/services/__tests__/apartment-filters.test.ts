import { ApartmentFilters } from '../apartment-filters';
import type { ApartmentWithRelations } from '~/types';
import type { ApartmentSearchFilters } from '~/types/apartment';

describe('ApartmentFilters', () => {
  const mockApartments: ApartmentWithRelations[] = [
    {
      id: '1',
      title: 'Apartment 1',
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
      url: 'https://example.com/1',
      available: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      scrapedAt: new Date(),
      source: 'test',
      nearbyStations: [],
      isBookmarked: true,
      isLiked: false,
      viewedAt: new Date('2025-01-01'),
    },
    {
      id: '2',
      title: 'Apartment 2',
      price: 120000,
      size: 60,
      stationId: 'station-2',
      station: {
        id: 'station-2',
        name: 'Shibuya Station',
        nameKanji: '渋谷駅',
        lines: [],
        prefecture: 'Tokyo',
        ward: 'Shibuya',
        latitude: 35.6580,
        longitude: 139.7016,
      },
      layout: '3LDK',
      age: 10,
      floor: 5,
      address: 'Tokyo, Shibuya-ku',
      description: 'Another apartment',
      images: [],
      url: 'https://example.com/2',
      available: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      scrapedAt: new Date(),
      source: 'test',
      nearbyStations: [],
      isBookmarked: false,
      isLiked: true,
      viewedAt: null,
    },
    {
      id: '3',
      title: 'Apartment 3',
      price: 80000,
      size: 40,
      stationId: 'station-3',
      station: {
        id: 'station-3',
        name: 'Shinjuku Station',
        nameKanji: '新宿駅',
        lines: [],
        prefecture: 'Tokyo',
        ward: 'Shinjuku',
        latitude: 35.6896,
        longitude: 139.7006,
      },
      layout: '1LDK',
      age: 2,
      floor: 7,
      address: 'Tokyo, Shinjuku-ku',
      description: 'Third apartment',
      images: [],
      url: 'https://example.com/3',
      available: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      scrapedAt: new Date(),
      source: 'test',
      nearbyStations: [],
      isBookmarked: true,
      isLiked: true,
      viewedAt: null,
    },
  ];

  describe('applyClientFilters', () => {
    it('filters bookmarked apartments', () => {
      const filtered = ApartmentFilters.applyClientFilters(mockApartments, {
        showBookmarked: true,
      });
      
      expect(filtered).toHaveLength(2);
      expect(filtered.map(a => a.id)).toEqual(['1', '3']);
    });

    it('filters liked apartments', () => {
      const filtered = ApartmentFilters.applyClientFilters(mockApartments, {
        showLiked: true,
      });
      
      expect(filtered).toHaveLength(2);
      expect(filtered.map(a => a.id)).toEqual(['2', '3']);
    });

    it('hides viewed apartments', () => {
      const filtered = ApartmentFilters.applyClientFilters(mockApartments, {
        hideViewed: true,
      });
      
      expect(filtered).toHaveLength(2);
      expect(filtered.map(a => a.id)).toEqual(['2', '3']);
    });

    it('applies multiple filters', () => {
      const filtered = ApartmentFilters.applyClientFilters(mockApartments, {
        showBookmarked: true,
        showLiked: true,
      });
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('3');
    });

    it('returns all apartments with no filters', () => {
      const filtered = ApartmentFilters.applyClientFilters(mockApartments, {});
      expect(filtered).toHaveLength(3);
    });
  });

  describe('hasActiveFilters', () => {
    it('returns false for empty filters', () => {
      expect(ApartmentFilters.hasActiveFilters({})).toBe(false);
    });

    it('returns true for price filters', () => {
      expect(ApartmentFilters.hasActiveFilters({ priceMin: 50000 })).toBe(true);
      expect(ApartmentFilters.hasActiveFilters({ priceMax: 150000 })).toBe(true);
    });

    it('returns true for size filters', () => {
      expect(ApartmentFilters.hasActiveFilters({ sizeMin: 30 })).toBe(true);
      expect(ApartmentFilters.hasActiveFilters({ sizeMax: 100 })).toBe(true);
    });

    it('returns true for layout filters', () => {
      expect(ApartmentFilters.hasActiveFilters({ layout: ['1LDK'] })).toBe(true);
    });

    it('returns true for station filters', () => {
      expect(ApartmentFilters.hasActiveFilters({ stationIds: ['station-1'] })).toBe(true);
    });

    it('returns true for walking time less than default', () => {
      expect(ApartmentFilters.hasActiveFilters({ maxWalkingMinutes: 5 })).toBe(true);
      expect(ApartmentFilters.hasActiveFilters({ maxWalkingMinutes: 10 })).toBe(false);
    });

    it('returns false for zero values', () => {
      expect(ApartmentFilters.hasActiveFilters({ priceMin: 0 })).toBe(false);
      expect(ApartmentFilters.hasActiveFilters({ buildingAge: 0 })).toBe(false);
    });
  });

  describe('getFilterSummary', () => {
    it('returns no filters applied for empty filters', () => {
      expect(ApartmentFilters.getFilterSummary({})).toBe('No filters applied');
    });

    it('formats price range', () => {
      expect(ApartmentFilters.getFilterSummary({ priceMin: 50000, priceMax: 100000 }))
        .toBe('¥50,000-100,000');
      expect(ApartmentFilters.getFilterSummary({ priceMin: 80000 }))
        .toBe('¥80,000+');
      expect(ApartmentFilters.getFilterSummary({ priceMax: 120000 }))
        .toBe('Up to ¥120,000');
    });

    it('formats layout', () => {
      expect(ApartmentFilters.getFilterSummary({ layout: ['1LDK', '2LDK'] }))
        .toBe('1LDK, 2LDK');
    });

    it('formats size range', () => {
      expect(ApartmentFilters.getFilterSummary({ sizeMin: 30, sizeMax: 60 }))
        .toBe('30-60m²');
      expect(ApartmentFilters.getFilterSummary({ sizeMin: 40 }))
        .toBe('40m²+');
      expect(ApartmentFilters.getFilterSummary({ sizeMax: 80 }))
        .toBe('Up to 80m²');
    });

    it('formats walking time', () => {
      expect(ApartmentFilters.getFilterSummary({ maxWalkingMinutes: 5 }))
        .toBe('5 min walk');
    });

    it('formats building age', () => {
      expect(ApartmentFilters.getFilterSummary({ buildingAge: 10 }))
        .toBe('≤10 years old');
    });

    it('combines multiple filters', () => {
      const summary = ApartmentFilters.getFilterSummary({
        priceMin: 70000,
        priceMax: 130000,
        layout: ['2LDK'],
        sizeMin: 45,
      });
      expect(summary).toBe('¥70,000-130,000 • 2LDK • 45m²+');
    });
  });

  describe('validateFilters', () => {
    it('validates correct filters', () => {
      const result = ApartmentFilters.validateFilters({
        priceMin: 50000,
        priceMax: 100000,
        sizeMin: 30,
        sizeMax: 60,
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects invalid price range', () => {
      const result = ApartmentFilters.validateFilters({
        priceMin: 100000,
        priceMax: 50000,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Minimum price cannot be greater than maximum price');
    });

    it('detects invalid size range', () => {
      const result = ApartmentFilters.validateFilters({
        sizeMin: 60,
        sizeMax: 30,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Minimum size cannot be greater than maximum size');
    });

    it('detects invalid 2-year average range', () => {
      const result = ApartmentFilters.validateFilters({
        twoYearAvgMin: 150000,
        twoYearAvgMax: 100000,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Minimum 2-year average cannot be greater than maximum');
    });

    it('validates walking time range', () => {
      const result1 = ApartmentFilters.validateFilters({ maxWalkingMinutes: 0 });
      expect(result1.valid).toBe(false);
      expect(result1.errors).toContain('Walking time must be between 1 and 30 minutes');

      const result2 = ApartmentFilters.validateFilters({ maxWalkingMinutes: 31 });
      expect(result2.valid).toBe(false);

      const result3 = ApartmentFilters.validateFilters({ maxWalkingMinutes: 15 });
      expect(result3.valid).toBe(true);
    });

    it('validates building age range', () => {
      const result1 = ApartmentFilters.validateFilters({ buildingAge: -1 });
      expect(result1.valid).toBe(false);
      expect(result1.errors).toContain('Building age must be between 0 and 100 years');

      const result2 = ApartmentFilters.validateFilters({ buildingAge: 101 });
      expect(result2.valid).toBe(false);

      const result3 = ApartmentFilters.validateFilters({ buildingAge: 20 });
      expect(result3.valid).toBe(true);
    });
  });

  describe('toQueryString', () => {
    it('serializes simple filters', () => {
      const qs = ApartmentFilters.toQueryString({
        priceMin: 70000,
        priceMax: 130000,
        maxWalkingMinutes: 5,
      });
      expect(qs).toBe('priceMin=70000&priceMax=130000&maxWalkingMinutes=5');
    });

    it('serializes array filters', () => {
      const qs = ApartmentFilters.toQueryString({
        layout: ['1LDK', '2LDK'],
        stationIds: ['st1', 'st2'],
      });
      expect(qs).toBe('layout=1LDK%2C2LDK&stationIds=st1%2Cst2');
    });

    it('omits undefined and null values', () => {
      const qs = ApartmentFilters.toQueryString({
        priceMin: 50000,
        priceMax: undefined,
        sizeMin: null as any,
      });
      expect(qs).toBe('priceMin=50000');
    });

    it('omits empty arrays', () => {
      const qs = ApartmentFilters.toQueryString({
        layout: [],
        priceMin: 50000,
      });
      expect(qs).toBe('priceMin=50000');
    });
  });

  describe('fromQueryString', () => {
    it('parses numeric fields', () => {
      const filters = ApartmentFilters.fromQueryString(
        'priceMin=70000&priceMax=130000&maxWalkingMinutes=5&buildingAge=10'
      );
      expect(filters).toEqual({
        priceMin: 70000,
        priceMax: 130000,
        maxWalkingMinutes: 5,
        buildingAge: 10,
      });
    });

    it('parses size fields as float', () => {
      const filters = ApartmentFilters.fromQueryString('sizeMin=30.5&sizeMax=60.8');
      expect(filters).toEqual({
        sizeMin: 30.5,
        sizeMax: 60.8,
      });
    });

    it('parses array fields', () => {
      const filters = ApartmentFilters.fromQueryString(
        'layout=1LDK%2C2LDK&stationIds=st1%2Cst2&excludeWards=Shibuya%2CShinjuku'
      );
      expect(filters).toEqual({
        layout: ['1LDK', '2LDK'],
        stationIds: ['st1', 'st2'],
        excludeWards: ['Shibuya', 'Shinjuku'],
      });
    });

    it('ignores invalid numeric values', () => {
      const filters = ApartmentFilters.fromQueryString('priceMin=abc&priceMax=100000');
      expect(filters).toEqual({
        priceMax: 100000,
      });
    });

    it('handles empty query string', () => {
      const filters = ApartmentFilters.fromQueryString('');
      expect(filters).toEqual({});
    });
  });

  describe('mergeFilters', () => {
    it('merges filter objects', () => {
      const base: ApartmentSearchFilters = { priceMin: 50000, layout: ['1LDK'] };
      const overrides = { priceMax: 100000, layout: ['2LDK'] };
      
      const merged = ApartmentFilters.mergeFilters(base, overrides);
      expect(merged).toEqual({
        priceMin: 50000,
        priceMax: 100000,
        layout: ['2LDK'],
      });
    });
  });

  describe('getDefaultFilters', () => {
    it('returns default filter values', () => {
      const defaults = ApartmentFilters.getDefaultFilters();
      expect(defaults).toEqual({
        maxWalkingMinutes: 10,
        layout: [],
        stationIds: [],
        excludeWards: [],
      });
    });
  });
});