/**
 * Apartment Geocoder
 * 
 * This module integrates the geocoding service with apartment data processing,
 * providing utilities to geocode apartment addresses and update the database.
 */

import { PrismaClient } from '@prisma/client';
import { geocodingService, type GeocodingResult } from './index';
import type { Apartment } from '@prisma/client';

export interface ApartmentGeocodeResult {
  apartmentId: string;
  address: string;
  success: boolean;
  result?: GeocodingResult;
  error?: string;
}

export class ApartmentGeocoder {
  constructor(private prisma: PrismaClient) {}

  /**
   * Geocode a single apartment and update the database
   */
  async geocodeApartment(apartmentId: string): Promise<ApartmentGeocodeResult> {
    try {
      // Fetch apartment
      const apartment = await this.prisma.apartment.findUnique({
        where: { id: apartmentId },
        select: { id: true, address: true, latitude: true, longitude: true },
      });

      if (!apartment) {
        return {
          apartmentId,
          address: '',
          success: false,
          error: 'Apartment not found',
        };
      }

      // Skip if already geocoded
      if (apartment.latitude && apartment.longitude) {
        console.log(`[ApartmentGeocoder] Apartment ${apartmentId} already geocoded`);
        return {
          apartmentId,
          address: apartment.address,
          success: true,
          result: {
            latitude: apartment.latitude,
            longitude: apartment.longitude,
            provider: 'cache',
          },
        };
      }

      // Geocode the address
      const result = await geocodingService.geocode(apartment.address);

      if (!result) {
        return {
          apartmentId,
          address: apartment.address,
          success: false,
          error: 'Geocoding failed - no results',
        };
      }

      // Update apartment with coordinates
      await this.prisma.apartment.update({
        where: { id: apartmentId },
        data: {
          latitude: result.latitude,
          longitude: result.longitude,
        },
      });

      return {
        apartmentId,
        address: apartment.address,
        success: true,
        result,
      };
    } catch (error) {
      console.error(`[ApartmentGeocoder] Error geocoding apartment ${apartmentId}:`, error);
      return {
        apartmentId,
        address: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Batch geocode apartments without coordinates
   */
  async geocodeUngeocoded(
    limit = 100,
    onProgress?: (completed: number, total: number, current?: ApartmentGeocodeResult) => void
  ): Promise<ApartmentGeocodeResult[]> {
    // Find apartments without coordinates
    const apartments = await this.prisma.apartment.findMany({
      where: {
        OR: [
          { latitude: null },
          { longitude: null },
        ],
      },
      select: { id: true, address: true },
      take: limit,
    });

    console.log(`[ApartmentGeocoder] Found ${apartments.length} apartments to geocode`);

    const results: ApartmentGeocodeResult[] = [];
    let completed = 0;

    for (const apartment of apartments) {
      const result = await this.geocodeApartment(apartment.id);
      results.push(result);
      
      completed++;
      if (onProgress) {
        onProgress(completed, apartments.length, result);
      }

      // Small delay to respect rate limits
      if (result.result?.provider === 'nominatim') {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * Update distances to nearest stations based on coordinates
   */
  async updateStationDistances(apartmentId: string): Promise<void> {
    const apartment = await this.prisma.apartment.findUnique({
      where: { id: apartmentId },
      include: {
        nearestStations: {
          include: {
            station: true,
          },
        },
      },
    });

    if (!apartment || !apartment.latitude || !apartment.longitude) {
      console.log(`[ApartmentGeocoder] Cannot update distances - no coordinates for apartment ${apartmentId}`);
      return;
    }

    // Update distance for each nearest station
    for (const nearestStation of apartment.nearestStations) {
      const station = nearestStation.station;
      
      // Skip if station doesn't have coordinates
      if (!station.latitude || !station.longitude) {
        continue;
      }

      // Calculate distance
      const distance = geocodingService.constructor.calculateDistance(
        apartment.latitude,
        apartment.longitude,
        station.latitude,
        station.longitude
      );

      // Update the relation with calculated distance
      await this.prisma.apartmentStation.update({
        where: { id: nearestStation.id },
        data: { distance },
      });

      console.log(
        `[ApartmentGeocoder] Updated distance for ${apartment.id} to ${station.name}: ${Math.round(distance)}m`
      );
    }
  }

  /**
   * Geocode apartments from a specific scraping source
   */
  async geocodeBySource(
    sourceSite: string,
    limit = 100,
    onProgress?: (completed: number, total: number) => void
  ): Promise<ApartmentGeocodeResult[]> {
    const apartments = await this.prisma.apartment.findMany({
      where: {
        sourceSite,
        OR: [
          { latitude: null },
          { longitude: null },
        ],
      },
      select: { id: true },
      take: limit,
    });

    const results: ApartmentGeocodeResult[] = [];
    let completed = 0;

    for (const apartment of apartments) {
      const result = await this.geocodeApartment(apartment.id);
      results.push(result);
      
      completed++;
      if (onProgress) {
        onProgress(completed, apartments.length);
      }
    }

    return results;
  }

  /**
   * Get geocoding statistics
   */
  async getStats(): Promise<{
    total: number;
    geocoded: number;
    notGeocoded: number;
    percentage: number;
    bySource: Record<string, { total: number; geocoded: number }>;
  }> {
    const [total, geocoded, bySource] = await Promise.all([
      this.prisma.apartment.count(),
      this.prisma.apartment.count({
        where: {
          NOT: [
            { latitude: null },
            { longitude: null },
          ],
        },
      }),
      this.prisma.apartment.groupBy({
        by: ['sourceSite'],
        _count: true,
      }),
    ]);

    const bySourceGeocoded = await Promise.all(
      bySource.map(async (source) => {
        const geocoded = await this.prisma.apartment.count({
          where: {
            sourceSite: source.sourceSite,
            NOT: [
              { latitude: null },
              { longitude: null },
            ],
          },
        });
        return {
          sourceSite: source.sourceSite,
          total: source._count,
          geocoded,
        };
      })
    );

    const sourceStats = bySourceGeocoded.reduce((acc, source) => {
      acc[source.sourceSite] = {
        total: source.total,
        geocoded: source.geocoded,
      };
      return acc;
    }, {} as Record<string, { total: number; geocoded: number }>);

    return {
      total,
      geocoded,
      notGeocoded: total - geocoded,
      percentage: total > 0 ? (geocoded / total) * 100 : 0,
      bySource: sourceStats,
    };
  }
}