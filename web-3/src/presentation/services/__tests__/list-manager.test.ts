import { ListManager } from '../list-manager';
import type { ApartmentWithRelations } from '~/types';
import type { ListAction } from '../list-manager';

describe('ListManager', () => {
  const createMockApartment = (id: string, overrides?: Partial<ApartmentWithRelations>): ApartmentWithRelations => ({
    id,
    title: `Apartment ${id}`,
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
    url: `https://example.com/${id}`,
    available: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    scrapedAt: new Date('2025-01-01'),
    source: 'test',
    nearbyStations: [],
    nearStations: [
      {
        stationId: 'station-1',
        walkingMinutes: 5,
        distance: 400,
      },
    ],
    ward: 'Chiyoda',
    ...overrides,
  });

  const mockApartments: ApartmentWithRelations[] = [
    createMockApartment('1', { price: 80000, size: 40, layout: '1LDK', ward: 'Shibuya' }),
    createMockApartment('2', { price: 120000, size: 60, layout: '3LDK', ward: 'Shinjuku' }),
    createMockApartment('3', { price: 100000, size: 50, layout: '2LDK', ward: 'Shibuya' }),
  ];

  describe('addToList', () => {
    it('adds new apartments to list', () => {
      const currentList = [mockApartments[0]];
      const newApartments = [mockApartments[1], mockApartments[2]];
      
      const result = ListManager.addToList(currentList, newApartments);
      
      expect(result).toHaveLength(3);
      expect(result.map(a => a.id)).toEqual(['1', '2', '3']);
    });

    it('prevents duplicate additions', () => {
      const currentList = [mockApartments[0], mockApartments[1]];
      const newApartments = [mockApartments[1], mockApartments[2]]; // '2' is duplicate
      
      const result = ListManager.addToList(currentList, newApartments);
      
      expect(result).toHaveLength(3);
      expect(result.map(a => a.id)).toEqual(['1', '2', '3']);
    });

    it('handles empty lists', () => {
      expect(ListManager.addToList([], mockApartments)).toEqual(mockApartments);
      expect(ListManager.addToList(mockApartments, [])).toEqual(mockApartments);
    });
  });

  describe('removeFromList', () => {
    it('removes specified apartments', () => {
      const result = ListManager.removeFromList(mockApartments, ['1', '3']);
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });

    it('handles non-existent ids', () => {
      const result = ListManager.removeFromList(mockApartments, ['4', '5']);
      
      expect(result).toHaveLength(3);
      expect(result).toEqual(mockApartments);
    });

    it('handles empty removal list', () => {
      const result = ListManager.removeFromList(mockApartments, []);
      expect(result).toEqual(mockApartments);
    });
  });

  describe('toggleSelection', () => {
    it('adds unselected apartment', () => {
      const selected = new Set(['1']);
      const result = ListManager.toggleSelection(selected, '2');
      
      expect(result.size).toBe(2);
      expect(result.has('1')).toBe(true);
      expect(result.has('2')).toBe(true);
    });

    it('removes selected apartment', () => {
      const selected = new Set(['1', '2']);
      const result = ListManager.toggleSelection(selected, '1');
      
      expect(result.size).toBe(1);
      expect(result.has('1')).toBe(false);
      expect(result.has('2')).toBe(true);
    });

    it('does not mutate original set', () => {
      const selected = new Set(['1']);
      const result = ListManager.toggleSelection(selected, '2');
      
      expect(selected.size).toBe(1);
      expect(result.size).toBe(2);
    });
  });

  describe('selectAll', () => {
    it('selects all apartment ids', () => {
      const result = ListManager.selectAll(mockApartments);
      
      expect(result.size).toBe(3);
      expect(Array.from(result)).toEqual(['1', '2', '3']);
    });

    it('handles empty list', () => {
      const result = ListManager.selectAll([]);
      expect(result.size).toBe(0);
    });
  });

  describe('clearSelection', () => {
    it('returns empty set', () => {
      const result = ListManager.clearSelection();
      expect(result.size).toBe(0);
    });
  });

  describe('getSelected', () => {
    it('returns selected apartments', () => {
      const selected = new Set(['1', '3']);
      const result = ListManager.getSelected(mockApartments, selected);
      
      expect(result).toHaveLength(2);
      expect(result.map(a => a.id)).toEqual(['1', '3']);
    });

    it('handles empty selection', () => {
      const result = ListManager.getSelected(mockApartments, new Set());
      expect(result).toHaveLength(0);
    });

    it('ignores non-existent ids', () => {
      const selected = new Set(['1', '4', '5']);
      const result = ListManager.getSelected(mockApartments, selected);
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });
  });

  describe('sortApartments', () => {
    it('sorts by price', () => {
      const sorted = ListManager.sortApartments(mockApartments, 'price', 'asc');
      expect(sorted.map(a => a.price)).toEqual([80000, 100000, 120000]);

      const sortedDesc = ListManager.sortApartments(mockApartments, 'price', 'desc');
      expect(sortedDesc.map(a => a.price)).toEqual([120000, 100000, 80000]);
    });

    it('sorts by size', () => {
      const sorted = ListManager.sortApartments(mockApartments, 'size', 'asc');
      expect(sorted.map(a => a.size)).toEqual([40, 50, 60]);
    });

    it('sorts by building age with defaults', () => {
      const apartments = [
        createMockApartment('1', { buildingAge: 10 }),
        createMockApartment('2', { buildingAge: undefined }),
        createMockApartment('3', { buildingAge: 5 }),
      ];
      
      const sorted = ListManager.sortApartments(apartments, 'buildingAge', 'asc');
      expect(sorted.map(a => a.buildingAge || 0)).toEqual([0, 5, 10]);
    });

    it('sorts by score', () => {
      const apartments = [
        { ...mockApartments[0], score: 85 },
        { ...mockApartments[1], score: 90 },
        { ...mockApartments[2], score: 75 },
      ];
      
      const sorted = ListManager.sortApartments(apartments as any, 'score', 'desc');
      expect(sorted.map(a => (a as any).score)).toEqual([90, 85, 75]);
    });

    it('sorts by createdAt', () => {
      const apartments = [
        createMockApartment('1', { createdAt: new Date('2025-01-03') }),
        createMockApartment('2', { createdAt: new Date('2025-01-01') }),
        createMockApartment('3', { createdAt: new Date('2025-01-02') }),
      ];
      
      const sorted = ListManager.sortApartments(apartments, 'createdAt', 'asc');
      expect(sorted.map(a => a.id)).toEqual(['2', '3', '1']);
    });

    it('sorts by walking minutes', () => {
      const apartments = [
        createMockApartment('1', { 
          nearStations: [
            { stationId: 's1', walkingMinutes: 10, distance: 800 },
            { stationId: 's2', walkingMinutes: 5, distance: 400 },
          ]
        }),
        createMockApartment('2', { 
          nearStations: [
            { stationId: 's1', walkingMinutes: 3, distance: 240 },
          ]
        }),
      ];
      
      const sorted = ListManager.sortApartments(apartments, 'walkingMinutes', 'asc');
      expect(sorted.map(a => a.id)).toEqual(['2', '1']);
    });

    it('handles unknown sort field', () => {
      const sorted = ListManager.sortApartments(mockApartments, 'unknown', 'asc');
      expect(sorted).toEqual(mockApartments);
    });

    it('does not mutate original array', () => {
      const original = [...mockApartments];
      ListManager.sortApartments(mockApartments, 'price', 'asc');
      expect(mockApartments).toEqual(original);
    });
  });

  describe('groupApartments', () => {
    it('groups by ward', () => {
      const groups = ListManager.groupApartments(mockApartments, 'ward');
      
      expect(Object.keys(groups)).toEqual(['Shibuya', 'Shinjuku']);
      expect(groups['Shibuya']).toHaveLength(2);
      expect(groups['Shinjuku']).toHaveLength(1);
    });

    it('groups by layout', () => {
      const groups = ListManager.groupApartments(mockApartments, 'layout');
      
      expect(Object.keys(groups)).toEqual(['1LDK', '3LDK', '2LDK']);
      expect(groups['1LDK']).toHaveLength(1);
      expect(groups['2LDK']).toHaveLength(1);
      expect(groups['3LDK']).toHaveLength(1);
    });

    it('groups by price range', () => {
      const apartments = [
        createMockApartment('1', { price: 50000 }),
        createMockApartment('2', { price: 125000 }),
        createMockApartment('3', { price: 175000 }),
        createMockApartment('4', { price: 250000 }),
        createMockApartment('5', { price: 350000 }),
      ];
      
      const groups = ListManager.groupApartments(apartments, 'priceRange');
      
      expect(Object.keys(groups)).toEqual([
        'Under ¥100,000',
        '¥100,000 - ¥150,000',
        '¥150,000 - ¥200,000',
        '¥200,000 - ¥300,000',
        'Over ¥300,000',
      ]);
    });

    it('handles missing values', () => {
      const apartments = [
        createMockApartment('1', { ward: undefined }),
        createMockApartment('2', { layout: undefined }),
      ];
      
      const wardGroups = ListManager.groupApartments(apartments, 'ward');
      expect(wardGroups['Unknown']).toHaveLength(2);
      
      const layoutGroups = ListManager.groupApartments(apartments, 'layout');
      expect(layoutGroups['Unknown']).toHaveLength(2);
    });
  });

  describe('getListStats', () => {
    it('calculates statistics correctly', () => {
      const stats = ListManager.getListStats(mockApartments);
      
      expect(stats).toEqual({
        count: 3,
        avgPrice: 100000,
        avgSize: 50,
        avgScore: undefined,
        priceRange: { min: 80000, max: 120000 },
        sizeRange: { min: 40, max: 60 },
        wards: ['Shibuya', 'Shinjuku'],
        layouts: ['1LDK', '3LDK', '2LDK'],
      });
    });

    it('includes score when available', () => {
      const apartments = mockApartments.map((apt, idx) => ({
        ...apt,
        score: 80 + idx * 5,
      }));
      
      const stats = ListManager.getListStats(apartments as any);
      expect(stats.avgScore).toBe(85);
    });

    it('handles empty list', () => {
      const stats = ListManager.getListStats([]);
      
      expect(stats).toEqual({
        count: 0,
        avgPrice: 0,
        avgSize: 0,
        priceRange: { min: 0, max: 0 },
        sizeRange: { min: 0, max: 0 },
        wards: [],
        layouts: [],
      });
    });
  });

  describe('paginate', () => {
    it('paginates correctly', () => {
      const apartments = Array.from({ length: 10 }, (_, i) => 
        createMockApartment(String(i + 1))
      );
      
      const page1 = ListManager.paginate(apartments, 1, 3);
      expect(page1.items).toHaveLength(3);
      expect(page1.items.map(a => a.id)).toEqual(['1', '2', '3']);
      expect(page1.totalPages).toBe(4);
      expect(page1.currentPage).toBe(1);
      expect(page1.hasNext).toBe(true);
      expect(page1.hasPrevious).toBe(false);
      
      const page2 = ListManager.paginate(apartments, 2, 3);
      expect(page2.items.map(a => a.id)).toEqual(['4', '5', '6']);
      expect(page2.hasNext).toBe(true);
      expect(page2.hasPrevious).toBe(true);
      
      const lastPage = ListManager.paginate(apartments, 4, 3);
      expect(lastPage.items).toHaveLength(1);
      expect(lastPage.items[0].id).toBe('10');
      expect(lastPage.hasNext).toBe(false);
    });

    it('handles out of range pages', () => {
      const apartments = mockApartments;
      
      const negativePage = ListManager.paginate(apartments, -1, 2);
      expect(negativePage.currentPage).toBe(1);
      
      const overflowPage = ListManager.paginate(apartments, 10, 2);
      expect(overflowPage.currentPage).toBe(2); // Total pages with 3 items, 2 per page
    });

    it('handles empty list', () => {
      const result = ListManager.paginate([], 1, 10);
      expect(result.items).toHaveLength(0);
      expect(result.totalPages).toBe(0);
      expect(result.currentPage).toBe(1);
    });
  });

  describe('isInList', () => {
    it('checks if apartment is in list', () => {
      expect(ListManager.isInList(mockApartments, '1')).toBe(true);
      expect(ListManager.isInList(mockApartments, '2')).toBe(true);
      expect(ListManager.isInList(mockApartments, '4')).toBe(false);
    });

    it('handles empty list', () => {
      expect(ListManager.isInList([], '1')).toBe(false);
    });
  });

  describe('getActionDescription', () => {
    it('returns correct descriptions', () => {
      const actions: ListAction[] = [
        { type: 'add', apartmentId: '1', listId: 'favorites', timestamp: new Date() },
        { type: 'remove', apartmentId: '1', listId: 'favorites', timestamp: new Date() },
        { type: 'move', apartmentId: '1', listId: 'favorites', targetListId: 'saved', timestamp: new Date() },
        { type: 'bookmark', apartmentId: '1', timestamp: new Date() },
        { type: 'like', apartmentId: '1', timestamp: new Date() },
        { type: 'view', apartmentId: '1', timestamp: new Date() },
      ];

      expect(ListManager.getActionDescription(actions[0])).toBe('Added to favorites');
      expect(ListManager.getActionDescription(actions[1])).toBe('Removed from favorites');
      expect(ListManager.getActionDescription(actions[2])).toBe('Moved from favorites to saved');
      expect(ListManager.getActionDescription(actions[3])).toBe('Bookmarked');
      expect(ListManager.getActionDescription(actions[4])).toBe('Liked');
      expect(ListManager.getActionDescription(actions[5])).toBe('Viewed');
    });

    it('handles missing list ids', () => {
      const action: ListAction = { 
        type: 'add', 
        apartmentId: '1', 
        timestamp: new Date() 
      };
      expect(ListManager.getActionDescription(action)).toBe('Added to list');
    });

    it('handles unknown action type', () => {
      const action: any = { 
        type: 'unknown', 
        apartmentId: '1', 
        timestamp: new Date() 
      };
      expect(ListManager.getActionDescription(action)).toBe('Updated');
    });
  });
});