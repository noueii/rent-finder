"use client";

import { MatchScore } from "~/presentation/components/ui";

interface MatchScoreBadgeProps {
  score: number;
  className?: string;
  showIcon?: boolean;
}

export function MatchScoreBadge({ score, className, showIcon = false }: MatchScoreBadgeProps) {
  return (
    <MatchScore
      value={score}
      label="match"
      variant="badge"
      size="md"
      className={className}
    />
  );
}