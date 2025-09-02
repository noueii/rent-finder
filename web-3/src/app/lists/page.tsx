"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "~/components/ui/button";
import { Card, Badge } from "~/presentation/components/ui";
import { Skeleton } from "~/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { FormInput } from "~/presentation/components/forms";
import { api } from "~/trpc/react";
import { 
  Plus, 
  Search, 
  Folder, 
  Heart, 
  Eye, 
  EyeOff, 
  Star,
  Clock,
  Share2,
  Trash2,
  Edit,
  ChevronRight,
  AlertTriangle
} from "lucide-react";

// The list data structure from API already includes count

const listIcons = {
  BOOKMARKED: Heart,
  LIKED: Star,
  FAVORITED: Star,
  HIDDEN: EyeOff,
  CUSTOM: Folder,
  SEARCH_RESULT: Clock,
} as const;

const listColors = {
  BOOKMARKED: "text-red-500",
  LIKED: "text-yellow-500",
  FAVORITED: "text-purple-500",
  HIDDEN: "text-gray-500",
  CUSTOM: "text-blue-500",
  SEARCH_RESULT: "text-green-500",
} as const;

export default function ListsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListDescription, setNewListDescription] = useState("");

  // Fetch user lists
  const { data: lists, isLoading, error, refetch } = api.list.getUserLists.useQuery({
    includeCount: true
  });

  // Create list mutation
  const createListMutation = api.list.create.useMutation({
    onSuccess: () => {
      setShowCreateDialog(false);
      setNewListName("");
      setNewListDescription("");
      // Refetch lists
      void refetch();
    },
  });

  // Delete list mutation
  const deleteListMutation = api.list.delete.useMutation({
    onSuccess: () => {
      void refetch();
    },
  });

  const handleCreateList = () => {
    if (newListName.trim()) {
      createListMutation.mutate({
        name: newListName.trim(),
        type: "CUSTOM",
        isPublic: false,
      });
    }
  };

  const handleDeleteList = (listId: string, listName: string) => {
    if (confirm(`Are you sure you want to delete "${listName}"?`)) {
      deleteListMutation.mutate({ id: listId });
    }
  };

  // Filter lists based on search
  const filteredLists = lists?.filter((list) =>
    list.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    list.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container px-4 py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold">My Lists</h1>
              <p className="mt-1 text-muted-foreground">
                Organize and manage your saved apartments
              </p>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create List
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New List</DialogTitle>
                  <DialogDescription>
                    Create a custom list to organize your favorite apartments.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <FormInput
                    label="Name"
                    value={newListName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewListName(e.target.value)}
                    placeholder="e.g., Dream Homes, Budget Options"
                  />
                  <FormInput
                    label="Description (optional)"
                    value={newListDescription}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewListDescription(e.target.value)}
                    placeholder="Add a description..."
                  />
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleCreateList}
                    disabled={!newListName.trim() || createListMutation.isPending}
                  >
                    {createListMutation.isPending ? "Creating..." : "Create List"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Search */}
          <div className="mt-6 max-w-md">
            <FormInput
              icon={Search}
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              placeholder="Search lists..."
            />
          </div>
        </div>
      </div>

      {/* Lists Grid */}
      <div className="container px-4 py-8">
        {error ? (
          <Card className="p-8 text-center">
            <p className="text-red-500">Error loading lists. Please try again.</p>
          </Card>
        ) : isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : filteredLists && filteredLists.length > 0 ? (
          <motion.div
            layout
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            <AnimatePresence mode="popLayout">
              {filteredLists.map((list) => {
                const Icon = listIcons[list.type as keyof typeof listIcons] || Folder;
                const iconColor = listColors[list.type as keyof typeof listColors] || "text-primary";

                return (
                  <motion.div
                    key={list.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card className="group relative overflow-hidden transition-shadow hover:shadow-lg">
                      <Link href={`/lists/${list.id}`} className="block p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="mb-2 flex items-center gap-3">
                              <Icon className={`h-6 w-6 ${iconColor}`} />
                              <h3 className="text-lg font-semibold">{list.name}</h3>
                            </div>
                            {list.description && (
                              <p className="mb-3 text-sm text-muted-foreground line-clamp-2">
                                {list.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>{list.totalApartments || list._count?.apartments || 0} apartments</span>
                              {list.apartmentsWithoutRoutes !== undefined && list.apartmentsWithoutRoutes > 0 && (
                                <Badge variant="destructive" className="text-xs flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  {list.apartmentsWithoutRoutes} without routes
                                </Badge>
                              )}
                              <Badge variant="secondary" className="text-xs">
                                {list.type}
                              </Badge>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                        </div>
                      </Link>
                      
                      {/* Action buttons */}
                      {list.type === "CUSTOM" && (
                        <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.preventDefault();
                              // TODO: Implement edit functionality
                            }}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.preventDefault();
                              handleDeleteList(list.id, list.name);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        ) : (
          <Card className="p-8 text-center">
            <p className="mb-4 text-muted-foreground">
              {searchQuery
                ? "No lists found matching your search."
                : "You don't have any lists yet."}
            </p>
            {!searchQuery && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First List
              </Button>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}