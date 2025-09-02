"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Plus, Folder } from "lucide-react";
import { api } from "~/trpc/react";
import { toast } from "sonner";

interface AddToListDialogProps {
  apartmentId: string;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function AddToListDialog({ apartmentId, trigger, onSuccess }: AddToListDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [showNewListForm, setShowNewListForm] = useState(false);
  const [newListName, setNewListName] = useState("");

  // Fetch user's custom lists
  const { data: customLists, refetch: refetchLists } = api.list.getUserLists.useQuery({
    type: "CUSTOM",
    includeCount: true,
  });

  // Create new list mutation
  const createListMutation = api.list.create.useMutation({
    onSuccess: (newList) => {
      setSelectedListId(newList.id);
      setShowNewListForm(false);
      setNewListName("");
      void refetchLists();
      toast.success(`Created list "${newList.name}"`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create list");
    },
  });

  // Add to list mutation
  const addToListMutation = api.list.addApartment.useMutation({
    onSuccess: () => {
      toast.success("Added to list!");
      setOpen(false);
      setSelectedListId("");
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add to list");
    },
  });

  const handleAddToList = () => {
    if (!selectedListId) {
      toast.error("Please select a list");
      return;
    }
    addToListMutation.mutate({
      listId: selectedListId,
      apartmentId,
    });
  };

  const handleCreateList = () => {
    if (!newListName.trim()) {
      toast.error("Please enter a list name");
      return;
    }
    createListMutation.mutate({
      name: newListName.trim(),
      type: "CUSTOM",
      isPublic: false,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="icon" variant="outline" className="h-8 w-8">
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add to List</DialogTitle>
          <DialogDescription>
            Add this apartment to one of your custom lists or create a new one.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {!showNewListForm ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="list">Select a list</Label>
                <Select value={selectedListId} onValueChange={setSelectedListId}>
                  <SelectTrigger id="list">
                    <SelectValue placeholder="Choose a list..." />
                  </SelectTrigger>
                  <SelectContent>
                    {customLists && customLists.length > 0 ? (
                      customLists.map((list) => (
                        <SelectItem key={list.id} value={list.id}>
                          <div className="flex items-center gap-2">
                            <Folder className="h-4 w-4" />
                            <span>{list.name}</span>
                            <span className="text-muted-foreground">
                              ({list._count?.apartments || 0})
                            </span>
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-2 text-center text-sm text-muted-foreground">
                        No custom lists yet
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-center">
                <span className="text-sm text-muted-foreground">or</span>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowNewListForm(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create New List
              </Button>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="name">List name</Label>
              <Input
                id="name"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="e.g., Dream Apartments"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreateList();
                  }
                }}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowNewListForm(false);
                    setNewListName("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleCreateList}
                  disabled={createListMutation.isPending}
                >
                  Create
                </Button>
              </div>
            </div>
          )}
        </div>
        {!showNewListForm && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddToList}
              disabled={!selectedListId || addToListMutation.isPending}
            >
              Add to List
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}