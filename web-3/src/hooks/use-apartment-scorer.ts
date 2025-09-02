import { useMemo } from "react";
import { api } from "~/trpc/react";
import { ApartmentScorer } from "~/lib/scoring/apartment-scorer";
import type { ApartmentWithScore, ScoringConfig } from "~/lib/scoring/apartment-scorer";

export function useApartmentScorer(config?: ScoringConfig) {
  // Get user preferences
  const { data: userPreferences } = api.user.getPreferences.useQuery();

  // Create memoized scorer instance
  const scorer = useMemo(() => {
    return ApartmentScorer.fromUserPreferences(userPreferences || null, config);
  }, [userPreferences, config]);

  // Memoized scoring function
  const scoreApartments = useMemo(() => {
    return (apartments: ApartmentWithScore[]) => scorer.scoreApartments(apartments);
  }, [scorer]);

  // Memoized single apartment scoring
  const scoreApartment = useMemo(() => {
    return (apartment: ApartmentWithScore) => scorer.calculateScore(apartment);
  }, [scorer]);

  return {
    scorer,
    scoreApartments,
    scoreApartment,
    preferences: userPreferences,
    isLoading: !userPreferences,
  };
}