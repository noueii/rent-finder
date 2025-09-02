import { useCallback, useEffect, useState } from "react";
import { api } from "~/trpc/react";
import { TargetedApartmentScorer, type ApartmentWithFullRelations } from "~/lib/scoring/targeted-apartment-scorer";
import type { UserPreference } from "@prisma/client";

interface UseApartmentScoresOptions {
  apartmentIds?: string[];
  listId?: string;
  targetStationId?: string;
  enabled?: boolean;
  useDatabase?: boolean; // Whether to use database caching
}

interface UseApartmentScoresReturn {
  scores: Record<string, number>;
  scoreBreakdowns: Record<string, any>;
  isCalculating: boolean;
  calculateScores: () => Promise<void>;
  refetch: () => void;
}

export function useApartmentScores({
  apartmentIds = [],
  listId,
  targetStationId,
  enabled = true,
  useDatabase = true,
}: UseApartmentScoresOptions): UseApartmentScoresReturn {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [scoreBreakdowns, setScoreBreakdowns] = useState<Record<string, any>>({});
  const [isCalculating, setIsCalculating] = useState(false);
  const [hasTriggeredCalculation, setHasTriggeredCalculation] = useState(false);
  const [calculationPromise, setCalculationPromise] = useState<Promise<void> | null>(null);

  // Get user preferences
  const { data: userPreferences } = api.user.getPreferences.useQuery(undefined, {
    enabled,
  });

  // Database score fetching
  const { data: dbScores, refetch: refetchDbScores } = api.score.getScores.useQuery(
    { apartmentIds, listId },
    { 
      enabled: enabled && useDatabase && apartmentIds.length > 0,
    }
  );

  // Database score calculation mutation
  const calculateDbScores = api.score.calculateScores.useMutation();

  // Client-side scoring function
  const calculateClientSideScores = useCallback(
    (apartments: ApartmentWithFullRelations[], preferences: UserPreference) => {
      const scorer = TargetedApartmentScorer.fromUserPreferences(preferences, {
        targetStationId,
      });

      const newScores: Record<string, number> = {};
      const newBreakdowns: Record<string, any> = {};

      apartments.forEach(apartment => {
        const scored = scorer.calculateScore(apartment);
        newScores[apartment.id] = scored.score || 0;
        newBreakdowns[apartment.id] = scored.scoreBreakdown;
      });

      setScores(newScores);
      setScoreBreakdowns(newBreakdowns);
    },
    [targetStationId]
  );

  // Calculate scores (either from DB or client-side)
  const calculateScores = useCallback(async () => {
    if (!userPreferences || apartmentIds.length === 0) return;

    // If there's already a calculation in progress, return the existing promise
    if (calculationPromise) {
      return calculationPromise;
    }

    // Create new calculation promise
    const newCalculationPromise = (async () => {
      setIsCalculating(true);
      try {
        if (useDatabase) {
          // Calculate and store in database
          const result = await calculateDbScores.mutateAsync({
            apartmentIds,
            listId,
            targetStationId,
            forceRecalculate: true,
          });

          // Extract scores from result
          const newScores: Record<string, number> = {};

          result.scores.forEach(score => {
            newScores[score.apartmentId] = score.score;
          });

          setScores(newScores);
          // Note: breakdowns are calculated client-side only
          
          // Refetch to ensure we have the latest data
          await refetchDbScores();
        } else {
          // For client-side calculation, we'd need apartment data
          // This is a simplified version - in real use, you'd pass apartments
          console.warn("Client-side calculation requires apartment data");
        }
      } catch (error) {
        console.error("Error calculating scores:", error);
      } finally {
        setIsCalculating(false);
        setCalculationPromise(null);
      }
    })();

    setCalculationPromise(newCalculationPromise);
    return newCalculationPromise;
  }, [userPreferences, apartmentIds, listId, targetStationId, useDatabase, calculateDbScores, refetchDbScores, calculationPromise]);

  // Update scores when DB scores are fetched
  useEffect(() => {
    if (dbScores) {
      // dbScores is already in the format { apartmentId: score }
      setScores(dbScores);
      // Note: breakdowns need to be calculated client-side if needed
    }
  }, [dbScores]);

  // Auto-calculate if no scores exist
  useEffect(() => {
    // Only trigger once per set of apartment IDs
    const shouldCalculate = enabled && 
                          useDatabase && 
                          apartmentIds.length > 0 && 
                          userPreferences && 
                          !isCalculating && 
                          !dbScores && 
                          !hasTriggeredCalculation;
    
    if (shouldCalculate) {
      setHasTriggeredCalculation(true);
      calculateScores();
    }
  }, [enabled, useDatabase, apartmentIds.length, userPreferences, isCalculating, dbScores, hasTriggeredCalculation, calculateScores]);
  
  // Reset trigger flag when apartment IDs change
  useEffect(() => {
    setHasTriggeredCalculation(false);
  }, [apartmentIds.join(',')]); // Reset when apartments change

  return {
    scores,
    scoreBreakdowns,
    isCalculating: isCalculating || calculateDbScores.isPending,
    calculateScores,
    refetch: refetchDbScores,
  };
}

// Hook for client-side scoring (no database)
export function useClientSideScoring(
  apartments: ApartmentWithFullRelations[],
  targetStationId?: string
) {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [scoreBreakdowns, setScoreBreakdowns] = useState<Record<string, any>>({});

  // Get user preferences
  const { data: userPreferences } = api.user.getPreferences.useQuery();

  useEffect(() => {
    if (!userPreferences || apartments.length === 0) return;

    const scorer = TargetedApartmentScorer.fromUserPreferences(userPreferences, {
      targetStationId,
    });

    const newScores: Record<string, number> = {};
    const newBreakdowns: Record<string, any> = {};

    apartments.forEach(apartment => {
      const scored = scorer.calculateScore(apartment);
      newScores[apartment.id] = scored.score || 0;
      newBreakdowns[apartment.id] = scored.scoreBreakdown;
    });

    setScores(newScores);
    setScoreBreakdowns(newBreakdowns);
  }, [apartments, userPreferences, targetStationId]);

  return { scores, scoreBreakdowns };
}