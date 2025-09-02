'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import L from 'leaflet';
import { Map } from './map';
import type { MapRef } from './map';
import { ApartmentMarker } from './apartment-marker';
import { ApartmentCluster } from './apartment-cluster';
import { StationMarker } from './station-marker';
import { CommuteRoute } from './commute-route';
import type { ApartmentWithRelations } from '~/types/apartment';
import type { Station, Route } from '@prisma/client';
import { Loader2, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';

interface SearchResultsMapProps {
  apartments: ApartmentWithRelations[];
  selectedApartment?: ApartmentWithRelations;
  destinationStation?: Station;
  showStations?: boolean;
  showRoutes?: boolean;
  useClustering?: boolean;
  className?: string;
  onApartmentClick?: (apartment: ApartmentWithRelations) => void;
  routes?: (Route & { apartment: { latitude: number | null; longitude: number | null } })[];
}

export function SearchResultsMap({
  apartments,
  selectedApartment,
  destinationStation,
  showStations = true,
  showRoutes = false,
  useClustering = true,
  className,
  onApartmentClick,
  routes = [],
}: SearchResultsMapProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const mapRef = useRef<MapRef>(null);

  // Filter apartments with valid coordinates
  const validApartments = apartments.filter(apt => apt.latitude && apt.longitude);

  // Calculate bounds to fit all markers
  const fitBounds = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map || validApartments.length === 0) return;

    const bounds = L.latLngBounds(
      validApartments.map(apt => [apt.latitude!, apt.longitude!] as [number, number])
    );

    if (destinationStation) {
      bounds.extend([destinationStation.latitude, destinationStation.longitude]);
    }

    map.fitBounds(bounds, { padding: [50, 50] });
  }, [validApartments, destinationStation]);

  useEffect(() => {
    if (!isLoading) {
      fitBounds();
    }
  }, [isLoading, fitBounds]);

  const handleFullscreenToggle = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (validApartments.length === 0) {
    return (
      <div className={cn("flex items-center justify-center bg-muted rounded-lg", className)}>
        <p className="text-muted-foreground">No apartments with location data to display</p>
      </div>
    );
  }

  return (
    <motion.div
      className={cn(
        "relative rounded-lg overflow-hidden border bg-background",
        isFullscreen && "fixed inset-4 z-50",
        className
      )}
      layout
    >
      {isLoading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-20 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      )}

      <Map
        ref={mapRef}
        center={[35.6762, 139.6503]} // Tokyo center
        zoom={12}
        onMapReady={() => setIsLoading(false)}
      >
        {/* Commute routes */}
        {showRoutes && routes.map((route) => {
          const destStation = destinationStation || undefined;
          return (
            <CommuteRoute
              key={route.id}
              route={{
                ...route,
                destinationStation: destStation ? {
                  latitude: destStation.latitude,
                  longitude: destStation.longitude,
                  name: destStation.name,
                } : undefined,
              }}
            />
          );
        })}

        {/* Apartment markers */}
        {useClustering && validApartments.length > 20 ? (
          <ApartmentCluster
            apartments={validApartments}
            onMarkerClick={onApartmentClick}
          />
        ) : (
          validApartments.map((apartment) => (
            <ApartmentMarker
              key={apartment.id}
              apartment={apartment}
              isSelected={selectedApartment?.id === apartment.id}
              onClick={onApartmentClick}
            />
          ))
        )}

        {/* Station markers */}
        {showStations && (
          <>
            {/* Nearest stations for apartments */}
            {validApartments.flatMap((apartment) =>
              apartment.nearestStations.map((as) => (
                <StationMarker
                  key={`${apartment.id}-${as.station.id}`}
                  station={as.station}
                  walkingMinutes={as.walkingMinutes}
                />
              ))
            )}

            {/* Destination station */}
            {destinationStation && (
              <StationMarker
                station={destinationStation}
                isDestination
              />
            )}
          </>
        )}
      </Map>

      {/* Map controls */}
      <div className="absolute top-4 right-4 z-10 space-y-2">
        <Button
          variant="secondary"
          size="icon"
          onClick={handleFullscreenToggle}
          className="bg-background/90 backdrop-blur-sm"
        >
          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </Button>
      </div>

      {/* Selected apartment info */}
      {selectedApartment && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-4 left-4 right-4 z-10"
        >
          <div className="bg-background/95 backdrop-blur-sm rounded-lg p-4 shadow-lg border">
            <h3 className="font-semibold mb-1">{selectedApartment.title}</h3>
            <p className="text-sm text-muted-foreground">{selectedApartment.address}</p>
            <div className="flex items-center gap-4 mt-2 text-sm">
              <span className="font-medium">¥{selectedApartment.price.toLocaleString()}/月</span>
              <span>{selectedApartment.size}㎡</span>
              {selectedApartment.layout && <span>{selectedApartment.layout}</span>}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}