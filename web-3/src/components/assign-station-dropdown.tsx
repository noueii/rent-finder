"use client";

import React from "react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Badge } from "~/components/ui/badge";
import { MapPin, Navigation, X } from "lucide-react";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import type { Station } from "@prisma/client";

interface AssignStationDropdownProps {
  apartmentId: string;
  currentPreferredStation?: Station | null;
  nearestStations?: Array<{
    station: Station;
    walkingMinutes: number;
  }>;
  routes?: Array<{
    toStation: Station;
    duration: number;
  }>;
  onUpdate?: () => void;
}

export function AssignStationDropdown({
  apartmentId,
  currentPreferredStation,
  nearestStations = [],
  routes = [],
  onUpdate,
}: AssignStationDropdownProps) {
  const updateStationMutation = api.apartment.updatePreferredStation.useMutation({
    onSuccess: () => {
      toast.success("Preferred station updated");
      onUpdate?.();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update preferred station");
    },
  });

  const handleSelectStation = (stationId: string | null) => {
    updateStationMutation.mutate({
      id: apartmentId,
      stationId,
    });
  };

  // Get unique stations from both nearest stations and routes
  const allStations = React.useMemo(() => {
    const stationMap = new Map<string, { station: Station; source: string; minutes?: number }>();
    
    // Add nearest stations
    nearestStations.forEach(({ station, walkingMinutes }) => {
      stationMap.set(station.id, {
        station,
        source: 'nearest',
        minutes: walkingMinutes,
      });
    });
    
    // Add route destinations
    routes.forEach(({ toStation, duration }) => {
      if (!stationMap.has(toStation.id)) {
        stationMap.set(toStation.id, {
          station: toStation,
          source: 'route',
          minutes: duration,
        });
      }
    });
    
    return Array.from(stationMap.values());
  }, [nearestStations, routes]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Navigation className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Assign Navigation Station</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {currentPreferredStation && (
          <>
            <div className="px-2 py-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Current:</span>
                <Badge variant="secondary">{currentPreferredStation.name}</Badge>
              </div>
            </div>
            <DropdownMenuItem
              onClick={() => handleSelectStation(null)}
              className="text-destructive"
            >
              <X className="mr-2 h-4 w-4" />
              Remove Preferred Station
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        
        {allStations.length === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
            No stations available
          </div>
        ) : (
          <>
            {nearestStations.length > 0 && (
              <>
                <DropdownMenuLabel className="text-xs">Nearby Stations</DropdownMenuLabel>
                {nearestStations.map(({ station, walkingMinutes }) => (
                  <DropdownMenuItem
                    key={station.id}
                    onClick={() => handleSelectStation(station.id)}
                    disabled={currentPreferredStation?.id === station.id}
                  >
                    <MapPin className="mr-2 h-4 w-4" />
                    <span className="flex-1">{station.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {walkingMinutes} min walk
                    </span>
                  </DropdownMenuItem>
                ))}
              </>
            )}
            
            {routes.length > 0 && (
              <>
                {nearestStations.length > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel className="text-xs">Route Destinations</DropdownMenuLabel>
                {routes
                  .filter(({ toStation }) => 
                    !nearestStations.some(ns => ns.station.id === toStation.id)
                  )
                  .map(({ toStation, duration }) => (
                    <DropdownMenuItem
                      key={toStation.id}
                      onClick={() => handleSelectStation(toStation.id)}
                      disabled={currentPreferredStation?.id === toStation.id}
                    >
                      <Navigation className="mr-2 h-4 w-4" />
                      <span className="flex-1">{toStation.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {duration} min total
                      </span>
                    </DropdownMenuItem>
                  ))}
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}