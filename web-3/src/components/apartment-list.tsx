"use client";

import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion, AnimatePresence } from "framer-motion";
import { ApartmentCard } from "./apartment-card";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import type { ApartmentWithRelations } from "~/types";
import { ListManager } from "~/presentation/services";

interface ApartmentListProps {
  apartments: ApartmentWithRelations[];
  loading?: boolean;
  onViewApartment?: (apartment: ApartmentWithRelations) => void;
  onLikeApartment?: (apartment: ApartmentWithRelations) => void;
  onBookmarkApartment?: (apartment: ApartmentWithRelations) => void;
  onRemoveFromList?: (apartment: ApartmentWithRelations) => void;
  variant?: "grid" | "list";
  virtualized?: boolean;
  className?: string;
  listId?: string;
  targetStationId?: string;
  showScore?: boolean;
}

export function ApartmentList({
  apartments,
  loading = false,
  onViewApartment,
  onLikeApartment,
  onBookmarkApartment,
  onRemoveFromList,
  variant = "grid",
  virtualized = true,
  className,
  listId,
  targetStationId,
  showScore = false,
}: ApartmentListProps) {
  const parentRef = React.useRef<HTMLDivElement>(null);
  
  // Calculate items per row based on variant
  const itemsPerRow = variant === "grid" ? 3 : 1;
  const rowCount = Math.ceil(apartments.length / itemsPerRow);
  
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (variant === "grid" ? 400 : 200),
    overscan: 2,
  });

  if (loading) {
    return (
      <div className={cn(
        variant === "grid" 
          ? "grid gap-6 md:grid-cols-2 lg:grid-cols-3" 
          : "space-y-4",
        className
      )}>
        {Array.from({ length: 6 }).map((_, i) => (
          <ApartmentCardSkeleton key={i} variant={variant === "list" ? "compact" : "default"} />
        ))}
      </div>
    );
  }

  if (apartments.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-12 text-center"
      >
        <Home className="mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="mb-2 text-lg font-semibold">No apartments found</h3>
        <p className="text-sm text-muted-foreground">
          Try adjusting your search filters or check back later
        </p>
      </motion.div>
    );
  }

  if (!virtualized) {
    return (
      <div className={cn(
        variant === "grid" 
          ? "grid gap-6 md:grid-cols-2 lg:grid-cols-3" 
          : "space-y-4",
        className
      )}>
        <AnimatePresence mode="popLayout">
          {apartments.map((apartment, index) => (
            <motion.div
              key={apartment.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: index * 0.05 }}
            >
              <ApartmentCard
                apartment={apartment}
                onView={() => onViewApartment?.(apartment)}
                onLike={() => onLikeApartment?.(apartment)}
                onBookmark={() => onBookmarkApartment?.(apartment)}
                onRemoveFromList={() => onRemoveFromList?.(apartment)}
                variant={variant === "list" ? "compact" : "default"}
                listId={listId}
                targetStationId={targetStationId}
                showScore={showScore}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  }

  // Virtualized rendering
  return (
    <div
      ref={parentRef}
      className={cn("h-[800px] overflow-auto", className)}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const startIndex = virtualRow.index * itemsPerRow;
          const endIndex = Math.min(startIndex + itemsPerRow, apartments.length);
          const rowApartments = apartments.slice(startIndex, endIndex);

          return (
            <div
              key={virtualRow.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div className={cn(
                variant === "grid" 
                  ? "grid gap-6 md:grid-cols-2 lg:grid-cols-3" 
                  : "space-y-4"
              )}>
                {rowApartments.map((apartment) => (
                  <ApartmentCard
                    key={apartment.id}
                    apartment={apartment}
                    onView={() => onViewApartment?.(apartment)}
                    onLike={() => onLikeApartment?.(apartment)}
                    onBookmark={() => onBookmarkApartment?.(apartment)}
                    onRemoveFromList={() => onRemoveFromList?.(apartment)}
                    variant={variant === "list" ? "compact" : "default"}
                    animate={false} // Disable animation in virtualized list
                    listId={listId}
                    targetStationId={targetStationId}
                    showScore={showScore}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ApartmentCardSkeleton({ variant }: { variant: "default" | "compact" }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-0">
        <Skeleton className="h-48 w-full" />
      </CardHeader>
      <CardContent className="p-4">
        <Skeleton className="mb-2 h-6 w-3/4" />
        <Skeleton className="mb-3 h-8 w-1/3" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        {variant === "default" && (
          <>
            <div className="mt-3 flex gap-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-16" />
            </div>
            <div className="mt-3 space-y-1 border-t pt-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          </>
        )}
      </CardContent>
      {variant === "default" && (
        <CardFooter className="p-4 pt-0">
          <Skeleton className="h-10 w-full" />
        </CardFooter>
      )}
    </Card>
  );
}

// Import necessary components that might be missing
import { Card, CardContent, CardFooter, CardHeader } from "~/components/ui/card";
import { Home } from "lucide-react";