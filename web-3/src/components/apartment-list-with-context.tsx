"use client";

import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion, AnimatePresence } from "framer-motion";
import { ApartmentCard } from "./apartment-card";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import type { ApartmentWithRelations } from "~/types";
import { useListManagement } from "~/contexts/ListManagementContext";
import { useUserPreferences } from "~/contexts/UserPreferencesContext";
import { Card, CardContent, CardFooter, CardHeader } from "~/components/ui/card";
import { Home } from "lucide-react";

interface ApartmentListWithContextProps {
  apartments: ApartmentWithRelations[];
  loading?: boolean;
  variant?: "grid" | "list";
  virtualized?: boolean;
  className?: string;
  listId?: string;
  targetStationId?: string;
  showScore?: boolean;
}

export function ApartmentListWithContext({
  apartments,
  loading = false,
  variant = "grid",
  virtualized = true,
  className,
  listId,
  targetStationId,
  showScore = false,
}: ApartmentListWithContextProps) {
  const parentRef = React.useRef<HTMLDivElement>(null);
  
  // Use context hooks instead of prop callbacks
  const { 
    onViewApartment,
    onLikeApartment,
    onBookmarkApartment,
    onRemoveFromList,
  } = useListManagement();
  
  const { viewMode } = useUserPreferences();
  
  // Use view mode from preferences if not specified
  const displayVariant = variant || (viewMode === 'grid' ? 'grid' : 'list');
  
  // Calculate items per row based on variant
  const itemsPerRow = displayVariant === "grid" ? 3 : 1;
  const rowCount = Math.ceil(apartments.length / itemsPerRow);
  
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (displayVariant === "grid" ? 400 : 200),
    overscan: 2,
  });

  if (loading) {
    return (
      <div className={cn(
        displayVariant === "grid" 
          ? "grid gap-6 md:grid-cols-2 lg:grid-cols-3" 
          : "space-y-4",
        className
      )}>
        {Array.from({ length: 6 }).map((_, i) => (
          <ApartmentCardSkeleton key={i} variant={displayVariant === "list" ? "compact" : "default"} />
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

  const renderApartmentCard = (apartment: ApartmentWithRelations, index: number, animate: boolean = true) => (
    <ApartmentCard
      key={apartment.id}
      apartment={apartment}
      onView={() => onViewApartment(apartment)}
      onLike={() => onLikeApartment(apartment)}
      onBookmark={() => onBookmarkApartment(apartment)}
      onRemoveFromList={listId ? () => onRemoveFromList(listId, apartment) : undefined}
      variant={displayVariant === "list" ? "compact" : "default"}
      animate={animate}
      listId={listId}
      targetStationId={targetStationId}
      showScore={showScore}
    />
  );

  if (!virtualized) {
    return (
      <div className={cn(
        displayVariant === "grid" 
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
              {renderApartmentCard(apartment, index)}
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
                displayVariant === "grid" 
                  ? "grid gap-6 md:grid-cols-2 lg:grid-cols-3" 
                  : "space-y-4"
              )}>
                {rowApartments.map((apartment, index) => renderApartmentCard(apartment, index, false))}
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