'use client';

import { useLocalStorage, useInitializeLocalStorage } from '@/lib/stores/localStorage';
import type { ApartmentComparisonData } from '@/lib/stores/localStorage';

export type ComparisonApartment = ApartmentComparisonData;
export type { ApartmentComparisonData };

const MAX_COMPARISONS = 3;

export function useApartmentComparison() {
  // Initialize localStorage on mount
  useInitializeLocalStorage();
  
  const {
    comparisonApartments,
    addToComparison,
    removeFromComparison,
    clearComparison: clearComparisons,
    isInComparison,
    getComparisonStats,
    canAddMoreToComparison,
  } = useLocalStorage();

  return {
    comparisonApartments,
    isLoading: false, // Zustand handles initialization
    addToComparison,
    removeFromComparison,
    clearComparisons,
    isInComparison,
    getComparisonStats,
    maxComparisons: MAX_COMPARISONS,
    canAddMore: canAddMoreToComparison(),
  };
}