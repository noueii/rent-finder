"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { Plus, Bookmark, Heart, Star, EyeOff, FolderPlus, Loader2 } from "lucide-react";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import type { ListType } from "@prisma/client";

interface AddToListButtonProps {
  apartmentId: string;
  variant?: "icon" | "default";
  className?: string;
  onSuccess?: () => void;
}

const LIST_TYPE_CONFIG: Record<Exclude<ListType, "SEARCH_RESULT">, {
  label: string;
  icon: typeof Bookmark;
  description: string;
}> = {
  BOOKMARKED: {
    label: "Bookmarks",
    icon: Bookmark,
    description: "Save for later viewing",
  },
  LIKED: {
    label: "Liked",
    icon: Heart,
    description: "Apartments you're interested in",
  },
  FAVORITED: {
    label: "Favorites",
    icon: Star,
    description: "Your top choices",
  },
  HIDDEN: {
    label: "Hidden",
    icon: EyeOff,
    description: "Hide from search results",
  },
  CUSTOM: {
    label: "Custom List",
    icon: FolderPlus,
    description: "Create your own list",
  },
};

export function AddToListButton({
  apartmentId,
  variant = "default",
  className,
  onSuccess,
}: AddToListButtonProps) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ListType>("BOOKMARKED");
  const [createNew, setCreateNew] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [selectedListId, setSelectedListId] = useState<string>("");

  // Fetch user's lists
  const { data: userLists, isLoading: listsLoading } = api.list.getUserLists.useQuery(
    { includeCount: true },
    { enabled: !!session }
  );

  // Create list mutation
  const createListMutation = api.list.create.useMutation({
    onSuccess: () => {
      toast.success("List created successfully");
    },
  });

  // Add to list mutation
  const addToListMutation = api.list.addApartment.useMutation({
    onSuccess: () => {
      toast.success("Added to list");
      setOpen(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add to list");
    },
  });

  const handleAddToList = async () => {
    if (!session) {
      toast.error("Please sign in to add apartments to lists");
      return;
    }

    let listId = selectedListId;

    // Create new list if needed
    if (createNew && newListName) {
      try {
        const newList = await createListMutation.mutateAsync({
          name: newListName,
          type: selectedType,
          isPublic: false,
        });
        listId = newList.id;
      } catch (error) {
        return; // Error already handled by mutation
      }
    }

    if (!listId) {
      toast.error("Please select a list");
      return;
    }

    // Add apartment to list
    addToListMutation.mutate({
      listId,
      apartmentId,
    });
  };

  const filteredLists = userLists?.filter(list => 
    list.type !== "SEARCH_RESULT" && 
    (createNew || list.type === selectedType)
  );

  const isLoading = createListMutation.isPending || addToListMutation.isPending;

  if (!session) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "icon" ? (
          <Button size="icon" variant="outline" className={className}>
            <Plus className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline" className={className}>
            <Plus className="mr-2 h-4 w-4" />
            Add to List
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add to List</DialogTitle>
          <DialogDescription>
            Choose a list to add this apartment to
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          {/* List Type Selection */}
          <div className="space-y-2">
            <Label>List Type</Label>
            <Select
              value={selectedType}
              onValueChange={(value) => {
                setSelectedType(value as ListType);
                setSelectedListId("");
                setCreateNew(false);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LIST_TYPE_CONFIG).map(([type, config]) => {
                  const Icon = config.icon;
                  return (
                    <SelectItem key={type} value={type}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span>{config.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {LIST_TYPE_CONFIG[selectedType as keyof typeof LIST_TYPE_CONFIG]?.description}
            </p>
          </div>

          {/* Create New List Option */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="create-new"
              checked={createNew}
              onCheckedChange={(checked) => {
                setCreateNew(checked as boolean);
                if (checked) {
                  setSelectedListId("");
                }
              }}
            />
            <Label
              htmlFor="create-new"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Create new list
            </Label>
          </div>

          {/* New List Name or Existing List Selection */}
          {createNew ? (
            <div className="space-y-2">
              <Label htmlFor="list-name">List Name</Label>
              <Input
                id="list-name"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="e.g., Dream Apartments"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Select List</Label>
              {listsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : filteredLists && filteredLists.length > 0 ? (
                <Select value={selectedListId} onValueChange={setSelectedListId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a list" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredLists.map((list) => (
                      <SelectItem key={list.id} value={list.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{list.name}</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            ({list.totalApartments} items)
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No {LIST_TYPE_CONFIG[selectedType as keyof typeof LIST_TYPE_CONFIG]?.label.toLowerCase()} lists found.
                  Create a new one above.
                </p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddToList}
              disabled={isLoading || (!createNew && !selectedListId) || (createNew && !newListName)}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {createNew ? "Create & Add" : "Add to List"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}