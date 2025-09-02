import { useMemo } from "react";
import { api } from "~/trpc/react";
import { TargetedApartmentScorer } from "~/lib/scoring/targeted-apartment-scorer";
import type { ApartmentWithFullRelations, TargetedScoringConfig } from "~/lib/scoring/targeted-apartment-scorer";

export function useTargetedApartmentScorer(config?: TargetedScoringConfig) {
  // Get user preferences
  const { data: userPreferences } = api.user.getPreferences.useQuery();

  // Create memoized scorer instance
  const scorer = useMemo(() => {
    return TargetedApartmentScorer.fromUserPreferences(userPreferences || null, config);
  }, [userPreferences, config]);

  // Memoized scoring function
  const scoreApartments = useMemo(() => {
    return (apartments: ApartmentWithFullRelations[]) => scorer.scoreApartments(apartments);
  }, [scorer]);

  // Memoized single apartment scoring
  const scoreApartment = useMemo(() => {
    return (apartment: ApartmentWithFullRelations) => scorer.calculateScore(apartment);
  }, [scorer]);

  return {
    scorer,
    scoreApartments,
    scoreApartment,
    preferences: userPreferences,
    isLoading: !userPreferences,
  };
}