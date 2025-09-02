import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { UserPreferencesProvider, useUserPreferences } from '../UserPreferencesContext';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock as any;

describe('UserPreferencesContext', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <UserPreferencesProvider>{children}</UserPreferencesProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should provide initial values', () => {
    const { result } = renderHook(() => useUserPreferences(), { wrapper });
    
    expect(result.current.clientSideFilters).toEqual({});
    expect(result.current.showLiked).toBe(true);
    expect(result.current.showBookmarked).toBe(true);
    expect(result.current.showHidden).toBe(false);
    expect(result.current.showFavorited).toBe(true);
    expect(result.current.hideViewed).toBe(false);
    expect(result.current.viewMode).toBe('list');
    expect(result.current.sortBy).toBe('addedAt');
    expect(result.current.sortOrder).toBe('desc');
  });

  it('should update client side filters', () => {
    const { result } = renderHook(() => useUserPreferences(), { wrapper });
    
    act(() => {
      result.current.updateClientSideFilters({ showBookmarked: true, showLiked: true });
    });
    
    expect(result.current.clientSideFilters).toEqual({ showBookmarked: true, showLiked: true });
  });

  it('should reset client side filters', () => {
    const { result } = renderHook(() => useUserPreferences(), { wrapper });
    
    act(() => {
      result.current.updateClientSideFilters({ showBookmarked: true, showLiked: true });
      result.current.resetClientSideFilters();
    });
    
    expect(result.current.clientSideFilters).toEqual({});
    expect(result.current.hideViewed).toBe(false);
  });

  it('should update individual preferences', () => {
    const { result } = renderHook(() => useUserPreferences(), { wrapper });
    
    act(() => {
      result.current.setShowLiked(false);
      result.current.setShowBookmarked(false);
      result.current.setShowHidden(true);
      result.current.setViewMode('grid');
      result.current.setSortBy('price');
      result.current.setSortOrder('asc');
    });
    
    expect(result.current.showLiked).toBe(false);
    expect(result.current.showBookmarked).toBe(false);
    expect(result.current.showHidden).toBe(true);
    expect(result.current.viewMode).toBe('grid');
    expect(result.current.sortBy).toBe('price');
    expect(result.current.sortOrder).toBe('asc');
  });

  it('should save preferences to localStorage', () => {
    const { result } = renderHook(() => useUserPreferences(), { wrapper });
    
    act(() => {
      result.current.setViewMode('map');
      result.current.setSortBy('size');
    });
    
    // Wait for useEffect to run
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'user-preferences',
      expect.stringContaining('"viewMode":"map"')
    );
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'user-preferences',
      expect.stringContaining('"sortBy":"size"')
    );
  });

  it('should load preferences from localStorage', () => {
    const mockPreferences = {
      clientSideFilters: { showBookmarked: true },
      showLiked: false,
      showBookmarked: false,
      showHidden: true,
      showFavorited: false,
      viewMode: 'grid',
      sortBy: 'price',
      sortOrder: 'asc',
    };
    
    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockPreferences));
    
    const { result } = renderHook(() => useUserPreferences(), { wrapper });
    
    expect(result.current.showLiked).toBe(false);
    expect(result.current.showBookmarked).toBe(false);
    expect(result.current.showHidden).toBe(true);
    expect(result.current.viewMode).toBe('grid');
    expect(result.current.sortBy).toBe('price');
    expect(result.current.sortOrder).toBe('asc');
  });

  it('should handle localStorage errors gracefully', () => {
    localStorageMock.getItem.mockImplementation(() => {
      throw new Error('localStorage error');
    });
    
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    const { result } = renderHook(() => useUserPreferences(), { wrapper });
    
    // Should still provide default values
    expect(result.current.viewMode).toBe('list');
    expect(consoleSpy).toHaveBeenCalledWith('Failed to load user preferences:', expect.any(Error));
    
    consoleSpy.mockRestore();
  });
});