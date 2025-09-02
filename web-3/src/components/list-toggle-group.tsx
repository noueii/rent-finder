"use client";

import { ListToggleButton } from "./list-toggle-button";
import { cn } from "~/lib/utils";

interface ListToggleGroupProps {
  apartmentId: string;
  className?: string;
  showTypes?: Array<"LIKED" | "FAVORITED" | "HIDDEN" | "BOOKMARKED">;
}

export function ListToggleGroup({
  apartmentId,
  className,
  showTypes = ["BOOKMARKED", "FAVORITED"],
}: ListToggleGroupProps) {
  return (
    <div className={cn("flex gap-1", className)}>
      {showTypes.map((type) => (
        <ListToggleButton
          key={type}
          apartmentId={apartmentId}
          listType={type}
          className="h-8 w-8 p-0"
        />
      ))}
    </div>
  );
}