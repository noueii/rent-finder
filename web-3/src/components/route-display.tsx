"use client";

import { Train, Clock, Footprints, RefreshCw, MapPin, ArrowRight } from "lucide-react";
import { cn } from "~/lib/utils";
import type { Route, Station } from "@prisma/client";

interface RouteLeg {
  mode: 'WALK' | 'TRANSIT';
  from: {
    name: string;
    lat: number;
    lon: number;
  };
  to: {
    name: string;
    lat: number;
    lon: number;
  };
  duration: number; // in seconds
  distance?: number;
  route?: {
    id: string;
    shortName: string;
    longName: string;
    type: string;
  };
}

interface RouteDisplayProps {
  route: Route & {
    toStation: Station;
  };
  className?: string;
  variant?: "compact" | "detailed";
  highlighted?: boolean;
}

// Define some common train line colors
const LINE_COLORS: Record<string, string> = {
  "JR Yamanote Line": "#9ACD32",
  "JR Chuo Line": "#FFA500",
  "JR Keihin-Tohoku Line": "#00BFFF",
  "JR Sobu Line": "#FFD700",
  "JR Saikyo Line": "#00AC9A",
  "JR Yokosuka Line": "#0072BC",
  "JR Tokaido Line": "#FF8C00",
  "Tokyo Metro Ginza Line": "#FF8C00",
  "Tokyo Metro Marunouchi Line": "#DC143C",
  "Tokyo Metro Hibiya Line": "#708090",
  "Tokyo Metro Tozai Line": "#1E90FF",
  "Tokyo Metro Chiyoda Line": "#228B22",
  "Tokyo Metro Yurakucho Line": "#FFD700",
  "Tokyo Metro Hanzomon Line": "#9370DB",
  "Tokyo Metro Namboku Line": "#00CED1",
  "Tokyo Metro Fukutoshin Line": "#8B4513",
  "Toei Asakusa Line": "#FF69B4",
  "Toei Mita Line": "#0000FF",
  "Toei Shinjuku Line": "#32CD32",
  "Toei Oedo Line": "#FF1493",
  "Keio": "#FF69B4",
  "Odakyu": "#0066CC",
  "Tokyu": "#DA0442",
  "Tobu": "#0052A4",
  "Seibu": "#0066CC",
};

export function RouteDisplay({ 
  route, 
  className, 
  variant = "compact",
  highlighted = false 
}: RouteDisplayProps) {
  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const formatDurationSeconds = (seconds: number) => {
    return formatDuration(Math.round(seconds / 60));
  };

  // Get the station name in English if available
  const stationName = route.toStation.nameEn || route.toStation.name;
  
  // Parse route data if available
  const routeData = route.routeData as { legs?: RouteLeg[] } | null;
  const legs = routeData?.legs || [];
  
  // Get line color from route data or destination station
  const getLineColor = (lineName?: string) => {
    if (!lineName) return undefined;
    // Check exact match first
    if (LINE_COLORS[lineName]) return LINE_COLORS[lineName];
    // Check partial matches
    for (const [key, color] of Object.entries(LINE_COLORS)) {
      if (lineName.includes(key) || key.includes(lineName)) {
        return color;
      }
    }
    return undefined;
  };

  if (variant === "compact") {
    return (
      <div 
        className={cn(
          "rounded-lg border",
          highlighted ? "bg-primary/5 border-primary/20" : "bg-card border-border",
          className
        )}
      >
        {/* Header with route name and total time */}
        <div className="flex items-center justify-between p-4 pb-3">
          <div className="flex items-center gap-2">
            <Train className="h-5 w-5" />
            <span className="font-medium">Route to {stationName}</span>
          </div>
          <span className="text-lg font-bold bg-foreground text-background px-3 py-1 rounded-full">
            {formatDuration(route.duration)} total
          </span>
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-center gap-8 px-4 pb-4">
          <div className="flex items-center gap-3 text-sm">
            <div className="flex flex-col items-center p-3 bg-muted/50 rounded-lg">
              <Clock className="h-4 w-4 mb-1 text-muted-foreground" />
              <span className="font-medium">{formatDuration(route.duration)}</span>
              <span className="text-xs text-muted-foreground">Total Time</span>
            </div>
            <div className="flex flex-col items-center p-3 bg-muted/50 rounded-lg">
              <RefreshCw className="h-4 w-4 mb-1 text-muted-foreground" />
              <span className="font-medium">{route.transfers}</span>
              <span className="text-xs text-muted-foreground">Transfers</span>
            </div>
            <div className="flex flex-col items-center p-3 bg-muted/50 rounded-lg">
              <Footprints className="h-4 w-4 mb-1 text-muted-foreground" />
              <span className="font-medium">{route.walkTime} min</span>
              <span className="text-xs text-muted-foreground">Walking</span>
            </div>
          </div>
        </div>

        {/* Show detailed route legs if available */}
        {legs.length > 0 && (
          <div className="px-4 pb-3">
            <div className="text-xs text-muted-foreground mb-2">Route details:</div>
            <div className="space-y-1">
              {legs.map((leg, index) => {
                const isWalk = leg.mode === 'WALK';
                const lineColor = !isWalk && leg.route ? getLineColor(leg.route.longName || leg.route.shortName) : undefined;
                
                return (
                  <div key={index} className="flex items-center gap-2 text-xs">
                    {isWalk ? (
                      <Footprints className="h-3 w-3 text-muted-foreground" />
                    ) : (
                      <>
                        {lineColor && (
                          <div 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: lineColor }}
                          />
                        )}
                        <Train className="h-3 w-3 text-primary" />
                      </>
                    )}
                    <span className="flex-1 truncate">
                      {isWalk 
                        ? `Walk ${formatDurationSeconds(leg.duration)} to ${leg.to.name}`
                        : `${leg.route?.shortName || 'Train'} to ${leg.to.name}`
                      }
                    </span>
                    <span className="text-muted-foreground">
                      {formatDurationSeconds(leg.duration)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Detailed variant
  return (
    <div 
      className={cn(
        "space-y-4 p-4 rounded-lg border",
        highlighted ? "bg-primary/5 border-primary/20" : "bg-card border-border",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <h4 className="font-medium flex items-center gap-2">
          <Train className="h-5 w-5" />
          Route to {stationName}
        </h4>
        <span className="text-lg font-bold">{formatDuration(route.duration)} total</span>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-3 bg-muted/50 rounded-lg">
          <Clock className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
          <div className="font-medium">{formatDuration(route.duration)}</div>
          <div className="text-xs text-muted-foreground">Total Time</div>
        </div>
        <div className="text-center p-3 bg-muted/50 rounded-lg">
          <RefreshCw className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
          <div className="font-medium">{route.transfers}</div>
          <div className="text-xs text-muted-foreground">Transfer{route.transfers !== 1 ? 's' : ''}</div>
        </div>
        <div className="text-center p-3 bg-muted/50 rounded-lg">
          <Footprints className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
          <div className="font-medium">{route.walkTime} min</div>
          <div className="text-xs text-muted-foreground">Walking</div>
        </div>
      </div>

      {/* Journey breakdown */}
      <div className="space-y-3 pt-3 border-t">
        {legs.length > 0 ? (
          // Show detailed legs from route data
          <>
            {legs.map((leg, index) => {
              const isWalk = leg.mode === 'WALK';
              const isLastLeg = index === legs.length - 1;
              const lineColor = !isWalk && leg.route ? getLineColor(leg.route.longName || leg.route.shortName) : undefined;
              
              return (
                <div key={index}>
                  <div className="flex items-start gap-3">
                    {isWalk ? (
                      <Footprints className="h-4 w-4 text-muted-foreground mt-0.5" />
                    ) : (
                      <div className="flex items-center gap-2">
                        {lineColor && (
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: lineColor }}
                          />
                        )}
                        <Train className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div className="flex-1">
                      {isWalk ? (
                        <>
                          <div className="text-sm font-medium">
                            Walk {formatDurationSeconds(leg.duration)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {leg.from.name} → {leg.to.name}
                            {leg.distance && ` (${Math.round(leg.distance)}m)`}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-sm font-medium">
                            {leg.route?.longName || leg.route?.shortName || 'Train'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {leg.from.name} → {leg.to.name} • {formatDurationSeconds(leg.duration)}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Show transfer indicator between legs */}
                  {!isLastLeg && !isWalk && legs[index + 1]?.mode === 'TRANSIT' && (
                    <div className="flex items-center gap-3 ml-7 mt-2 mb-2">
                      <RefreshCw className="h-3 w-3 text-amber-600" />
                      <span className="text-xs text-amber-600">Transfer</span>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        ) : (
          // Fallback to simple display
          <>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-muted-foreground mt-1.5" />
              <div className="flex-1">
                <div className="text-sm font-medium">Start</div>
                <div className="text-sm text-muted-foreground">
                  Walk {route.walkTime} min to nearest station
                </div>
              </div>
            </div>
            
            <div className="flex items-start gap-2">
              <Train className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium">Train Journey</div>
                <div className="text-sm text-muted-foreground">
                  {route.trainTime} min • {route.transfers} transfer{route.transfers !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
              <div className="flex-1">
                <div className="text-sm font-medium">{stationName}</div>
                <div className="text-sm text-muted-foreground">Destination</div>
              </div>
            </div>
          </>
        )}
      </div>

    </div>
  );
}