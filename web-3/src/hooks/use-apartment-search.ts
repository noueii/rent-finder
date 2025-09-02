"use client";

import { useCallback, useMemo } from 'react';
import { useSearch } from '~/contexts/SearchContext';
import { useUserPreferences } from '~/contexts/UserPreferencesContext';
import { api } from '~/trpc/react';
import type { ApartmentSearchFilters } from '~/types/apartment';

export function useApartmentSearch() {
  const { filters, commuteFilters, searchMode } = useSearch();
  const { sortBy, sortOrder } = useUserPreferences();
  
  // Merge filters for API call
  const searchFilters = useMemo((): ApartmentSearchFilters => {
    const baseFilters = { ...filters };
    
    // Add commute filters if in commute mode
    if (searchMode === 'commute' && commuteFilters.workplaceStationId) {
      baseFilters.maxCommuteMinutes = commuteFilters.maxCommuteMinutes;
    }
    
    return baseFilters;
  }, [filters, commuteFilters, searchMode]);
  
  // Search query
  // Note: commuteTime and score sorting are not supported by all APIs yet
  const apiSortBy = useMemo(() => {
    if (sortBy === 'commuteTime' || sortBy === 'score') {
      return 'createdAt';
    }
    return sortBy;
  }, [sortBy]);
  
  const searchQuery = api.apartment.search.useQuery({
    filters: searchFilters,
    sort: { field: apiSortBy, order: sortOrder },
    pagination: { page: 1, limit: 20 },
  });
  
  // Refresh apartments
  const refreshMutation = api.search.refreshApartments.useMutation();
  
  const refreshApartments = useCallback(async () => {
    await refreshMutation.mutateAsync({
      filters: searchFilters,
      sort: { field: apiSortBy, order: sortOrder },
    });
    await searchQuery.refetch();
  }, [searchFilters, apiSortBy, sortOrder, refreshMutation, searchQuery]);
  
  // Commute search
  const commuteSearchMutation = api.search.searchWithCommute.useMutation();
  
  const startCommuteSearch = useCallback(async (listName: string, listDescription?: string) => {
    if (!commuteFilters.workplaceStationId) {
      throw new Error('Workplace station is required for commute search');
    }
    
    return await commuteSearchMutation.mutateAsync({
      workplaceStationId: commuteFilters.workplaceStationId,
      maxCommuteMinutes: commuteFilters.maxCommuteMinutes,
      filters: searchFilters,
      listName,
      listDescription,
    });
  }, [commuteFilters, searchFilters, commuteSearchMutation]);
  
  return {
    // Data
    apartments: searchQuery.data?.apartments || [],
    total: searchQuery.data?.total || 0,
    hasMore: searchQuery.data?.hasMore || false,
    
    // State
    isLoading: searchQuery.isLoading,
    isRefreshing: refreshMutation.isPending,
    isSearching: commuteSearchMutation.isPending,
    error: searchQuery.error,
    
    // Actions
    refreshApartments,
    startCommuteSearch,
    refetch: searchQuery.refetch,
    
    // Current filters
    searchFilters,
    searchMode,
  };
}