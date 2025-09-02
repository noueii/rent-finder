"use client";

import * as React from "react";
import { ApartmentList } from "./apartment-list";
import { useTargetedApartmentScorer } from "~/hooks/use-targeted-apartment-scorer";
import { useApartmentScores } from "~/hooks/use-apartment-scores";
import type { ApartmentWithRelations } from "~/types";
import { ListManager } from "~/presentation/services";

interface SortedApartmentListProps {
  apartments: ApartmentWithRelations[];
  loading?: boolean;
  onViewApartment?: (apartment: ApartmentWithRelations) => void;
  onLikeApartment?: (apartment: ApartmentWithRelations) => void;
  onBookmarkApartment?: (apartment: ApartmentWithRelations) => void;
  onRemoveFromList?: (apartment: ApartmentWithRelations) => void;
  variant?: "grid" | "list";
  virtualized?: boolean;
  className?: string;
  listId?: string;
  targetStationId?: string;
  showScore?: boolean;
  sortField?: string;
  sortOrder?: "asc" | "desc";
}

export function SortedApartmentList({
  apartments,
  sortField,
  sortOrder = "desc",
  targetStationId,
  showScore = false,
  listId,
  ...props
}: SortedApartmentListProps) {
  const { scoreApartments } = useTargetedApartmentScorer({ targetStationId });
  
  // Get apartment IDs for database scoring
  const apartmentIds = React.useMemo(() => apartments.map(apt => apt.id), [apartments]);
  
  // Use database-backed scoring when available
  const { scores: dbScores, isCalculating } = useApartmentScores({
    apartmentIds,
    listId,
    targetStationId,
    enabled: !!listId, // Always calculate scores if we have a list context
    useDatabase: true,
  });

  // Apply scoring (no client-side sorting - server handles it)
  const sortedApartments = React.useMemo(() => {
    let scoredApartments: ApartmentWithRelations[];
    
    // Always add scores to apartments for display
    if (Object.keys(dbScores).length > 0) {
      // Add scores from database to apartments
      scoredApartments = apartments.map(apt => ({
        ...apt,
        score: dbScores[apt.id] || 0,
      }));
    } else {
      // Fall back to client-side scoring for display only
      scoredApartments = scoreApartments(apartments as any) as ApartmentWithRelations[];
    }
    
    // Apply client-side sorting if requested
    if (sortField) {
      return ListManager.sortApartments(scoredApartments, sortField, sortOrder);
    }
    
    return scoredApartments;
  }, [apartments, scoreApartments, dbScores, sortField, sortOrder]);

  return (
    <ApartmentList
      {...props}
      apartments={sortedApartments}
      targetStationId={targetStationId}
      showScore={showScore}
      listId={listId}
    />
  );
}