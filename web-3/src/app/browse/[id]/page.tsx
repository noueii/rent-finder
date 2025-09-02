"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, MotionConfig } from "framer-motion";
import { Button } from "~/components/ui/button";
import { Card, Badge } from "~/presentation/components/ui";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "~/components/ui/sheet";
import { Skeleton } from "~/components/ui/skeleton";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { api } from "~/trpc/react";
import { ApartmentFilters } from "~/components/apartment-filters";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { useFilterState } from "~/hooks/use-filter-state";
import { 
  X, 
  Heart, 
  Filter, 
  ArrowLeft,
  MapPin,
  Clock,
  Train,
  Building,
  Maximize,
  AlertCircle,
  RefreshCw,
  Settings,
  Save,
  Layers,
  ArrowUpDown
} from "lucide-react";
import type { ApartmentSearchFilters } from "~/types/apartment";
import { SwipeCard } from "~/components/swipe-card";

const SWIPE_THRESHOLD = 100;
const ROTATION_MULTIPLIER = 0.2;
const STACK_SIZE = 5;

interface SwipeCard {
  id: string;
  apartment: any; // Full apartment data with route
  zIndex: number;
  scale: number;
  y: number;
}

export default function BrowseListPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const listId = params.id as string;
  
  // Use the centralized filter state
  const { 
    appliedFilters, 
    draftFilters, 
    updateDraftFilters,
    applyFilters,
    resetFilters,
    isInitialized 
  } = useFilterState();
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cards, setCards] = useState<SwipeCard[]>([]);
  const [likedApartments, setLikedApartments] = useState<Set<string>>(new Set());
  const [skippedApartments, setSkippedApartments] = useState<Set<string>>(new Set());
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [selectedSaveListId, setSelectedSaveListId] = useState<string>("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [likedListId, setLikedListId] = useState<string | null>(null);
  const [hiddenListId, setHiddenListId] = useState<string | null>(null);
  
  
  // Fetch list details
  const { data: list, isLoading: listLoading } = api.list.getById.useQuery({ id: listId });
  
  // Fetch user's lists for saving liked apartments
  const { data: userLists } = api.list.getUserLists.useQuery({
    includeCount: true,
  });
  
  // Get or create liked/hidden lists
  const { data: likedList } = api.list.getUserLists.useQuery(
    { type: "LIKED" },
    { enabled: !!session }
  );
  
  const { data: hiddenList } = api.list.getUserLists.useQuery(
    { type: "HIDDEN" },
    { enabled: !!session }
  );
  
  // Create list mutations
  const createListMutation = api.list.create.useMutation();
  
  // Add to list mutations with optimistic updates
  const addToListMutation = api.list.addApartment.useMutation({
    onMutate: async ({ listId, apartmentId }) => {
      // Cancel any outgoing refetches
      await utils.list.checkApartmentInLists.cancel();
      
      // Snapshot the previous value
      const previousData = utils.list.checkApartmentInLists.getData({
        apartmentId,
        listTypes: ["LIKED", "HIDDEN"]
      });
      
      // Optimistically update to the new value
      const listType = listId === likedListId ? "LIKED" : "HIDDEN";
      utils.list.checkApartmentInLists.setData(
        { apartmentId, listTypes: [listType] },
        (old) => ({ ...old, [listType]: listId })
      );
      
      // Return a context object with the snapshotted value
      return { previousData, apartmentId };
    },
    onError: (error, newData, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousData) {
        utils.list.checkApartmentInLists.setData(
          { apartmentId: context.apartmentId, listTypes: ["LIKED", "HIDDEN"] },
          context.previousData
        );
      }
      toast.error(error.message || "Failed to add to list");
    },
    onSettled: () => {
      // Always refetch after error or success
      void utils.list.checkApartmentInLists.invalidate();
    },
  });
  
  const utils = api.useUtils();
  
  // Mutation for saving liked apartments
  const bulkAddMutation = api.list.bulkAddApartments.useMutation({
    onSuccess: (data) => {
      toast.success(`Added ${data.added} apartments to your list!`);
      setLikedApartments(new Set());
      setIsSaveDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save apartments");
    },
  });
  
  // Track sort state separately for immediate updates
  const [sortField, setSortField] = useState<'price' | 'size' | 'addedAt' | 'commuteTime' | 'score'>('addedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Initialize sort state from applied filters
  React.useEffect(() => {
    if (appliedFilters.sortBy) {
      // Map createdAt to addedAt for list-specific sorting
      const sortBy = appliedFilters.sortBy === 'createdAt' ? 'addedAt' : appliedFilters.sortBy;
      setSortField(sortBy as any);
    }
    if (appliedFilters.sortOrder) setSortOrder(appliedFilters.sortOrder);
  }, [appliedFilters.sortBy, appliedFilters.sortOrder]);

  // Remove sortBy and sortOrder from filters to avoid conflicts
  const filtersWithoutSort = React.useMemo(() => {
    const { sortBy, sortOrder, ...filters } = appliedFilters;
    return filters;
  }, [appliedFilters]);

  // Fetch apartments with pagination, excluding liked and hidden apartments
  const { data: apartmentsData, isLoading: apartmentsLoading, refetch } = api.list.getApartments.useQuery(
    { 
      listId, 
      pagination: { page, limit: 10 },
      filters: filtersWithoutSort,
      sort: { field: sortField, order: sortOrder },
      excludeListTypes: ['LIKED', 'HIDDEN'],
    },
    { 
      enabled: !!list && isInitialized,
    }
  );
  
  // Set list IDs when lists are loaded
  useEffect(() => {
    if (likedList && likedList.length > 0 && likedList[0]) {
      setLikedListId(likedList[0].id);
    }
    if (hiddenList && hiddenList.length > 0 && hiddenList[0]) {
      setHiddenListId(hiddenList[0].id);
    }
  }, [likedList, hiddenList]);
  

  // Process fetched apartments
  useEffect(() => {
    if (apartmentsData && !apartmentsLoading) {
      const currentCardIds = new Set(cards.map(c => c.id));
      const newApartments = apartmentsData.apartments.filter(apt => !currentCardIds.has(apt.id));
      
      if (newApartments.length > 0) {
        const newCards: SwipeCard[] = newApartments.map((apt, index) => ({
          id: apt.id,
          apartment: apt,
          zIndex: cards.length + index,
          scale: 1 - (cards.length + index) * 0.05,
          y: (cards.length + index) * 10,
        }));
        setCards(prev => [...prev, ...newCards]);
      }
      
      setHasMore(apartmentsData.hasMore);
    }
  }, [apartmentsData, apartmentsLoading, cards.length]);
  
  // Load more apartments when running low
  useEffect(() => {
    if (cards.length <= 2 && hasMore && !apartmentsLoading) {
      setPage(prev => prev + 1);
    }
  }, [cards.length, hasMore, apartmentsLoading]);
  
  // Handle swipe
  const handleSwipe = useCallback(async (direction: 'left' | 'right') => {
    if (cards.length === 0) return;
    
    const currentCard = cards[0];
    if (!currentCard) return;
    const apartmentId = currentCard.apartment.id;
    
    // Update local state immediately for UI feedback
    if (direction === 'right') {
      setLikedApartments(prev => new Set([...prev, currentCard.id]));
    } else {
      setSkippedApartments(prev => new Set([...prev, currentCard.id]));
    }
    
    // Remove the card immediately - AnimatePresence will handle the exit animation
    setCards(prev => prev.slice(1).map((card, index) => ({
      ...card,
      zIndex: index,
      scale: 1 - index * 0.05,
      y: index * 10,
    })));
    
    setCurrentIndex(prev => prev + 1);
    
    // Mutate database if user is logged in
    if (session) {
      try {
        if (direction === 'right') {
          // Add to liked list
          let currentLikedListId = likedListId;
          if (!currentLikedListId) {
            // Create liked list if it doesn't exist
            const newList = await createListMutation.mutateAsync({
              name: "Liked Apartments",
              type: "LIKED" as const,
              isPublic: false,
            });
            currentLikedListId = newList.id;
            setLikedListId(newList.id);
          }
          
          await addToListMutation.mutateAsync({
            listId: currentLikedListId,
            apartmentId,
          });
        } else {
          // Add to hidden list
          let currentHiddenListId = hiddenListId;
          if (!currentHiddenListId) {
            // Create hidden list if it doesn't exist
            const newList = await createListMutation.mutateAsync({
              name: "Hidden Apartments",
              type: "HIDDEN" as const,
              isPublic: false,
            });
            currentHiddenListId = newList.id;
            setHiddenListId(newList.id);
          }
          
          await addToListMutation.mutateAsync({
            listId: currentHiddenListId,
            apartmentId,
          });
        }
      } catch (error) {
        // Error is already handled by mutation onError
      }
    }
  }, [cards, session, likedListId, hiddenListId, createListMutation, addToListMutation]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handleSwipe('left');
      if (e.key === 'ArrowRight') handleSwipe('right');
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleSwipe]);
  
  // Save liked apartments
  const handleSaveLiked = () => {
    if (likedApartments.size === 0) {
      toast.error("No liked apartments to save");
      return;
    }
    
    if (!selectedSaveListId) {
      toast.error("Please select a list");
      return;
    }
    
    bulkAddMutation.mutate({
      listId: selectedSaveListId,
      apartmentIds: Array.from(likedApartments),
    });
  };
  
  // Loading state
  if (listLoading || (apartmentsLoading && cards.length === 0) || !isInitialized) {
    return (
      <div className="container px-4 py-8">
        <div className="mx-auto max-w-2xl space-y-4">
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }
  
  if (!list) {
    return (
      <div className="container px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>List not found</AlertDescription>
        </Alert>
      </div>
    );
  }
  
  // Get the visible cards (top STACK_SIZE cards)
  const visibleCards = cards.slice(0, STACK_SIZE);
  
  return (
    <div className="fixed inset-0 flex flex-col bg-background pt-16">
      {/* Header with Stats */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/browse')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        {/* Stats */}
        <div className="flex gap-3">
          <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950 px-3 py-1 rounded-full">
            <X className="h-4 w-4 text-red-600" />
            <span className="font-semibold text-red-700 dark:text-red-400">{skippedApartments.size}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-green-50 dark:bg-green-950 px-3 py-1 rounded-full">
            <Heart className="h-4 w-4 text-green-600 fill-green-600" />
            <span className="font-semibold text-green-700 dark:text-green-400">{likedApartments.size}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950 px-3 py-1 rounded-full">
            <Layers className="h-4 w-4 text-blue-600" />
            <span className="font-semibold text-blue-700 dark:text-blue-400">
              {Math.max(0, (apartmentsData?.total || 0) - currentIndex)}
            </span>
          </div>
        </div>
        
        <div className="flex gap-2">
          {/* Sorting Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <ArrowUpDown className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setSortField('score');
                  setSortOrder('desc');
                  updateDraftFilters({ sortBy: 'score', sortOrder: 'desc' });
                  applyFilters();
                  setPage(1);
                  setCards([]);
                }}
                className={sortField === 'score' ? 'bg-accent' : ''}
              >
                Best Match {sortField === 'score' && (sortOrder === 'desc' ? '↓' : '↑')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setSortField('addedAt');
                  setSortOrder('desc');
                  updateDraftFilters({ sortBy: 'createdAt', sortOrder: 'desc' });
                  applyFilters();
                  setPage(1);
                  setCards([]);
                }}
                className={sortField === 'addedAt' ? 'bg-accent' : ''}
              >
                Recently Added {sortField === 'addedAt' && (sortOrder === 'desc' ? '↓' : '↑')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const newOrder = sortField === 'price' && sortOrder === 'asc' ? 'desc' : 'asc';
                  setSortField('price');
                  setSortOrder(newOrder);
                  updateDraftFilters({ sortBy: 'price', sortOrder: newOrder });
                  applyFilters();
                  setPage(1);
                  setCards([]);
                }}
                className={sortField === 'price' ? 'bg-accent' : ''}
              >
                Price {sortField === 'price' && (sortOrder === 'asc' ? '↑' : '↓')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const newOrder = sortField === 'size' && sortOrder === 'desc' ? 'asc' : 'desc';
                  setSortField('size');
                  setSortOrder(newOrder);
                  updateDraftFilters({ sortBy: 'size', sortOrder: newOrder });
                  applyFilters();
                  setPage(1);
                  setCards([]);
                }}
                className={sortField === 'size' ? 'bg-accent' : ''}
              >
                Size {sortField === 'size' && (sortOrder === 'desc' ? '↓' : '↑')}
              </DropdownMenuItem>
              {list?.type === 'SEARCH_RESULT' && (
                <DropdownMenuItem
                  onClick={() => {
                    const newOrder = sortField === 'commuteTime' && sortOrder === 'asc' ? 'desc' : 'asc';
                    setSortField('commuteTime');
                    setSortOrder(newOrder);
                    updateDraftFilters({ sortBy: 'commuteTime', sortOrder: newOrder });
                    applyFilters();
                    setPage(1);
                    setCards([]);
                  }}
                  className={sortField === 'commuteTime' ? 'bg-accent' : ''}
                >
                  Commute Time {sortField === 'commuteTime' && (sortOrder === 'asc' ? '↑' : '↓')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          
          {likedApartments.size > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSaveDialogOpen(true)}
            >
              <Save className="h-5 w-5" />
            </Button>
          )}
          
          <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Filter className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
              <SheetHeader>
                <SheetTitle>Filter Apartments</SheetTitle>
                <SheetDescription>
                  Refine your browsing experience
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4 px-4">
                <ApartmentFilters
                  onFiltersChange={updateDraftFilters}
                  initialFilters={draftFilters}
                  showCommuteSearch={false}
                  showApplyButton={false}
                  context="userlist"
                  showCommuteTimeFilter={list.type === 'SEARCH_RESULT'}
                  className="px-0"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      resetFilters();
                      setPage(1);
                      setCards([]);
                      setIsFilterSheetOpen(false);
                    }}
                  >
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      applyFilters();
                      setPage(1);
                      setCards([]);
                      setIsFilterSheetOpen(false);
                    }}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      
      {/* Card Stack */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden p-4">
        <div className="relative w-full max-w-lg h-full max-h-[800px]" style={{ perspective: '1000px' }}>
        {cards.length === 0 ? (
          <Card className="flex h-full items-center justify-center p-8 text-center">
            <div className="space-y-4">
              <p className="text-muted-foreground">
                {currentIndex === 0 
                  ? "No apartments match your filters" 
                  : "You've viewed all apartments!"}
              </p>
              <Button 
                variant="outline"
                onClick={() => {
                  setCurrentIndex(0);
                  setPage(1);
                  setCards([]);
                  setLikedApartments(new Set());
                  setSkippedApartments(new Set());
                  refetch();
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Start Over
              </Button>
            </div>
          </Card>
        ) : (
          <MotionConfig reducedMotion="user">
            <AnimatePresence>
              {visibleCards.map((card, index) => (
                <SwipeCard
                  key={card.id}
                  card={card}
                  index={index}
                  isTop={index === 0}
                  onSwipe={handleSwipe}
                  listType={list.type}
                  targetStationId={list?.searchParams && typeof list.searchParams === 'object' && 'workplaceStationId' in list.searchParams ? (list.searchParams.workplaceStationId as string) : undefined}
                  showScore={true}
                />
              ))}
            </AnimatePresence>
          </MotionConfig>
        )}
        </div>
      </div>
      
      {/* Save Dialog */}
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Liked Apartments</DialogTitle>
            <DialogDescription>
              Choose a list to save {likedApartments.size} liked apartment{likedApartments.size !== 1 ? 's' : ''} to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {userLists?.filter(list => list.type === 'CUSTOM').map(list => (
              <div
                key={list.id}
                className={`cursor-pointer rounded-lg border p-4 transition-colors hover:bg-accent ${
                  selectedSaveListId === list.id ? 'border-primary bg-accent' : ''
                }`}
                onClick={() => setSelectedSaveListId(list.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{list.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {list.totalApartments || list._count?.apartments || 0} apartments
                    </p>
                  </div>
                  <Layers className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ))}
            
            {userLists?.filter(list => list.type === 'CUSTOM').length === 0 && (
              <p className="text-center text-muted-foreground">
                No lists available. Create a list first.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsSaveDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveLiked}
              disabled={!selectedSaveListId || bulkAddMutation.isPending}
            >
              {bulkAddMutation.isPending ? "Saving..." : "Save to List"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}