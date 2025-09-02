"use client";

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { ApartmentSearchFilters } from '~/types/apartment';
import type { StationWithLines } from '~/types/station';

export interface CommuteSearchFilters {
  workplaceStationId?: string;
  workplaceStationName?: string;
  maxCommuteMinutes: number;
}

interface SearchContextValue {
  // Standard search filters
  filters: ApartmentSearchFilters;
  updateFilters: (updates: Partial<ApartmentSearchFilters>) => void;
  resetFilters: () => void;
  
  // Commute search filters
  commuteFilters: CommuteSearchFilters;
  updateCommuteFilters: (updates: Partial<CommuteSearchFilters>) => void;
  resetCommuteFilters: () => void;
  setWorkplaceStation: (station: StationWithLines) => void;
  
  // Search mode
  searchMode: 'standard' | 'commute';
  setSearchMode: (mode: 'standard' | 'commute') => void;
  
  // Selected stations for standard search
  selectedStations: string[];
  addStation: (stationId: string) => void;
  removeStation: (stationId: string) => void;
  clearStations: () => void;
}

const SearchContext = createContext<SearchContextValue | undefined>(undefined);

export function useSearch() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within SearchProvider');
  }
  return context;
}

interface SearchProviderProps {
  children: ReactNode;
  initialFilters?: Partial<ApartmentSearchFilters>;
  initialCommuteFilters?: Partial<CommuteSearchFilters>;
}

const defaultFilters: ApartmentSearchFilters = {};
const defaultCommuteFilters: CommuteSearchFilters = {
  maxCommuteMinutes: 30,
};

export function SearchProvider({
  children,
  initialFilters = {},
  initialCommuteFilters = {},
}: SearchProviderProps) {
  const [filters, setFilters] = useState<ApartmentSearchFilters>({
    ...defaultFilters,
    ...initialFilters,
  });
  
  const [commuteFilters, setCommuteFilters] = useState<CommuteSearchFilters>({
    ...defaultCommuteFilters,
    ...initialCommuteFilters,
  });
  
  const [selectedStations, setSelectedStations] = useState<string[]>(
    initialFilters.stationIds || []
  );
  
  const searchMode = commuteFilters.workplaceStationId ? 'commute' : 'standard';
  
  const updateFilters = useCallback((updates: Partial<ApartmentSearchFilters>) => {
    setFilters(prev => ({ ...prev, ...updates }));
    if (updates.stationIds) {
      setSelectedStations(updates.stationIds);
    }
  }, []);
  
  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
    setSelectedStations([]);
  }, []);
  
  const updateCommuteFilters = useCallback((updates: Partial<CommuteSearchFilters>) => {
    setCommuteFilters(prev => ({ ...prev, ...updates }));
  }, []);
  
  const resetCommuteFilters = useCallback(() => {
    setCommuteFilters(defaultCommuteFilters);
  }, []);
  
  const setWorkplaceStation = useCallback((station: StationWithLines) => {
    setCommuteFilters(prev => ({
      ...prev,
      workplaceStationId: station.id,
      workplaceStationName: station.nameEn || station.name,
    }));
  }, []);
  
  const setSearchMode = useCallback((mode: 'standard' | 'commute') => {
    if (mode === 'standard') {
      resetCommuteFilters();
    }
  }, [resetCommuteFilters]);
  
  const addStation = useCallback((stationId: string) => {
    if (!selectedStations.includes(stationId)) {
      const newStations = [...selectedStations, stationId];
      setSelectedStations(newStations);
      updateFilters({ stationIds: newStations });
    }
  }, [selectedStations, updateFilters]);
  
  const removeStation = useCallback((stationId: string) => {
    const newStations = selectedStations.filter(id => id !== stationId);
    setSelectedStations(newStations);
    updateFilters({ stationIds: newStations });
  }, [selectedStations, updateFilters]);
  
  const clearStations = useCallback(() => {
    setSelectedStations([]);
    updateFilters({ stationIds: [] });
  }, [updateFilters]);
  
  const value: SearchContextValue = {
    filters,
    updateFilters,
    resetFilters,
    commuteFilters,
    updateCommuteFilters,
    resetCommuteFilters,
    setWorkplaceStation,
    searchMode,
    setSearchMode,
    selectedStations,
    addStation,
    removeStation,
    clearStations,
  };
  
  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
}