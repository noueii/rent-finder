'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUserSettings } from './useUserSettings';
import { useNavigationWithPreferences } from '~/hooks/useNavigationWithPreferences';

export interface SearchFilters {
  targetStation?: string;
  maxCommuteTime?: number;
  minPrice?: number;
  maxPrice?: number;
  minSize?: number;
  maxSize?: number;
  layouts?: string[];
  maxBuildingAge?: number;
  maxWalkingMinutes?: number;
}


export function useSearchFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { navigateToSearch } = useNavigationWithPreferences();
  const { getDefaultSearchFilters } = useUserSettings();
  
  // Parse URL parameters
  const getParamNumber = useCallback((key: string, defaultValue?: number) => {
    const value = searchParams.get(key);
    return value ? Number(value) : defaultValue;
  }, [searchParams]);

  const getParamArray = useCallback((key: string): string[] => {
    const value = searchParams.get(key);
    return value ? value.split(',').filter(Boolean) : [];
  }, [searchParams]);

  // Read filters directly from URL params
  const defaultFilters = useMemo(() => getDefaultSearchFilters() || {
    minPrice: 50000,
    maxPrice: 200000,
    minSize: 20,
    maxSize: 80,
    layouts: []
  }, [getDefaultSearchFilters]);
  
  const filters: SearchFilters = useMemo(() => ({
    targetStation: searchParams.get('station') || undefined,
    maxCommuteTime: getParamNumber('commuteTime') || undefined,
    minPrice: getParamNumber('minPrice', defaultFilters.minPrice),
    maxPrice: getParamNumber('maxPrice', defaultFilters.maxPrice),
    minSize: getParamNumber('minSize', defaultFilters.minSize),
    maxSize: getParamNumber('maxSize', defaultFilters.maxSize),
    layouts: getParamArray('layouts'),
    maxBuildingAge: getParamNumber('buildingAge') || undefined,
    maxWalkingMinutes: getParamNumber('walkingMinutes') || undefined,
  }), [searchParams, getParamNumber, getParamArray, defaultFilters]);

  // Navigate with new filters
  const updateFilters = useCallback((newFilters: Partial<SearchFilters>, page = 1, sortBy = 'price_asc') => {
    const updatedFilters = { ...filters, ...newFilters };
    const params = new URLSearchParams();

    // Add filters to URL
    if (updatedFilters.targetStation) params.set('station', updatedFilters.targetStation);
    if (updatedFilters.maxCommuteTime) params.set('commuteTime', updatedFilters.maxCommuteTime.toString());
    if (updatedFilters.minPrice) params.set('minPrice', updatedFilters.minPrice.toString());
    if (updatedFilters.maxPrice) params.set('maxPrice', updatedFilters.maxPrice.toString());
    if (updatedFilters.minSize) params.set('minSize', updatedFilters.minSize.toString());
    if (updatedFilters.maxSize) params.set('maxSize', updatedFilters.maxSize.toString());
    if (updatedFilters.layouts && updatedFilters.layouts.length > 0) params.set('layouts', updatedFilters.layouts.join(','));
    if (updatedFilters.maxBuildingAge) params.set('buildingAge', updatedFilters.maxBuildingAge.toString());
    if (updatedFilters.maxWalkingMinutes) params.set('walkingMinutes', updatedFilters.maxWalkingMinutes.toString());

    // Add pagination and sorting
    if (page > 1) params.set('page', page.toString());
    if (sortBy !== 'price_asc') params.set('sortBy', sortBy);

    const newUrl = `/search?${params.toString()}`;
    router.push(newUrl);
  }, [filters, router]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    navigateToSearch();
  }, [navigateToSearch]);

  return {
    filters,
    updateFilters,
    clearFilters,
    hasFilters: !!(filters.targetStation || filters.maxCommuteTime),
  };
}