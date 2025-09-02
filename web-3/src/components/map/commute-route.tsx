'use client';

import { Polyline, Popup } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import type { Route } from '@prisma/client';

interface CommuteRouteProps {
  route: Route & {
    apartment: {
      latitude: number | null;
      longitude: number | null;
    };
    destinationStation?: {
      latitude: number;
      longitude: number;
      name: string;
    };
  };
  color?: string;
  weight?: number;
  opacity?: number;
}

export function CommuteRoute({ 
  route, 
  color = '#3b82f6', 
  weight = 3, 
  opacity = 0.6 
}: CommuteRouteProps) {
  if (!route.apartment.latitude || !route.apartment.longitude || !route.destinationStation) {
    return null;
  }

  // Parse route data if available
  const routeData = route.routeData as any;
  let positions: LatLngExpression[] = [];

  if (routeData?.legs) {
    // If we have detailed route data from OTP
    positions = routeData.legs.flatMap((leg: any) => {
      if (leg.geometry?.coordinates) {
        return leg.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]] as LatLngExpression);
      }
      return [];
    });
  } else {
    // Simple straight line from apartment to destination
    positions = [
      [route.apartment.latitude, route.apartment.longitude],
      [route.destinationStation.latitude, route.destinationStation.longitude],
    ];
  }

  if (positions.length < 2) {
    return null;
  }

  return (
    <Polyline
      positions={positions}
      pathOptions={{
        color,
        weight,
        opacity,
        dashArray: route.transfers > 0 ? '10, 5' : undefined,
      }}
    >
      <Popup>
        <div className="space-y-2">
          <h3 className="font-semibold">Commute Route</h3>
          <div className="text-sm space-y-1">
            <p>To: {route.destinationStation.name}</p>
            <p>Duration: <span className="font-medium">{route.duration} minutes</span></p>
            <p>Transfers: <span className="font-medium">{route.transfers}</span></p>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span>Walk: {route.walkTime}min</span>
              <span>Train: {route.trainTime}min</span>
            </div>
          </div>
        </div>
      </Popup>
    </Polyline>
  );
}