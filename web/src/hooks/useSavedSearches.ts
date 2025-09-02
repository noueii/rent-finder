'use client';

import { useLocalStorage, useInitializeLocalStorage } from '@/lib/stores/localStorage';
import type { SavedSearch } from '@/lib/stores/localStorage';

export type { SavedSearch };

export function useSavedSearches() {
  // Initialize localStorage on mount
  useInitializeLocalStorage();
  
  const {
    savedSearches,
    saveSearch,
    removeSavedSearch: removeSearch,
    updateSavedSearch: updateSearch,
    markAsSearched,
    isSearchSaved,
    getSearchById,
    getRecentSearches,
  } = useLocalStorage();

  return {
    savedSearches,
    isLoading: false, // Zustand handles initialization
    saveSearch,
    removeSearch,
    updateSearch,
    markAsSearched,
    isSearchSaved,
    getSearchById,
    getRecentSearches,
  };
}