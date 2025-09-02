'use client';

import { CircleMarker, Popup, Tooltip } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import type { Station } from '@prisma/client';
import { Train } from 'lucide-react';

interface StationMarkerProps {
  station: Station;
  isDestination?: boolean;
  walkingMinutes?: number;
  onClick?: (station: Station) => void;
}

export function StationMarker({ station, isDestination, walkingMinutes, onClick }: StationMarkerProps) {
  const position: LatLngExpression = [station.latitude, station.longitude];
  
  const color = isDestination ? '#dc2626' : '#3b82f6';
  const radius = isDestination ? 10 : 6;

  return (
    <CircleMarker
      center={position}
      radius={radius}
      pathOptions={{
        fillColor: color,
        color: 'white',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8,
      }}
      eventHandlers={{
        click: () => onClick?.(station),
      }}
    >
      <Tooltip direction="top" offset={[0, -10]} opacity={0.9}>
        <div className="flex items-center gap-1">
          <Train size={14} />
          <span className="font-medium">{station.name}</span>
          {walkingMinutes && (
            <span className="text-xs text-muted-foreground ml-1">
              ({walkingMinutes}分)
            </span>
          )}
        </div>
      </Tooltip>
      <Popup>
        <div className="space-y-2">
          <h3 className="font-semibold flex items-center gap-1">
            <Train size={16} />
            {station.name}
          </h3>
          {station.nameEn && (
            <p className="text-sm text-muted-foreground">{station.nameEn}</p>
          )}
          {walkingMinutes && (
            <p className="text-sm">
              Walking distance: <span className="font-medium">{walkingMinutes} minutes</span>
            </p>
          )}
        </div>
      </Popup>
    </CircleMarker>
  );
}