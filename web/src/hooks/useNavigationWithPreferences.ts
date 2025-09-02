'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { useUserSettings } from '@/hooks/useUserSettings';
import { 
  constructUrlWithPreferences, 
  type PageType 
} from '@/lib/utils/navigationWithPreferences';

/**
 * Hook that provides navigation functions with user preferences
 */
export function useNavigationWithPreferences() {
  const router = useRouter();
  const { settings } = useUserSettings();
  
  /**
   * Navigate to a page with user preferences applied
   */
  const navigateWithPreferences = useCallback((
    page: PageType,
    overrides: Record<string, any> = {}
  ) => {
    const url = constructUrlWithPreferences(page, settings, overrides);
    router.push(url);
  }, [router, settings]);
  
  /**
   * Navigate to browse page with preferences
   */
  const navigateToBrowse = useCallback((overrides: Record<string, any> = {}) => {
    navigateWithPreferences('browse', overrides);
  }, [navigateWithPreferences]);
  
  /**
   * Navigate to map page with preferences
   */
  const navigateToMap = useCallback((overrides: Record<string, any> = {}) => {
    navigateWithPreferences('map', overrides);
  }, [navigateWithPreferences]);
  
  /**
   * Get URL string without navigating (useful for Link components)
   */
  const getUrlWithPreferences = useCallback((
    page: PageType,
    overrides: Record<string, any> = {}
  ): string => {
    return constructUrlWithPreferences(page, settings, overrides);
  }, [settings]);
  
  return {
    navigateWithPreferences,
    navigateToBrowse,
    navigateToMap,
    getUrlWithPreferences,
  };
}