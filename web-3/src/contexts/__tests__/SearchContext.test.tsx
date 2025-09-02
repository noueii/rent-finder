import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { SearchProvider, useSearch } from '../SearchContext';
import type { StationWithLines } from '~/types/station';

describe('SearchContext', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <SearchProvider>{children}</SearchProvider>
  );

  it('should provide initial values', () => {
    const { result } = renderHook(() => useSearch(), { wrapper });
    
    expect(result.current.filters).toEqual({});
    expect(result.current.commuteFilters).toEqual({ maxCommuteMinutes: 30 });
    expect(result.current.searchMode).toBe('standard');
    expect(result.current.selectedStations).toEqual([]);
  });

  it('should update filters', () => {
    const { result } = renderHook(() => useSearch(), { wrapper });
    
    act(() => {
      result.current.updateFilters({ priceMin: 50000, priceMax: 100000 });
    });
    
    expect(result.current.filters).toEqual({ priceMin: 50000, priceMax: 100000 });
  });

  it('should reset filters', () => {
    const { result } = renderHook(() => useSearch(), { wrapper });
    
    act(() => {
      result.current.updateFilters({ priceMin: 50000, priceMax: 100000 });
      result.current.resetFilters();
    });
    
    expect(result.current.filters).toEqual({});
  });

  it('should set workplace station', () => {
    const { result } = renderHook(() => useSearch(), { wrapper });
    
    const station: StationWithLines = {
      id: 'tokyo-station',
      name: '東京',
      nameEn: 'Tokyo',
      latitude: 35.6812,
      longitude: 139.7671,
      lines: [],
    };
    
    act(() => {
      result.current.setWorkplaceStation(station);
    });
    
    expect(result.current.commuteFilters.workplaceStationId).toBe('tokyo-station');
    expect(result.current.commuteFilters.workplaceStationName).toBe('Tokyo');
    expect(result.current.searchMode).toBe('commute');
  });

  it('should manage selected stations', () => {
    const { result } = renderHook(() => useSearch(), { wrapper });
    
    act(() => {
      result.current.addStation('station-1');
      result.current.addStation('station-2');
    });
    
    expect(result.current.selectedStations).toEqual(['station-1', 'station-2']);
    expect(result.current.filters.stationIds).toEqual(['station-1', 'station-2']);
    
    act(() => {
      result.current.removeStation('station-1');
    });
    
    expect(result.current.selectedStations).toEqual(['station-2']);
    expect(result.current.filters.stationIds).toEqual(['station-2']);
    
    act(() => {
      result.current.clearStations();
    });
    
    expect(result.current.selectedStations).toEqual([]);
    expect(result.current.filters.stationIds).toEqual([]);
  });

  it('should not add duplicate stations', () => {
    const { result } = renderHook(() => useSearch(), { wrapper });
    
    act(() => {
      result.current.addStation('station-1');
      result.current.addStation('station-1');
    });
    
    expect(result.current.selectedStations).toEqual(['station-1']);
  });

  it('should switch search modes correctly', () => {
    const { result } = renderHook(() => useSearch(), { wrapper });
    
    const station: StationWithLines = {
      id: 'tokyo-station',
      name: '東京',
      nameEn: 'Tokyo',
      latitude: 35.6812,
      longitude: 139.7671,
      lines: [],
    };
    
    act(() => {
      result.current.setWorkplaceStation(station);
    });
    
    expect(result.current.searchMode).toBe('commute');
    
    act(() => {
      result.current.setSearchMode('standard');
    });
    
    expect(result.current.searchMode).toBe('standard');
    expect(result.current.commuteFilters.workplaceStationId).toBeUndefined();
  });
});