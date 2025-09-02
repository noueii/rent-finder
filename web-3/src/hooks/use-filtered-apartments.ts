import { useSearch } from '~/contexts';
import { useMemo } from 'react';
import type { RouterOutputs } from '~/trpc/react';

type Apartment = RouterOutputs['apartment']['search']['apartments'][0];

export function useFilteredApartments(apartments: Apartment[]) {
  const { filters } = useSearch();

  const filteredApartments = useMemo(() => {
    let result = [...apartments];

    // Apply price filters
    if (filters.priceMin !== undefined) {
      result = result.filter(apt => apt.price >= filters.priceMin!);
    }
    if (filters.priceMax !== undefined) {
      result = result.filter(apt => apt.price <= filters.priceMax!);
    }

    // Apply size filters
    if (filters.sizeMin !== undefined) {
      result = result.filter(apt => apt.size && apt.size >= filters.sizeMin!);
    }
    if (filters.sizeMax !== undefined) {
      result = result.filter(apt => apt.size && apt.size <= filters.sizeMax!);
    }

    // Apply layout filters
    if (filters.layout && filters.layout.length > 0) {
      result = result.filter(apt => 
        apt.layout && filters.layout!.includes(apt.layout)
      );
    }

    // Apply amenity filters (would need to check apartment features)
    if (filters.amenities && filters.amenities.length > 0) {
      // This would require apartment to have a features field
      // For now, we'll skip this filter
    }

    // Apply station filters
    if (filters.stationIds && filters.stationIds.length > 0) {
      result = result.filter(apt => {
        // Check if apartment has nearestStations matching any of the selected station IDs
        return apt.nearestStations?.some(ns => 
          filters.stationIds!.includes(ns.stationId)
        );
      });
    }

    // Apply sorting - Not supported in current filter interface
    /* if (filters.sortBy) {
      result.sort((a, b) => {
        let comparison = 0;

        switch (filters.sortBy) {
          case 'price':
            comparison = a.price - b.price;
            break;
          case 'size':
            comparison = (a.size || 0) - (b.size || 0);
            break;
          case 'commuteTime':
            // Sort by minimum commute time
            const aMinCommute = Math.min(...(a.routes?.map(r => r.durationMinutes) || [999]));
            const bMinCommute = Math.min(...(b.routes?.map(r => r.durationMinutes) || [999]));
            comparison = aMinCommute - bMinCommute;
            break;
          case 'createdAt':
            comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            break;
        }

        return filters.sortOrder === 'desc' ? -comparison : comparison;
      });
    } */

    return result;
  }, [apartments, filters]);

  return {
    filteredApartments,
    totalCount: apartments.length,
    filteredCount: filteredApartments.length,
  };
}