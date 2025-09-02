"use client";

import { api } from "~/trpc/react";
import { Badge } from "~/presentation/components/ui";

interface StationBadgeProps {
  stationId: string;
  onRemove?: () => void;
  variant?: "default" | "secondary" | "outline" | "destructive";
}

export function StationBadge({ stationId, onRemove, variant = "secondary" }: StationBadgeProps) {
  const { data: station } = api.station.getById.useQuery(
    { id: stationId },
    { enabled: !!stationId }
  );

  return (
    <Badge 
      variant={variant}
      removable={!!onRemove}
      onRemove={onRemove}
    >
      {station ? `${station.nameEn || station.name}` : stationId}
    </Badge>
  );
}