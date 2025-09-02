'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { ApartmentSearchFilters } from '~/types/apartment';

interface ApartmentFilters extends ApartmentSearchFilters {
  sortBy?: 'price' | 'size' | 'createdAt' | 'commuteTime' | 'score';
  sortOrder?: 'asc' | 'desc';
  minFloor?: number; // Custom field not in base interface
  stationNames?: string[]; // Custom field for station names
  maxCommuteTime?: number; // UI uses this name but maps to maxCommuteMinutes
}

const STORAGE_KEY = 'apartment-filters';

const defaultFilters: ApartmentFilters = {
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

export function useFilterState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Parse filters from URL
  const parseFiltersFromURL = (): ApartmentFilters => {
    const filters: ApartmentFilters = {};
    
    // Price filters
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    if (minPrice) filters.priceMin = parseInt(minPrice);
    if (maxPrice) filters.priceMax = parseInt(maxPrice);
    
    // Two year average filters
    const twoYearAvgMin = searchParams.get('twoYearAvgMin');
    const twoYearAvgMax = searchParams.get('twoYearAvgMax');
    if (twoYearAvgMin) filters.twoYearAvgMin = parseInt(twoYearAvgMin);
    if (twoYearAvgMax) filters.twoYearAvgMax = parseInt(twoYearAvgMax);
    
    // Size filters
    const minSize = searchParams.get('minSize');
    const maxSize = searchParams.get('maxSize');
    if (minSize) filters.sizeMin = parseFloat(minSize);
    if (maxSize) filters.sizeMax = parseFloat(maxSize);
    
    // Layout filter
    const layouts = searchParams.get('layouts');
    if (layouts) filters.layout = layouts.split(',');
    
    // Building age filter
    const maxBuildingAge = searchParams.get('maxBuildingAge');
    if (maxBuildingAge) filters.buildingAge = parseInt(maxBuildingAge);
    
    // Floor filter
    const minFloor = searchParams.get('minFloor');
    if (minFloor) filters.minFloor = parseInt(minFloor);
    
    // Station filters
    const stationNames = searchParams.get('stationNames');
    if (stationNames) filters.stationNames = stationNames.split(',');
    
    const stationIds = searchParams.get('stationIds');
    if (stationIds) filters.stationIds = stationIds.split(',');
    
    // Commute time filter
    const maxCommuteTime = searchParams.get('maxCommuteTime');
    if (maxCommuteTime) {
      filters.maxCommuteTime = parseInt(maxCommuteTime); // For UI
      filters.maxCommuteMinutes = parseInt(maxCommuteTime); // For API
    }
    
    // Ward exclusion filter
    const excludeWards = searchParams.get('excludeWards');
    if (excludeWards) filters.excludeWards = excludeWards.split(',');
    
    // Sort filters
    const sortBy = searchParams.get('sortBy');
    if (sortBy) {
      // Migrate old 'addedAt' to 'createdAt'
      filters.sortBy = sortBy === 'addedAt' ? 'createdAt' : sortBy as ApartmentFilters['sortBy'];
    }
    
    const sortOrder = searchParams.get('sortOrder');
    if (sortOrder) filters.sortOrder = sortOrder as ApartmentFilters['sortOrder'];
    
    return filters;
  };
  
  // Load filters from localStorage
  const loadFiltersFromStorage = (): ApartmentFilters => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Migrate old 'createdAt' to 'addedAt'
        if (parsed.sortBy === 'createdAt') {
          parsed.sortBy = 'addedAt';
        }
        return { ...defaultFilters, ...parsed };
      }
    } catch (error) {
      console.error('Failed to load filters from localStorage:', error);
    }
    return defaultFilters;
  };
  
  // Initialize applied filters from URL or localStorage
  const [appliedFilters, setAppliedFilters] = useState<ApartmentFilters>(() => {
    const urlFilters = parseFiltersFromURL();
    if (Object.keys(urlFilters).length > 0) {
      return { ...defaultFilters, ...urlFilters };
    }
    return defaultFilters;
  });
  
  // Load from localStorage on client side
  useEffect(() => {
    const urlFilters = parseFiltersFromURL();
    if (Object.keys(urlFilters).length === 0) {
      const storageFilters = loadFiltersFromStorage();
      setAppliedFilters(storageFilters);
    }
    setIsInitialized(true);
  }, []);
  
  // Draft filters for editing (copy of applied filters)
  const [draftFilters, setDraftFilters] = useState<ApartmentFilters>(appliedFilters);
  
  // Sync draft with applied when applied changes
  useEffect(() => {
    setDraftFilters(appliedFilters);
  }, [appliedFilters]);
  
  // Update draft filters
  const updateDraftFilters = useCallback((updates: Partial<ApartmentFilters>) => {
    setDraftFilters(prev => ({ ...prev, ...updates }));
  }, []);
  
  // Clear draft filters
  const clearDraftFilters = useCallback(() => {
    setDraftFilters(defaultFilters);
  }, []);
  
  // Apply filters (update URL, localStorage, and applied state)
  const applyFilters = useCallback(() => {
    const filtersToSave = { ...draftFilters };
    
    // Update localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtersToSave));
    } catch (error) {
      console.error('Failed to save filters to localStorage:', error);
    }
    
    // Update URL
    const params = new URLSearchParams();
    
    // Add filters to params
    if (filtersToSave.priceMin) params.set('minPrice', filtersToSave.priceMin.toString());
    if (filtersToSave.priceMax) params.set('maxPrice', filtersToSave.priceMax.toString());
    if (filtersToSave.twoYearAvgMin) params.set('twoYearAvgMin', filtersToSave.twoYearAvgMin.toString());
    if (filtersToSave.twoYearAvgMax) params.set('twoYearAvgMax', filtersToSave.twoYearAvgMax.toString());
    if (filtersToSave.sizeMin) params.set('minSize', filtersToSave.sizeMin.toString());
    if (filtersToSave.sizeMax) params.set('maxSize', filtersToSave.sizeMax.toString());
    if (filtersToSave.layout?.length) params.set('layouts', filtersToSave.layout.join(','));
    if (filtersToSave.excludeWards?.length) params.set('excludeWards', filtersToSave.excludeWards.join(','));
    if (filtersToSave.buildingAge) params.set('maxBuildingAge', filtersToSave.buildingAge.toString());
    if (filtersToSave.minFloor) params.set('minFloor', filtersToSave.minFloor.toString());
    if (filtersToSave.stationNames?.length) params.set('stationNames', filtersToSave.stationNames.join(','));
    if (filtersToSave.stationIds?.length) params.set('stationIds', filtersToSave.stationIds.join(','));
    if (filtersToSave.maxCommuteTime) params.set('maxCommuteTime', filtersToSave.maxCommuteTime.toString());
    if (filtersToSave.sortBy && filtersToSave.sortBy !== 'createdAt') params.set('sortBy', filtersToSave.sortBy);
    if (filtersToSave.sortOrder && filtersToSave.sortOrder !== 'desc') params.set('sortOrder', filtersToSave.sortOrder);
    
    // Update URL without navigation
    const queryString = params.toString();
    const newURL = queryString ? `${pathname}?${queryString}` : pathname;
    router.replace(newURL);
    
    // Update applied filters
    setAppliedFilters(filtersToSave);
  }, [draftFilters, pathname, router]);
  
  // Reset filters
  const resetFilters = useCallback(() => {
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    
    // Clear localStorage
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear filters from localStorage:', error);
    }
    
    // Clear URL params
    router.replace(pathname);
  }, [pathname, router]);
  
  return {
    // The actual filters being used for queries
    appliedFilters,
    // The draft filters being edited in the UI
    draftFilters,
    // Methods
    updateDraftFilters,
    clearDraftFilters,
    applyFilters,
    resetFilters,
    // State
    isInitialized,
  };
}