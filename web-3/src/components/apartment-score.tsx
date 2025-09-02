"use client";

import { Score } from "~/presentation/components/ui";
import { Progress } from "~/components/ui/progress";
import { ApartmentScorer } from "~/lib/scoring/apartment-scorer";
import type { ScoreBreakdown } from "~/lib/scoring/apartment-scorer";
import { Clock, DollarSign, Home, Calendar } from "lucide-react";
import { ScoreFormatter } from "~/presentation/services";

interface ApartmentScoreProps {
  score: number;
  breakdown?: ScoreBreakdown;
  showDetails?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ApartmentScore({ 
  score, 
  breakdown, 
  showDetails = true,
  size = "md",
  className 
}: ApartmentScoreProps) {
  if (!showDetails || !breakdown) {
    return (
      <Score
        value={score}
        variant="badge"
        size={size}
        colorScale="performance"
        className={className}
      />
    );
  }

  const breakdownContent = (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">Apartment Score</h4>
        <Score
          value={score}
          variant="badge"
          size="lg"
          colorScale="performance"
        />
      </div>
      
      <div className="space-y-3">
        {/* Commute Time */}
        {breakdown.weighted.commuteTime > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{ScoreFormatter.getComponentLabel("commuteTime")}</span>
              </div>
              <span className="font-medium">
                {ScoreFormatter.formatPoints(breakdown.weighted.commuteTime)}
              </span>
            </div>
            <Progress value={breakdown.commuteTime} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {ScoreFormatter.getComponentDescription("commuteTime", breakdown.commuteTime)}
            </p>
          </div>
        )}

        {/* Price */}
        {breakdown.weighted.price > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span>{ScoreFormatter.getComponentLabel("price")}</span>
              </div>
              <span className="font-medium">
                {ScoreFormatter.formatPoints(breakdown.weighted.price)}
              </span>
            </div>
            <Progress value={breakdown.price} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {ScoreFormatter.getComponentDescription("price", breakdown.price)}
            </p>
          </div>
        )}

        {/* Size */}
        {breakdown.weighted.size > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Home className="h-4 w-4 text-muted-foreground" />
                <span>{ScoreFormatter.getComponentLabel("size")}</span>
              </div>
              <span className="font-medium">
                {ScoreFormatter.formatPoints(breakdown.weighted.size)}
              </span>
            </div>
            <Progress value={breakdown.size} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {ScoreFormatter.getComponentDescription("size", breakdown.size)}
            </p>
          </div>
        )}

        {/* Building Age */}
        {breakdown.weighted.age > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{ScoreFormatter.getComponentLabel("age")}</span>
              </div>
              <span className="font-medium">
                {ScoreFormatter.formatPoints(breakdown.weighted.age)}
              </span>
            </div>
            <Progress value={breakdown.age} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {ScoreFormatter.getComponentDescription("age", breakdown.age)}
            </p>
          </div>
        )}
      </div>

      <div className="border-t pt-3">
        <p className="text-xs text-muted-foreground">
          Score based on your personal preferences
        </p>
      </div>
    </div>
  );

  return (
    <Score
      value={score}
      variant="badge"
      size={size}
      showDetails={true}
      colorScale="performance"
      className={className}
    >
      {breakdownContent}
    </Score>
  );
}