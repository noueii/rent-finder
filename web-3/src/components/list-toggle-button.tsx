"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "~/components/ui/button";
import { Heart, Star, EyeOff, Bookmark, Loader2 } from "lucide-react";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import type { ListType } from "@prisma/client";

interface ListToggleButtonProps {
  apartmentId: string;
  listType: "LIKED" | "FAVORITED" | "HIDDEN" | "BOOKMARKED";
  className?: string;
  onToggle?: (isInList: boolean) => void;
}

const LIST_CONFIG = {
  LIKED: {
    icon: Heart,
    activeTitle: "Remove from liked",
    inactiveTitle: "Add to liked",
    listName: "Liked Apartments",
  },
  FAVORITED: {
    icon: Star,
    activeTitle: "Remove from favorites",
    inactiveTitle: "Add to favorites",
    listName: "Favorite Apartments",
  },
  HIDDEN: {
    icon: EyeOff,
    activeTitle: "Unhide",
    inactiveTitle: "Hide apartment",
    listName: "Hidden Apartments",
  },
  BOOKMARKED: {
    icon: Bookmark,
    activeTitle: "Remove bookmark",
    inactiveTitle: "Add bookmark",
    listName: "Bookmarked Apartments",
  },
} as const;

export function ListToggleButton({
  apartmentId,
  listType,
  className,
  onToggle,
}: ListToggleButtonProps) {
  const { data: session } = useSession();
  const [isInList, setIsInList] = useState(false);
  const [listId, setListId] = useState<string | null>(null);
  
  const config = LIST_CONFIG[listType];
  const Icon = config.icon;

  // Check if apartment is in user's lists of this type
  const { data: listMap, isLoading: checkLoading, refetch: refetchListStatus, error: checkError } = api.list.checkApartmentInLists.useQuery(
    { 
      apartmentId,
      listTypes: [listType] 
    },
    { 
      enabled: !!session && !!apartmentId,
      retry: false,
    }
  );

  // Log any errors for debugging
  if (checkError) {
    console.error(`Error checking list status for apartment ${apartmentId}:`, checkError);
  }

  // Get or create the list
  const { data: userLists, isLoading: listsLoading } = api.list.getUserLists.useQuery(
    { type: listType },
    { enabled: !!session }
  );

  // Create list if it doesn't exist
  const createListMutation = api.list.create.useMutation();

  const utils = api.useUtils();
  
  // Add/remove mutations with optimistic updates
  const addToListMutation = api.list.addApartment.useMutation({
    onMutate: async ({ listId }) => {
      // Cancel any outgoing refetches
      await utils.list.checkApartmentInLists.cancel({ apartmentId, listTypes: [listType] });
      
      // Snapshot the previous value
      const previousData = utils.list.checkApartmentInLists.getData({
        apartmentId,
        listTypes: [listType]
      });
      
      // Optimistically update
      setIsInList(true);
      utils.list.checkApartmentInLists.setData(
        { apartmentId, listTypes: [listType] },
        (old) => ({ ...old, [listType]: listId })
      );
      
      return { previousData };
    },
    onError: (error, _, context) => {
      // Rollback on error
      setIsInList(false);
      if (context?.previousData) {
        utils.list.checkApartmentInLists.setData(
          { apartmentId, listTypes: [listType] },
          context.previousData
        );
      }
      toast.error(error.message || "Failed to add to list");
    },
    onSuccess: () => {
      toast.success(`Added to ${config.listName.toLowerCase()}`);
      onToggle?.(true);
    },
    onSettled: () => {
      // Always refetch after error or success
      void utils.list.checkApartmentInLists.invalidate({ apartmentId });
    },
  });

  const removeFromListMutation = api.list.removeApartment.useMutation({
    onMutate: async () => {
      // Cancel any outgoing refetches
      await utils.list.checkApartmentInLists.cancel({ apartmentId, listTypes: [listType] });
      
      // Snapshot the previous value
      const previousData = utils.list.checkApartmentInLists.getData({
        apartmentId,
        listTypes: [listType]
      });
      
      // Optimistically update
      setIsInList(false);
      utils.list.checkApartmentInLists.setData(
        { apartmentId, listTypes: [listType] },
        (old) => {
          const newData = { ...old };
          delete newData[listType];
          return newData;
        }
      );
      
      return { previousData };
    },
    onError: (error, _, context) => {
      // Rollback on error
      setIsInList(true);
      if (context?.previousData) {
        utils.list.checkApartmentInLists.setData(
          { apartmentId, listTypes: [listType] },
          context.previousData
        );
      }
      toast.error(error.message || "Failed to remove from list");
    },
    onSuccess: () => {
      toast.success(`Removed from ${config.listName.toLowerCase()}`);
      onToggle?.(false);
    },
    onSettled: () => {
      // Always refetch after error or success
      void utils.list.checkApartmentInLists.invalidate({ apartmentId });
    },
  });

  // Update state based on list membership
  useEffect(() => {
    // If we have a response (even empty), update state
    if (listMap !== undefined) {
      if (listMap[listType]) {
        setIsInList(true);
        setListId(listMap[listType]);
      } else {
        setIsInList(false);
        // Get the list ID from userLists if it exists
        if (userLists && userLists.length > 0) {
          setListId(userLists[0]!.id);
        }
      }
    }
  }, [listMap, listType, userLists]);

  const handleToggle = async () => {
    if (!session) {
      toast.error("Please sign in to use lists");
      return;
    }

    let currentListId = listId;

    // Create list if it doesn't exist
    if (!currentListId) {
      try {
        const newList = await createListMutation.mutateAsync({
          name: config.listName,
          type: listType,
          isPublic: false,
        });
        currentListId = newList.id;
        setListId(newList.id);
      } catch (error) {
        return;
      }
    }

    // Toggle apartment in list
    if (isInList) {
      removeFromListMutation.mutate({
        listId: currentListId,
        apartmentId,
      });
    } else {
      addToListMutation.mutate({
        listId: currentListId,
        apartmentId,
      });
    }
  };

  const isLoading = 
    checkLoading ||
    listsLoading || 
    createListMutation.isPending || 
    addToListMutation.isPending || 
    removeFromListMutation.isPending;

  if (!session) {
    return null;
  }

  return (
    <Button
      size="icon"
      variant={isInList ? "default" : "outline"}
      onClick={handleToggle}
      disabled={isLoading}
      title={isInList ? config.activeTitle : config.inactiveTitle}
      className={className}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Icon className={cn(
          "h-4 w-4",
          isInList && "fill-current"
        )} />
      )}
    </Button>
  );
}