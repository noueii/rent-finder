/**
 * ApartmentScore Component
 * Displays apartment match score with visual indicators
 */

import * as React from "react";
import { MatchScoreBadge } from "~/components/match-score-badge";
import { useTargetedApartmentScorer } from "~/hooks/use-targeted-apartment-scorer";
import type { ApartmentWithRelations } from "~/types";

interface ApartmentScoreProps {
  apartment: ApartmentWithRelations;
  targetStationId?: string;
  className?: string;
}

export function ApartmentScore({
  apartment,
  targetStationId,
  className
}: ApartmentScoreProps) {
  const { scoreApartment } = useTargetedApartmentScorer({ targetStationId });
  
  const scoredApartment = React.useMemo(() => {
    return scoreApartment(apartment);
  }, [apartment, scoreApartment]);

  if (scoredApartment?.score === undefined) {
    return null;
  }

  return (
    <div className={`flex items-center justify-between p-2 rounded-md bg-primary/5 ${className}`}>
      <span className="text-sm font-medium">Match Score</span>
      <MatchScoreBadge score={scoredApartment.score} />
    </div>
  );
}