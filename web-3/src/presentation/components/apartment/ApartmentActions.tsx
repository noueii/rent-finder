/**
 * ApartmentActions Component
 * Handles all action buttons for apartments (external links, lists, etc.)
 */

import * as React from "react";
import Link from "next/link";
import { 
  ExternalLink, 
  Eye, 
  Trash2, 
  X, 
  Check, 
  Bookmark,
  Plus
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { ActionBar, QuickAction } from "~/presentation/components/ui";
import { ListToggleGroup } from "~/components/list-toggle-group";
import { AddToListDialog } from "~/components/add-to-list-dialog";
import { AssignStationDropdown } from "~/components/assign-station-dropdown";
import type { ApartmentWithRelations } from "~/types";
import { buildApartmentDetailUrl } from "~/presentation/services/navigation-builder";

interface ApartmentActionsProps {
  apartment: ApartmentWithRelations;
  variant?: "default" | "browse" | "compact" | "overlay";
  listId?: string;
  targetStationId?: string;
  onView?: () => void;
  onLike?: () => void;
  onDislike?: () => void;
  onBookmark?: () => void;
  onRemoveFromList?: () => void;
  className?: string;
}

export function ApartmentActions({
  apartment,
  variant = "default",
  listId,
  targetStationId,
  onView,
  onLike,
  onDislike,
  onBookmark,
  onRemoveFromList,
  className
}: ApartmentActionsProps) {
  const detailUrl = buildApartmentDetailUrl(apartment.id, { 
    targetStationId, 
    listId 
  });

  // Overlay variant for image overlays
  if (variant === "overlay") {
    return (
      <div className={`flex gap-2 ${className}`}>
        {listId && onRemoveFromList && (
          <Button
            size="icon"
            variant="secondary"
            className="backdrop-blur-sm bg-red-100/90 hover:bg-red-200 h-8 w-8 text-red-600 hover:text-red-700"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (confirm("Remove this apartment from the list?")) {
                onRemoveFromList();
              }
            }}
            title="Remove from list"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
        
        <div className="backdrop-blur-sm bg-white/90 rounded-md">
          <AssignStationDropdown
            apartmentId={apartment.id}
            currentPreferredStation={(apartment as any).preferredStation}
            nearestStations={apartment.nearestStations}
            routes={(apartment as any).routes}
          />
        </div>
        
        {apartment.sourceUrl && (
          <Button
            size="icon"
            variant="secondary"
            className="backdrop-blur-sm bg-white/90 hover:bg-white h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              window.open(apartment.sourceUrl, '_blank');
            }}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  // Default variant (card footer)
  if (variant === "default") {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (apartment.sourceUrl) {
                window.open(apartment.sourceUrl, '_blank');
              }
            }}
            disabled={!apartment.sourceUrl}
          >
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            View Original
          </Button>
          
          <ListToggleGroup 
            apartmentId={apartment.id}
            showTypes={["LIKED", "HIDDEN", "FAVORITED", "BOOKMARKED"]}
            className="flex-shrink-0"
          />
          
          <AddToListDialog apartmentId={apartment.id} />
        </div>
        
        <Link href={detailUrl} target="_blank" rel="noopener noreferrer" className="w-full">
          <Button className="w-full" onClick={onView}>
            <Eye className="mr-2 h-4 w-4" />
            View Details
          </Button>
        </Link>
      </div>
    );
  }

  // Browse variant (swipe actions)
  if (variant === "browse") {
    const browseActions = [
      {
        id: "dislike",
        label: "Pass",
        icon: X,
        onClick: onDislike || (() => {}),
        variant: "destructive" as const,
      },
      {
        id: "bookmark",
        label: "Bookmark",
        icon: Bookmark,
        onClick: onBookmark || (() => {}),
        variant: "outline" as const,
      },
      {
        id: "view",
        label: "View",
        icon: Eye,
        onClick: onView || (() => {}),
        variant: "outline" as const,
      },
      {
        id: "like",
        label: "Like",
        icon: Check,
        onClick: onLike || (() => {}),
        variant: "default" as const,
      },
    ];

    return (
      <div className={`flex justify-between ${className}`}>
        <QuickAction
          icon={X}
          label="Pass"
          onClick={onDislike || (() => {})}
          variant="destructive"
          size="lg"
        />
        <ActionBar
          actions={browseActions.slice(1, 3)}
          variant="compact"
          size="md"
        />
        <QuickAction
          icon={Check}
          label="Like"
          onClick={onLike || (() => {})}
          variant="primary"
          size="lg"
          className="bg-green-600 hover:bg-green-700 text-white"
        />
      </div>
    );
  }

  // Compact variant (minimal actions)
  const compactActions = [
    ...(apartment.sourceUrl ? [{
      id: "external",
      label: "View Original",
      icon: ExternalLink,
      onClick: () => window.open(apartment.sourceUrl, '_blank'),
      variant: "ghost" as const,
    }] : []),
    {
      id: "details",
      label: "Details",
      icon: Eye,
      onClick: () => window.open(detailUrl, '_blank'),
      variant: "ghost" as const,
    },
  ];

  return (
    <ActionBar
      actions={compactActions}
      variant="inline"
      size="sm"
      className={className}
    />
  );
}