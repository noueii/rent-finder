import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { prismaMock, resetPrismaMocks } from '~/infrastructure/testing/mocks/prisma';
import { vi } from '~/core/testing';
import { StationRepository } from '../implementations/station.repository';



describe('StationRepository', () => {
  
  let repository: StationRepository;

  beforeEach(() => {
    resetPrismaMocks();
    
    repository = new StationRepository(prismaMock as any);
  });

  describe('findById', () => {
    it('should find station by id without lines', async () => {
      const mockStation = {
        id: 'station1',
        name: '新宿',
        nameEn: 'Shinjuku',
        latitude: 35.6896,
        longitude: 139.7006
      };

      prismaMock.station.findUnique.mockResolvedValue(mockStation as any);

      const result = await repository.findById('station1', false);

      expect(prismaMock.station.findUnique).toHaveBeenCalledWith({
        where: { id: 'station1' }
      });
      expect(result).toEqual(mockStation);
    });

    it('should find station by id with lines', async () => {
      const mockStation = {
        id: 'station1',
        name: '新宿',
        lines: [
          {
            line: {
              id: 'line1',
              name: '山手線',
              nameEn: 'Yamanote Line'
            }
          },
          {
            line: {
              id: 'line2',
              name: '中央線',
              nameEn: 'Chuo Line'
            }
          }
        ]
      };

      prismaMock.station.findUnique.mockResolvedValue(mockStation as any);

      const result = await repository.findById('station1', true);

      expect(prismaMock.station.findUnique).toHaveBeenCalledWith({
        where: { id: 'station1' },
        include: {
          lines: {
            include: {
              line: true
            }
          }
        }
      });
      expect(result).toEqual(mockStation);
    });
  });

  describe('findByName', () => {
    it('should find stations by name (Japanese)', async () => {
      const mockStations = [
        { id: '1', name: '新宿', nameEn: 'Shinjuku' },
        { id: '2', name: '新宿三丁目', nameEn: 'Shinjuku-sanchome' }
      ];

      prismaMock.station.findMany.mockResolvedValue(mockStations as any);

      const result = await repository.findByName('新宿');

      expect(prismaMock.station.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: '新宿', mode: 'insensitive' } },
            { nameEn: { contains: '新宿', mode: 'insensitive' } }
          ]
        }
      });
      expect(result).toEqual(mockStations);
    });

    it('should find stations by name (English)', async () => {
      const mockStations = [
        { id: '1', name: '渋谷', nameEn: 'Shibuya' }
      ];

      prismaMock.station.findMany.mockResolvedValue(mockStations as any);

      const result = await repository.findByName('Shibuya');

      expect(prismaMock.station.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: 'Shibuya', mode: 'insensitive' } },
            { nameEn: { contains: 'Shibuya', mode: 'insensitive' } }
          ]
        }
      });
      expect(result).toEqual(mockStations);
    });
  });

  describe('search', () => {
    it('should search and score stations', async () => {
      const mockStations = [
        {
          id: '1',
          name: '新宿',
          nameEn: 'Shinjuku',
          lines: [
            { line: { id: 'l1', name: '山手線', nameEn: 'Yamanote Line' } }
          ]
        },
        {
          id: '2',
          name: '新宿三丁目',
          nameEn: 'Shinjuku-sanchome',
          lines: [
            { line: { id: 'l2', name: '丸ノ内線', nameEn: 'Marunouchi Line' } }
          ]
        },
        {
          id: '3',
          name: '西新宿',
          nameEn: 'Nishi-shinjuku',
          lines: []
        }
      ];

      prismaMock.station.findMany.mockResolvedValue(mockStations as any);

      const result = await repository.search('新宿', 2);

      expect(prismaMock.station.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: '新宿', mode: 'insensitive' } },
            { nameEn: { contains: '新宿', mode: 'insensitive' } }
          ]
        },
        include: {
          lines: {
            include: {
              line: true
            }
          }
        },
        take: 4 // limit * 2
      });

      // Should return top 2 results
      expect(result).toHaveLength(2);
      // Exact match should score highest
      expect(result[0].station.id).toBe('1');
      expect(result[0].score).toBeGreaterThan(result[1].score);
    });

    it('should normalize query by removing suffixes', async () => {
      prismaMock.station.findMany.mockResolvedValue([]);

      await repository.search('新宿駅', 10);

      expect(prismaMock.station.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: '新宿', mode: 'insensitive' } },
            { nameEn: { contains: '新宿', mode: 'insensitive' } }
          ]
        },
        include: expect.any(Object),
        take: 20
      });
    });

    it('should give bonus scores for major lines', async () => {
      const mockStations = [
        {
          id: '1',
          name: '品川',
          nameEn: 'Shinagawa',
          lines: [
            { line: { id: 'l1', name: '山手線', nameEn: 'Yamanote Line' } }
          ]
        },
        {
          id: '2',
          name: '品川シーサイド',
          nameEn: 'Shinagawa Seaside',
          lines: [
            { line: { id: 'l2', name: 'りんかい線', nameEn: 'Rinkai Line' } }
          ]
        }
      ];

      prismaMock.station.findMany.mockResolvedValue(mockStations as any);

      const result = await repository.search('品川', 10);

      // Station on Yamanote Line should get bonus
      const yamanoStation = result.find(r => r.station.id === '1');
      const rinkaiStation = result.find(r => r.station.id === '2');
      
      expect(yamanoStation!.score).toBeGreaterThan(rinkaiStation!.score);
    });
  });

  describe('findByCoordinates', () => {
    it('should find stations within radius', async () => {
      const mockStations = [
        { id: '1', name: '新宿', latitude: 35.6896, longitude: 139.7006 },
        { id: '2', name: '代々木', latitude: 35.6838, longitude: 139.7020 }
      ];

      prismaMock.station.findMany.mockResolvedValue(mockStations as any);

      const result = await repository.findByCoordinates(35.6896, 139.7006, 2);

      expect(prismaMock.station.findMany).toHaveBeenCalledWith({
        where: {
          latitude: {
            gte: expect.any(Number),
            lte: expect.any(Number)
          },
          longitude: {
            gte: expect.any(Number),
            lte: expect.any(Number)
          }
        }
      });
      expect(result).toEqual(mockStations);
    });
  });

  describe('findByLine', () => {
    it('should find all stations on a line', async () => {
      const mockStations = [
        {
          id: '1',
          name: '新宿',
          lines: [{ line: { id: 'yamanote', name: '山手線' } }]
        },
        {
          id: '2',
          name: '渋谷',
          lines: [{ line: { id: 'yamanote', name: '山手線' } }]
        }
      ];

      prismaMock.station.findMany.mockResolvedValue(mockStations as any);

      const result = await repository.findByLine('yamanote');

      expect(prismaMock.station.findMany).toHaveBeenCalledWith({
        where: {
          lines: {
            some: {
              lineId: 'yamanote'
            }
          }
        },
        include: {
          lines: {
            include: {
              line: true
            }
          }
        }
      });
      expect(result).toEqual(mockStations);
    });
  });

  describe('findByLines', () => {
    it('should find stations on multiple lines', async () => {
      const mockStations = [
        { id: '1', name: '新宿', lines: [] },
        { id: '2', name: '東京', lines: [] }
      ];

      prismaMock.station.findMany.mockResolvedValue(mockStations as any);

      const result = await repository.findByLines(['yamanote', 'chuo']);

      expect(prismaMock.station.findMany).toHaveBeenCalledWith({
        where: {
          lines: {
            some: {
              lineId: { in: ['yamanote', 'chuo'] }
            }
          }
        },
        include: {
          lines: {
            include: {
              line: true
            }
          }
        }
      });
      expect(result).toEqual(mockStations);
    });
  });

  describe('getLines', () => {
    it('should get lines for a station', async () => {
      const mockStation = {
        id: '1',
        lines: [
          { line: { id: 'l1', name: '山手線', nameEn: 'Yamanote Line' } },
          { line: { id: 'l2', name: '中央線', nameEn: 'Chuo Line' } }
        ]
      };

      prismaMock.station.findUnique.mockResolvedValue(mockStation as any);

      const result = await repository.getLines('1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 'l1', name: '山手線', nameEn: 'Yamanote Line' });
    });

    it('should return empty array if station not found', async () => {
      prismaMock.station.findUnique.mockResolvedValue(null);

      const result = await repository.getLines('nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('findNearbyStations', () => {
    it('should find nearby stations sorted by distance', async () => {
      const refStation = {
        id: 'ref',
        name: '新宿',
        latitude: 35.6896,
        longitude: 139.7006
      };

      const nearbyStations = [
        { id: 'ref', name: '新宿', latitude: 35.6896, longitude: 139.7006 },
        { id: 'near1', name: '代々木', latitude: 35.6838, longitude: 139.7020 },
        { id: 'near2', name: '原宿', latitude: 35.6702, longitude: 139.7026 }
      ];

      (prismaMock.station.findUnique as any)
        .mockResolvedValueOnce(refStation); // For initial lookup
      
      (prismaMock.station.findMany as any)
        .mockResolvedValueOnce(nearbyStations); // For nearby search

      const result = await repository.findNearbyStations('ref', 2, 5);

      // Should exclude the reference station
      expect(result).toHaveLength(2);
      expect(result.every(s => s.id !== 'ref')).toBe(true);
      
      // Closer station should be first
      expect(result[0].id).toBe('near1');
    });

    it('should return empty array if reference station not found', async () => {
      prismaMock.station.findUnique.mockResolvedValue(null);

      const result = await repository.findNearbyStations('nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('bulk operations', () => {
    it('should find multiple stations by ids', async () => {
      const mockStations = [
        { id: '1', name: '新宿' },
        { id: '2', name: '渋谷' }
      ];

      prismaMock.station.findMany.mockResolvedValue(mockStations as any);

      const result = await repository.findMany(['1', '2', '3']);

      expect(prismaMock.station.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['1', '2', '3'] }
        }
      });
      expect(result).toEqual(mockStations);
    });

    it('should create multiple stations', async () => {
      const stationData = [
        { id: '1', name: '新宿', latitude: 35.6896, longitude: 139.7006 },
        { id: '2', name: '渋谷', latitude: 35.6580, longitude: 139.7016 }
      ];

      prismaMock.station.createMany.mockResolvedValue({ count: 2 });

      const result = await repository.createMany(stationData);

      expect(prismaMock.station.createMany).toHaveBeenCalledWith({
        data: stationData,
        skipDuplicates: true
      });
      expect(result).toEqual({ count: 2 });
    });
  });

  describe('exists', () => {
    it('should return true if station exists', async () => {
      prismaMock.station.count.mockResolvedValue(1);

      const result = await repository.exists('station1');

      expect(prismaMock.station.count).toHaveBeenCalledWith({
        where: { id: 'station1' }
      });
      expect(result).toBe(true);
    });

    it('should return false if station does not exist', async () => {
      prismaMock.station.count.mockResolvedValue(0);

      const result = await repository.exists('nonexistent');

      expect(result).toBe(false);
    });
  });
});