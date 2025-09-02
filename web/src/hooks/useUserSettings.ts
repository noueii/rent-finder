'use client';

import { useLocalStorage, useInitializeLocalStorage } from '@/lib/stores/localStorage';
import type { UserSettings } from '@/lib/stores/localStorage';

export type { UserSettings };

export function useUserSettings() {
  // Initialize localStorage on mount
  useInitializeLocalStorage();
  
  const {
    userSettings,
    updateUserSettings,
    resetUserSettings,
    getDefaultSearchFilters,
    updateCommuteSettings,
    updateWorkLocation,
  } = useLocalStorage();

  return {
    settings: userSettings,
    isLoading: false, // Zustand handles initialization
    updateSettings: updateUserSettings,
    resetToDefaults: resetUserSettings,
    getDefaultSearchFilters,
    updateCommuteSettings,
    updateWorkLocation,
  };
}