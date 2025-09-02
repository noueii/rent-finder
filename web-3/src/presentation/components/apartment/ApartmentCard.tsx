/**
 * ApartmentCard Component
 * Main card component that composes all apartment sub-components
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardFooter, CardHeader, ColorBadge } from "~/presentation/components/ui";
import { 
  MapPin, 
  Train, 
  Clock 
} from "lucide-react";
import { cn } from "~/lib/utils";
import type { ApartmentWithRelations } from "~/types";
import { ApartmentImages } from "./ApartmentImages";
import { ApartmentPrice } from "./ApartmentPrice";
import { ApartmentScore } from "./ApartmentScore";
import { ApartmentActions } from "./ApartmentActions";
import { buildApartmentDetailUrl } from "~/presentation/services/navigation-builder";
import { getApartmentMapsUrl } from "~/lib/maps";

interface ApartmentCardProps {
  apartment: ApartmentWithRelations;
  onView?: () => void;
  onLike?: () => void;
  onDislike?: () => void;
  onBookmark?: () => void;
  onRemoveFromList?: () => void;
  variant?: "default" | "browse" | "compact";
  className?: string;
  animate?: boolean;
  listId?: string;
  targetStationId?: string;
  showScore?: boolean;
}

// Helper function to get commute time color
function getCommuteTimeColor(minutes: number): string {
  if (minutes <= 10) return "text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400";
  if (minutes <= 30) return "text-yellow-600 bg-yellow-50 dark:bg-yellow-950 dark:text-yellow-400";
  if (minutes <= 45) return "text-orange-600 bg-orange-50 dark:bg-orange-950 dark:text-orange-400";
  return "text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-400";
}

export function ApartmentCard({
  apartment,
  onView,
  onLike,
  onDislike,
  onBookmark,
  onRemoveFromList,
  variant = "default",
  className,
  animate = true,
  listId,
  targetStationId,
  showScore = false,
}: ApartmentCardProps) {
  const primaryStation = apartment.nearestStations?.[0];
  const detailUrl = buildApartmentDetailUrl(apartment.id, { targetStationId, listId });
  
  const MotionCard = animate ? motion.create(Card) : Card;

  const handleAddressClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const url = getApartmentMapsUrl(apartment);
    window.open(url, '_blank');
  }, [apartment]);

  const cardContent = (
    <div className="flex flex-col">
      <CardHeader className="p-0 flex-none h-[240px]">
        <div className="relative h-full w-full">
          <ApartmentImages
            images={apartment.images.map(img => ({ url: img.url, caption: img.caption || undefined })) || []}
            title={apartment.title}
            className="h-full w-full"
          />
          
          {/* Price Badge */}
          <div className="absolute left-4 bottom-4">
            <ApartmentPrice apartment={apartment} showBadge />
          </div>
          
          {/* Action Buttons */}
          <ApartmentActions
            apartment={apartment}
            variant="overlay"
            listId={listId}
            onRemoveFromList={onRemoveFromList}
            className="absolute right-4 bottom-4 z-20"
          />
        </div>
      </CardHeader>

      <Link href={detailUrl} target="_blank" rel="noopener noreferrer" className="block flex-1 min-h-0 overflow-hidden">
        <CardContent className="p-4 space-y-3 h-full overflow-y-auto">
          {/* Title and Address */}
          <div>
            <h3 className="text-lg font-semibold line-clamp-1">
              {apartment.title}
            </h3>
            <div>
              <button
                onClick={handleAddressClick}
                className="group flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <span className="line-clamp-1">{apartment.address}</span>
                <MapPin className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
              {(apartment as any).preferredStation && (
                <div className="flex items-center gap-1 text-xs text-primary mt-0.5">
                  <MapPin className="h-3 w-3" />
                  <span>Navigation to: {(apartment as any).preferredStation.name}</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Apartment Score */}
          {showScore && (
            <ApartmentScore 
              apartment={apartment} 
              targetStationId={targetStationId} 
            />
          )}
          
          {/* 2-Year Cost */}
          <ApartmentPrice apartment={apartment} showBreakdown />

          {/* Property Details Grid */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Layout:</span>
              <span className="font-medium">{apartment.layout || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Size:</span>
              <span className="font-medium">{apartment.size}m²</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Floor:</span>
              <span className="font-medium">
                {apartment.floor || 'N/A'}/{apartment.totalFloors || 'N/A'}F
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Age:</span>
              <span className="font-medium">
                {apartment.buildingAge ? `${apartment.buildingAge}y` : 'N/A'}
              </span>
            </div>
          </div>

          {/* Commute Time */}
          {(apartment as any).routes && (apartment as any).routes.length > 0 && (
            <div className={cn(
              "rounded-lg p-3",
              getCommuteTimeColor((apartment as any).routes[0].duration)
            )}>
              <div className="flex items-center justify-between text-sm font-medium">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{(apartment as any).routes[0].duration} min</span>
                </div>
                <div className="flex items-center gap-2">
                  <Train className="h-4 w-4" />
                  <span>{(apartment as any).routes[0].transfers} transfer{(apartment as any).routes[0].transfers !== 1 ? 's' : ''}</span>
                </div>
              </div>
              {(apartment as any).routes[0].toStation && (
                <div className="text-xs mt-1 opacity-80">
                  to {(apartment as any).routes[0].toStation.name}
                </div>
              )}
            </div>
          )}

          {/* Station Info */}
          {primaryStation && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="font-medium">{primaryStation.station.name}</span>
              <ColorBadge color="blue" size="sm">
                {primaryStation.walkingMinutes}min walk
              </ColorBadge>
            </div>
          )}
        </CardContent>
      </Link>

      {/* Footer Actions */}
      {variant !== "compact" && (
        <CardFooter className="flex-none p-4 pt-0 border-t">
          <ApartmentActions
            apartment={apartment}
            variant={variant}
            listId={listId}
            targetStationId={targetStationId}
            onView={onView}
            onLike={onLike}
            onDislike={onDislike}
            onBookmark={onBookmark}
            className="w-full"
          />
        </CardFooter>
      )}
    </div>
  );

  if (animate) {
    return (
      <MotionCard
        className={cn("overflow-hidden", className)}
        whileHover={{ y: -4 }}
        transition={{ duration: 0.2 }}
      >
        {cardContent}
      </MotionCard>
    );
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      {cardContent}
    </Card>
  );
}