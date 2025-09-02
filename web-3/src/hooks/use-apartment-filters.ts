// This is a legacy hook for backward compatibility
// Use useFilterState instead for new code
import { useCallback } from 'react';
import { useFilterState } from './use-filter-state';

export function useApartmentFilters() {
  const { appliedFilters: filters, updateDraftFilters, applyFilters, resetFilters } = useFilterState();

  // Create a wrapper to apply changes immediately for backward compatibility
  const updateFilters = useCallback((updates: any) => {
    updateDraftFilters(updates);
    applyFilters();
  }, [updateDraftFilters, applyFilters]);

  // Price range helpers
  const setPriceRange = useCallback((min?: number, max?: number) => {
    updateFilters({ priceMin: min, priceMax: max });
  }, [updateFilters]);

  // Station helpers
  const addStation = useCallback((station: string) => {
    const current = filters.stationIds || [];
    if (!current.includes(station)) {
      updateFilters({ stationIds: [...current, station] });
    }
  }, [filters.stationIds, updateFilters]);

  const removeStation = useCallback((station: string) => {
    const current = filters.stationIds || [];
    updateFilters({ stationIds: current.filter(s => s !== station) });
  }, [filters.stationIds, updateFilters]);

  const setStations = useCallback((stations: string[]) => {
    updateFilters({ stationIds: stations });
  }, [updateFilters]);

  // Layout helpers
  const toggleLayout = useCallback((layout: string) => {
    const current = filters.layout || [];
    const updated = current.includes(layout)
      ? current.filter(l => l !== layout)
      : [...current, layout];
    updateFilters({ layout: updated });
  }, [filters.layout, updateFilters]);

  // Amenities helpers
  const toggleAmenity = useCallback((amenity: string) => {
    const current = filters.amenities || [];
    const updated = current.includes(amenity)
      ? current.filter(a => a !== amenity)
      : [...current, amenity];
    updateFilters({ amenities: updated });
  }, [filters.amenities, updateFilters]);

  // Area helpers
  const setAreaRange = useCallback((min?: number, max?: number) => {
    updateFilters({ sizeMin: min, sizeMax: max });
  }, [updateFilters]);

  // Commute time helper
  const setMaxCommuteTime = useCallback((time?: number) => {
    updateFilters({ maxCommuteMinutes: time });
  }, [updateFilters]);

  // Sorting helpers
  const setSorting = useCallback((sortBy: string, sortOrder: 'asc' | 'desc' = 'asc') => {
    updateFilters({ sortBy: sortBy as any, sortOrder });
  }, [updateFilters]);

  return {
    filters,
    updateFilters,
    clearFilters: resetFilters,
    resetFilter: () => {}, // No-op for backward compatibility
    // Specific helpers
    setPriceRange,
    addStation,
    removeStation,
    setStations,
    togglePropertyType: toggleLayout,
    toggleFeature: toggleAmenity,
    setAreaRange,
    setMaxCommuteTime,
    setSorting,
  };
}