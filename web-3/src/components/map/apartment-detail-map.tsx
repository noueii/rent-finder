'use client';

import { useState, useRef, useEffect } from 'react';
import L from 'leaflet';
import { Map } from './map';
import type { MapRef } from './map';
import { ApartmentMarker } from './apartment-marker';
import { StationMarker } from './station-marker';
import { Polyline, CircleMarker } from 'react-leaflet';
import type { ApartmentWithRelations } from '~/types/apartment';
import { Button } from '~/components/ui/button';
import { Navigation, Train, MapPin } from 'lucide-react';
import { cn } from '~/lib/utils';

interface ApartmentDetailMapProps {
  apartment: ApartmentWithRelations;
  className?: string;
  height?: string;
}

export function ApartmentDetailMap({ 
  apartment, 
  className,
  height = "h-[400px]"
}: ApartmentDetailMapProps) {
  const [showWalkingRadius, setShowWalkingRadius] = useState(false);
  const mapRef = useRef<MapRef>(null);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !apartment.latitude || !apartment.longitude) return;

    // Fit bounds to show apartment and nearby stations
    const bounds = L.latLngBounds([[apartment.latitude, apartment.longitude]]);
    
    apartment.nearestStations.forEach((as) => {
      bounds.extend([as.station.latitude, as.station.longitude]);
    });

    map.fitBounds(bounds, { padding: [50, 50] });
  }, [apartment]);

  if (!apartment.latitude || !apartment.longitude) {
    return (
      <div className={cn("flex items-center justify-center bg-muted rounded-lg", height, className)}>
        <div className="text-center space-y-2">
          <MapPin className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Location data not available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative rounded-lg overflow-hidden border", height, className)}>
      <Map
        ref={mapRef}
        center={[apartment.latitude!, apartment.longitude!]}
        zoom={15}
      >
        {/* Apartment marker */}
        <ApartmentMarker apartment={apartment} isSelected />

        {/* Walking radius circles */}
        {showWalkingRadius && (
          <>
            {/* 5-minute walking radius (~400m) */}
            <CircleMarker
              center={[apartment.latitude!, apartment.longitude!]}
              radius={400}
              pathOptions={{
                color: '#10b981',
                fillColor: '#10b981',
                fillOpacity: 0.1,
                weight: 2,
                dashArray: '5, 5',
              }}
            />
            {/* 10-minute walking radius (~800m) */}
            <CircleMarker
              center={[apartment.latitude!, apartment.longitude!]}
              radius={800}
              pathOptions={{
                color: '#f59e0b',
                fillColor: '#f59e0b',
                fillOpacity: 0.1,
                weight: 2,
                dashArray: '5, 5',
              }}
            />
          </>
        )}

        {/* Nearby stations */}
        {apartment.nearestStations.map((as) => (
          <StationMarker
            key={as.station.id}
            station={as.station}
            walkingMinutes={as.walkingMinutes}
          />
        ))}

        {/* Walking paths to stations */}
        {apartment.nearestStations.map((as) => (
          <Polyline
            key={`path-${as.station.id}`}
            positions={[
              [apartment.latitude!, apartment.longitude!],
              [as.station.latitude, as.station.longitude],
            ]}
            pathOptions={{
              color: '#6b7280',
              weight: 2,
              opacity: 0.5,
              dashArray: '5, 10',
            }}
          />
        ))}
      </Map>

      {/* Map controls */}
      <div className="absolute top-4 right-4 z-10 space-y-2">
        <Button
          variant={showWalkingRadius ? "default" : "secondary"}
          size="sm"
          onClick={() => setShowWalkingRadius(!showWalkingRadius)}
          className="bg-background/90 backdrop-blur-sm"
        >
          <Navigation size={16} className="mr-1" />
          Walking Radius
        </Button>
      </div>

      {/* Location info overlay */}
      <div className="absolute bottom-4 left-4 z-10">
        <div className="bg-background/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border">
          <h4 className="font-medium text-sm mb-2 flex items-center gap-1">
            <Train size={14} />
            Nearby Stations
          </h4>
          <div className="space-y-1">
            {apartment.nearestStations.slice(0, 3).map((as) => (
              <div key={as.station.id} className="text-xs flex items-center gap-2">
                <span className="font-medium">{as.station.name}</span>
                <span className="text-muted-foreground">{as.walkingMinutes}分</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}