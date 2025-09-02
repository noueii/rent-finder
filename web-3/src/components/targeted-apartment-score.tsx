"use client";

import { Score } from "~/presentation/components/ui";
import { Progress } from "~/components/ui/progress";
import { TargetedApartmentScorer } from "~/lib/scoring/targeted-apartment-scorer";
import type { TargetedScoreBreakdown } from "~/lib/scoring/targeted-apartment-scorer";
import { Clock, DollarSign, Home, Calendar, Building2, Footprints } from "lucide-react";

interface TargetedApartmentScoreProps {
  score: number;
  breakdown?: TargetedScoreBreakdown;
  showDetails?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function TargetedApartmentScore({ 
  score, 
  breakdown, 
  showDetails = true,
  size = "md",
  className 
}: TargetedApartmentScoreProps) {
  const colorClass = TargetedApartmentScorer.getScoreColorClass(score);
  const variant = TargetedApartmentScorer.getScoreBadgeVariant(score);
  
  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base"
  };

  const iconSize = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5"
  };

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
        <h4 className="font-semibold">Match Score Details</h4>
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
                    <span>Commute Time</span>
                  </div>
                  <span className="font-medium">
                    {breakdown.weighted.commuteTime.toFixed(1)}%
                  </span>
                </div>
                <Progress value={breakdown.commuteTime} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {breakdown.explanations.commuteTime}
                </p>
              </div>
            )}

            {/* Price */}
            {breakdown.weighted.price > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span>Price</span>
                  </div>
                  <span className="font-medium">
                    {breakdown.weighted.price.toFixed(1)}%
                  </span>
                </div>
                <Progress value={breakdown.price} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {breakdown.explanations.price}
                </p>
              </div>
            )}

            {/* Size */}
            {breakdown.weighted.size > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Home className="h-4 w-4 text-muted-foreground" />
                    <span>Size</span>
                  </div>
                  <span className="font-medium">
                    {breakdown.weighted.size.toFixed(1)}%
                  </span>
                </div>
                <Progress value={breakdown.size} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {breakdown.explanations.size}
                </p>
              </div>
            )}

            {/* Building Age */}
            {breakdown.weighted.age > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>Building Age</span>
                  </div>
                  <span className="font-medium">
                    {breakdown.weighted.age.toFixed(1)}%
                  </span>
                </div>
                <Progress value={breakdown.age} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {breakdown.explanations.age}
                </p>
              </div>
            )}

            {/* Floor */}
            {breakdown.weighted.floor > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>Floor Level</span>
                  </div>
                  <span className="font-medium">
                    {breakdown.weighted.floor.toFixed(1)}%
                  </span>
                </div>
                <Progress value={breakdown.floor} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {breakdown.explanations.floor}
                </p>
              </div>
            )}

            {/* Walking Time */}
            {breakdown.weighted.walkTime > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Footprints className="h-4 w-4 text-muted-foreground" />
                    <span>Station Walk</span>
                  </div>
                  <span className="font-medium">
                    {breakdown.weighted.walkTime.toFixed(1)}%
                  </span>
                </div>
                <Progress value={breakdown.walkTime} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {breakdown.explanations.walkTime}
                </p>
              </div>
            )}
          </div>

      <div className="border-t pt-3">
        <p className="text-xs text-muted-foreground">
          Score based on how well this apartment matches your target preferences
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