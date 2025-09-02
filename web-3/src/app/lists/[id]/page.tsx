"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import React, {  useState, useMemo, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { SortedApartmentList } from "~/components/sorted-apartment-list";
import { ApartmentFilters } from "~/components/apartment-filters";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Progress } from "~/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "~/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { api } from "~/trpc/react";
import { useSession } from "next-auth/react";
import { UpdateApartmentDetailsDialog } from "~/components/update-apartment-details-dialog";
import { BulkAssignStationDialog } from "~/components/bulk-assign-station-dialog";
import { 
  Clock, 
  MapPin, 
  Filter, 
  RefreshCw, 
  AlertCircle,
  CheckCircle,
  Loader2,
  Settings,
  Share2,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trash2,
  Heart,
  EyeOff,
  Bookmark,
  Star
} from "lucide-react";
import { toast } from "sonner";
import type { ApartmentSearchFilters, ApartmentWithRelations } from "~/types/apartment";
import { CalculateScoresButton } from "~/components/calculate-scores-button";
import { ExportWithStationDialog } from "~/components/export-with-station-dialog";
import { useFilterState } from "~/hooks/use-filter-state";
import { cn } from "~/lib/utils";

export default function ListDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const listId = params.id as string;
  
  // Use centralized filter state
  const { 
    appliedFilters, 
    draftFilters, 
    updateDraftFilters,
    applyFilters,
    resetFilters,
    isInitialized 
  } = useFilterState();
  
  // State for commute filters
  const [commuteFilters, setCommuteFilters] = useState<{
    workplaceStationId?: string;
    maxCommuteMinutes?: number;
  }>({});
  
  const [page, setPage] = useState(1);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [showLiked, setShowLiked] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [showBookmarked, setShowBookmarked] = useState(true);
  const [showFavorited, setShowFavorited] = useState(true);
  // Separate sort state from filters
  const [sortField, setSortField] = useState<'price' | 'size' | 'addedAt' | 'commuteTime' | 'score'>('addedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const limit = 20;
  
  const isAdmin = session?.user?.role === 'ADMIN';
  
  // Create filters without sort fields for API calls
  const filtersWithoutSort = useMemo(() => {
    const { sortBy, sortOrder, ...filters } = appliedFilters;
    return filters;
  }, [appliedFilters]);
  
  // Parse list toggles from URL on mount
  useEffect(() => {
    setShowLiked(!searchParams.get('hideLiked'));
    setShowHidden(!!searchParams.get('showHidden'));
    setShowBookmarked(!searchParams.get('hideBookmarked'));
    setShowFavorited(!searchParams.get('hideFavorited'));
  }, [searchParams]);
  
  // Function to update list toggles in URL
  const updateListTogglesInUrl = useCallback((toggles: { liked: boolean; hidden: boolean; bookmarked: boolean; favorited: boolean }) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (!toggles.liked) params.set('hideLiked', 'true');
    else params.delete('hideLiked');
    if (toggles.hidden) params.set('showHidden', 'true');
    else params.delete('showHidden');
    if (!toggles.bookmarked) params.set('hideBookmarked', 'true');
    else params.delete('hideBookmarked');
    if (!toggles.favorited) params.set('hideFavorited', 'true');
    else params.delete('hideFavorited');
    
    // Get existing search params from filter state
    const filterParams = new URLSearchParams();
    const filters = filtersWithoutSort;
    if (filters.priceMin) filterParams.set('minPrice', filters.priceMin.toString());
    if (filters.priceMax) filterParams.set('maxPrice', filters.priceMax.toString());
    if (filters.sizeMin) filterParams.set('minSize', filters.sizeMin.toString());
    if (filters.sizeMax) filterParams.set('maxSize', filters.sizeMax.toString());
    if (filters.layout?.length) filterParams.set('layouts', filters.layout.join(','));
    if (filters.buildingAge) filterParams.set('maxBuildingAge', filters.buildingAge.toString());
    if (filters.maxCommuteMinutes) filterParams.set('maxCommuteTime', filters.maxCommuteMinutes.toString());
    if (filters.excludeWards?.length) filterParams.set('excludeWards', filters.excludeWards.join(','));
    if (filters.twoYearAvgMin) filterParams.set('twoYearAvgMin', filters.twoYearAvgMin.toString());
    if (filters.twoYearAvgMax) filterParams.set('twoYearAvgMax', filters.twoYearAvgMax.toString());
    
    // Merge filter params with list toggle params
    filterParams.forEach((value, key) => {
      params.set(key, value);
    });
    
    // Update URL
    router.replace(`/lists/${listId}?${params.toString()}`, { scroll: false });
  }, [searchParams, router, listId, filtersWithoutSort]);

  // Fetch list details
  const { data: list, isLoading: listLoading, error: listError } = api.list.getById.useQuery(
    { id: listId },
    {
      refetchInterval: 5000,
    }
  );

  // Compute which list types to exclude
  // Note: For custom lists (LIKED, HIDDEN, etc.), we don't want to exclude anything
  // The list already contains only the apartments in that specific list
  const excludeListTypes = React.useMemo(() => {
    // Only apply exclusions for SEARCH_RESULT and CUSTOM lists
    if (list?.type !== 'SEARCH_RESULT' && list?.type !== 'CUSTOM') {
      return []; // Don't exclude anything for LIKED, HIDDEN, BOOKMARKED, FAVORITED lists
    }
    
    const types: Array<'LIKED' | 'HIDDEN' | 'BOOKMARKED' | 'FAVORITED'> = [];
    if (!showLiked) types.push('LIKED');
    if (!showHidden) types.push('HIDDEN');
    if (!showBookmarked) types.push('BOOKMARKED');
    if (!showFavorited) types.push('FAVORITED');
    return types;
  }, [showLiked, showHidden, showBookmarked, showFavorited, list?.type]);

  // Create a stable query key that includes sort parameters
  const queryInput = React.useMemo(() => ({
    listId, 
    pagination: { page, limit },
    filters: filtersWithoutSort,
    sort: { field: sortField, order: sortOrder },
    excludeListTypes,
  }), [listId, page, limit, filtersWithoutSort, sortField, sortOrder, excludeListTypes]);

  // Fetch apartments in the list
  const { data: apartmentsData, isLoading: apartmentsLoading, refetch: refetchApartments } = api.list.getApartments.useQuery(
    queryInput,
    { 
      enabled: !!list && (list.status === 'completed' || list.status === 'processing' || list.status === 'failed' || list.status === null),
      refetchInterval: list?.status === 'processing' ? 5000 : false, // Refetch while processing to get route updates
    }
  );

  // Get search progress for commute searches
  const { data: searchProgress } = api.search.getSearchProgress.useQuery(
    { listId },
    { 
      enabled: !!list && list.type === 'SEARCH_RESULT' && list.status === 'processing',
      refetchInterval: 2000,
    }
  );

  // Refresh search mutation
  const refreshSearchMutation = api.search.searchWithCommute.useMutation({
    onSuccess: (result) => {
      toast.success("Refresh started! The list will update automatically.");
      // The page will auto-refresh due to the status change
    },
    onError: (error) => {
      toast.error(error.message || "Failed to refresh search");
    },
  });

  // Delete list mutation
  const deleteListMutation = api.list.delete.useMutation({
    onSuccess: () => {
      toast.success("List deleted successfully");
      router.push("/lists");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete list");
    },
  });

  // Refresh all apartments mutation
  const refreshAllMutation = api.list.refreshAllApartments.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      // Refetch apartments after a delay to allow jobs to start processing
      setTimeout(() => {
        refetchApartments();
      }, 3000);
    },
    onError: (error) => {
      toast.error(`Failed to refresh: ${error.message}`);
    },
  });

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Get apartments from the query (all filtering is done server-side)
  const apartments = apartmentsData?.apartments || [];
  
  // Commute search mutation
  const commuteSearchMutation = api.search.searchWithCommute.useMutation({
    onSuccess: (result) => {
      toast.success("Commute search started! Redirecting to results...");
      // Redirect to the new search results list
      router.push(`/lists/${result.listId}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to perform commute search");
    },
  });

  // Remove apartment from list mutation
  const removeFromListMutation = api.list.removeApartment.useMutation({
    onSuccess: () => {
      toast.success("Apartment removed from list");
      refetchApartments();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to remove apartment");
    },
  });

  const handleRemoveFromList = (apartment: any) => {
    if (confirm("Are you sure you want to remove this apartment from the list?")) {
      removeFromListMutation.mutate({
        listId,
        apartmentId: apartment.id,
      });
    }
  };

  // Handle apply filters
  const handleApplyFilters = () => {
    // Check if we have a workplace station selected
    if (commuteFilters.workplaceStationId) {
      // Perform a new commute search
      commuteSearchMutation.mutate({
        workplaceStationId: commuteFilters.workplaceStationId,
        maxCommuteMinutes: commuteFilters.maxCommuteMinutes || 30,
        filters: draftFilters,
      });
    } else {
      // Just apply regular filters
      applyFilters();
      setPage(1); // Reset to first page when applying filters
      setIsFilterSheetOpen(false);
      
      const filterCount = Object.entries(draftFilters).filter(([key, value]) => {
        if (key === 'sortBy' || key === 'sortOrder') return false;
        return value !== undefined && value !== null && 
               (Array.isArray(value) ? value.length > 0 : true);
      }).length;
      
      toast.success(`Applied ${filterCount} filter${filterCount !== 1 ? 's' : ''}`);
    }
  };
  
  // Handle reset filters
  const handleResetFilters = () => {
    resetFilters();
    setCommuteFilters({});
    setPage(1); // Reset to first page when clearing filters
    toast.success('Filters cleared');
  };

  // Handle delete list
  const handleDeleteList = () => {
    if (confirm(`Are you sure you want to delete "${list?.name}"? This action cannot be undone.`)) {
      deleteListMutation.mutate({ id: listId });
    }
  };

  if (listLoading) {
    return (
      <div className="container px-4 py-8">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (listError || !list) {
    return (
      <div className="container px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {listError?.message || "List not found"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8 overflow-x-hidden">
      {/* List Header */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <CardTitle className="text-xl sm:text-2xl break-words">{list.name}</CardTitle>
              {list.description && (
                <CardDescription className="break-words">{list.description}</CardDescription>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant={list.isPublic ? "default" : "secondary"}>
                  {list.isPublic ? "Public" : "Private"}
                </Badge>
                <Badge variant={list.status === 'completed' ? "secondary" : "default"}>
                  {list.status}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <BulkAssignStationDialog
                  listId={listId}
                  listName={list.name}
                  apartmentCount={list._count?.apartments || 0}
                  onSuccess={refetchApartments}
                />
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteList}
                  disabled={deleteListMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete List
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search Progress for Processing Lists */}
          {list.status === 'processing' && searchProgress && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm font-medium">{searchProgress.message}</span>
              </div>
              <Progress value={searchProgress.progress} className="h-2" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {searchProgress.stationsFound !== undefined && (
                  <div className="text-center">
                    <p className="text-2xl font-semibold">{searchProgress.stationsFound}</p>
                    <p className="text-sm text-muted-foreground">Stations Found</p>
                  </div>
                )}
                {searchProgress.apartmentsFound !== undefined && (
                  <div className="text-center">
                    <p className="text-2xl font-semibold">{searchProgress.apartmentsFound}</p>
                    <p className="text-sm text-muted-foreground">Apartments Found</p>
                  </div>
                )}
                {searchProgress.apartmentsSaved !== undefined && (
                  <div className="text-center">
                    <p className="text-2xl font-semibold">{searchProgress.apartmentsSaved}</p>
                    <p className="text-sm text-muted-foreground">Saved to List</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* List Stats */}
          {(list.status === 'completed' || list.status === 'failed') && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="text-center">
                <p className="text-2xl font-semibold">{list._count?.apartments || 0}</p>
                <p className="text-sm text-muted-foreground">Total Apartments</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-semibold">
                  {list.createdAt && new Date(list.createdAt).toLocaleDateString()}
                </p>
                <p className="text-sm text-muted-foreground">Created</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-semibold">
                  {list.updatedAt && new Date(list.updatedAt).toLocaleDateString()}
                </p>
                <p className="text-sm text-muted-foreground">Last Updated</p>
              </div>
            </div>
          )}

          {/* Route Calculation Status for Lists with Target Station */}
          {(list.type === 'SEARCH_RESULT' || (list as any).targetStationId) && (list.status === 'completed' || list.status === 'failed') && (
            <div className="mt-4 rounded-lg bg-muted p-4">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4" />
                Commute Time Status
                {list.searchParams && typeof list.searchParams === 'object' && 'workplaceStationId' in list.searchParams && (
                  <span className="text-xs text-muted-foreground">(to target station)</span>
                )}
              </h4>
              <div className="space-y-3">
                {(() => {
                  const totalApartments = list._count?.apartments || 0;
                  const apartmentsWithoutRoutes = (list as any).apartmentsWithoutRoutes || 0;
                  const apartmentsWithoutCoordinates = (list as any).apartmentsWithoutCoordinates || 0;
                  const apartmentsWithRoutes = totalApartments - apartmentsWithoutRoutes;
                  const percentageCalculated = totalApartments > 0 
                    ? Math.round((apartmentsWithRoutes / totalApartments) * 100) 
                    : 0;

                  return (
                    <>
                      {apartmentsWithoutRoutes > 0 ? (
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-orange-600">
                            {apartmentsWithoutRoutes} of {totalApartments} apartments missing routes
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-green-600">
                          ✓ All {totalApartments} apartments have routes calculated
                        </p>
                      )}
                      {apartmentsWithoutCoordinates > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          ({apartmentsWithoutCoordinates} have no coordinates)
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Search Parameters for Search Result Lists */}
          {list.type === 'SEARCH_RESULT' && list.searchParams && (() => {
            const params = list.searchParams as any;
            return (
              <div className="mt-4 rounded-lg bg-muted p-4">
                <h4 className="mb-2 text-sm font-medium">Search Parameters</h4>
                <div className="space-y-1 text-sm text-muted-foreground">
                  {params.workplaceStationName && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>Target Station: {params.workplaceStationName}</span>
                    </div>
                  )}
                  {params.maxCommuteMinutes && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>Max {params.maxCommuteMinutes} minutes commute</span>
                    </div>
                  )}
                  {params.filters && (
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      <span>Additional filters applied</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Failed State Alert */}
      {list.status === 'failed' && (
        <div className="mb-6 space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              The route calculation failed to complete. You can still browse the apartments below, but some may not have commute times calculated.
            </AlertDescription>
          </Alert>
          
          {list.type === 'SEARCH_RESULT' && list.searchParams && (
            <div className="flex justify-center">
              <Button 
                variant="outline"
                onClick={() => {
                  const params = list.searchParams as any;
                  refreshSearchMutation.mutate({
                    workplaceStationId: params.workplaceStationId,
                    maxCommuteMinutes: params.maxCommuteMinutes,
                    filters: params.filters,
                  });
                }}
                disabled={refreshSearchMutation.isPending}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshSearchMutation.isPending ? 'animate-spin' : ''}`} />
                {refreshSearchMutation.isPending ? 'Starting new search...' : 'Retry Search'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Apartments List */}
      {(list.status === 'completed' || list.status === 'processing' || list.status === 'failed' || list.status === null) && apartmentsData && (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Desktop Sidebar Filters */}
          <aside className="hidden lg:block w-80 flex-shrink-0">
            <Card className="sticky top-4 p-6 max-h-[calc(100vh-2rem)] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4">Filters</h3>
              <ApartmentFilters
                onFiltersChange={updateDraftFilters}
                initialFilters={draftFilters}
                showCommuteSearch={true}
                showClientSideFilters={false}
                showApplyButton={false}
                context="userlist"
                showCommuteTimeFilter={list.type === 'SEARCH_RESULT'}
                onCommuteSearchChange={setCommuteFilters}
                initialCommuteFilters={commuteFilters}
              />
              <div className="flex gap-2 mt-6 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleResetFilters}
                >
                  Reset All
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={handleApplyFilters}
                >
                  Apply Filters
                </Button>
              </div>
            </Card>
          </aside>

          {/* Main Content */}
          <motion.div
            className="flex-1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-6 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h2 className="text-xl font-semibold">
                  Apartments ({apartmentsData.total})
                </h2>
                <div className="flex gap-2">
                {/* Mobile Filter Button */}
                <Sheet 
                  open={isFilterSheetOpen} 
                  onOpenChange={setIsFilterSheetOpen}
                >
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="lg:hidden">
                      <Filter className="mr-2 h-4 w-4" />
                      Filters
                      {Object.keys(appliedFilters).length > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {Object.keys(appliedFilters).length}
                        </Badge>
                      )}
                    </Button>
                  </SheetTrigger>
                <SheetContent className="w-[400px] overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Filter Apartments</SheetTitle>
                    <SheetDescription>
                      Narrow down apartments in this list
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-6 space-y-4">
                    <ApartmentFilters
                      onFiltersChange={updateDraftFilters}
                      initialFilters={draftFilters}
                      showCommuteSearch={true}
                      showClientSideFilters={false}
                      showApplyButton={false}
                      context="userlist"
                      // Show commute time filter for search result lists
                      showCommuteTimeFilter={list.type === 'SEARCH_RESULT'}
                      onCommuteSearchChange={setCommuteFilters}
                      initialCommuteFilters={commuteFilters}
                    />
                    <div className="flex gap-2 pt-4 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={handleResetFilters}
                      >
                        Reset All
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={handleApplyFilters}
                      >
                        Apply Filters
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
              {list.type === 'SEARCH_RESULT' && list.searchParams && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    const params = list.searchParams as any;
                    refreshSearchMutation.mutate({
                      workplaceStationId: params.workplaceStationId,
                      maxCommuteMinutes: params.maxCommuteMinutes,
                      filters: params.filters,
                    });
                  }}
                  disabled={refreshSearchMutation.isPending}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${refreshSearchMutation.isPending ? 'animate-spin' : ''}`} />
                  {refreshSearchMutation.isPending ? 'Refreshing...' : 'Refresh'}
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  refreshAllMutation.mutate({
                    listId: listId,
                    includeRemovalCheck: true,
                  });
                }}
                disabled={refreshAllMutation.isPending}
              >
                <RefreshCw className={cn("mr-2 h-4 w-4", refreshAllMutation.isPending && "animate-spin")} />
                {refreshAllMutation.isPending ? 'Refreshing...' : 'Refresh Listings'}
              </Button>
              {isAdmin && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsUpdateDialogOpen(true)}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Update Details
                </Button>
              )}
              <Button variant="outline" size="sm">
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
              <ExportWithStationDialog
                listId={listId}
                filters={filtersWithoutSort}
                sortField={sortField}
                sortOrder={sortOrder}
                totalCount={apartmentsData?.total}
                listName={list.name}
                currentTargetStation={
                  list.type === 'SEARCH_RESULT' && list.searchParams 
                    ? {
                        id: (list.searchParams as any).workplaceStationId,
                        name: (list.searchParams as any).workplaceStationName
                      }
                    : undefined
                }
                isLoading={apartmentsLoading}
              />
                </div>
              </div>

              {/* Sort Controls */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-sm text-muted-foreground hidden sm:inline">Sort by:</span>
                  <Select
                    value={sortField}
                    onValueChange={(value: any) => {
                      setSortField(value);
                      setPage(1); // Reset to first page when sorting changes
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="score">Best Match</SelectItem>
                      <SelectItem value="addedAt">Date Added</SelectItem>
                      <SelectItem value="price">Price</SelectItem>
                      <SelectItem value="size">Size</SelectItem>
                      {list.type === 'SEARCH_RESULT' && (
                        <SelectItem value="commuteTime">Commute Time</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
                      setSortOrder(newOrder);
                      setPage(1); // Reset to first page when sorting changes
                    }}
                    className="h-8 px-2"
                    title={sortOrder === 'asc' ? 'Sort ascending' : 'Sort descending'}
                  >
                    {sortOrder === 'asc' ? (
                      <ArrowUp className="h-4 w-4" />
                    ) : (
                      <ArrowDown className="h-4 w-4" />
                    )}
                  </Button>
                  <CalculateScoresButton 
                    listId={listId}
                    onComplete={() => refetchApartments()}
                  />
                </div>
                {/* Filter summary */}
                {Object.keys(appliedFilters).length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    {Object.keys(appliedFilters).length} filter{Object.keys(appliedFilters).length !== 1 ? 's' : ''} applied
                  </div>
                )}
              </div>
              
              {/* List Type Toggles - Only show for SEARCH_RESULT and CUSTOM lists */}
              {(list.type === 'SEARCH_RESULT' || list.type === 'CUSTOM') && (
                <div className="flex flex-wrap gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="text-sm font-medium">Show apartments from:</div>
                  <div className="flex flex-wrap gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Switch
                        checked={showLiked}
                        onCheckedChange={(checked) => {
                          setShowLiked(checked);
                          setPage(1);
                          updateListTogglesInUrl({
                            liked: checked,
                            hidden: showHidden,
                            bookmarked: showBookmarked,
                            favorited: showFavorited
                          });
                        }}
                      />
                      <Heart className="h-3 w-3" />
                      <span className="text-sm">Liked</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Switch
                        checked={showHidden}
                        onCheckedChange={(checked) => {
                          setShowHidden(checked);
                          setPage(1);
                          updateListTogglesInUrl({
                            liked: showLiked,
                            hidden: checked,
                            bookmarked: showBookmarked,
                            favorited: showFavorited
                          });
                        }}
                      />
                      <EyeOff className="h-3 w-3" />
                      <span className="text-sm">Hidden</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Switch
                        checked={showBookmarked}
                        onCheckedChange={(checked) => {
                          setShowBookmarked(checked);
                          setPage(1);
                          updateListTogglesInUrl({
                            liked: showLiked,
                            hidden: showHidden,
                            bookmarked: checked,
                            favorited: showFavorited
                          });
                        }}
                      />
                      <Bookmark className="h-3 w-3" />
                      <span className="text-sm">Bookmarked</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Switch
                        checked={showFavorited}
                        onCheckedChange={(checked) => {
                          setShowFavorited(checked);
                          setPage(1);
                          updateListTogglesInUrl({
                            liked: showLiked,
                            hidden: showHidden,
                            bookmarked: showBookmarked,
                            favorited: checked
                          });
                        }}
                      />
                      <Star className="h-3 w-3" />
                      <span className="text-sm">Favorited</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            <SortedApartmentList
            apartments={apartments as unknown as ApartmentWithRelations[]}
            loading={apartmentsLoading}
            variant="grid"
            virtualized={false}
            listId={listId}
            targetStationId={(list?.searchParams as any)?.workplaceStationId}
            showScore={true}
            sortField={sortField}
            sortOrder={sortOrder}
            onRemoveFromList={handleRemoveFromList}
          />

          {/* Note about filtering */}
          {Object.keys(appliedFilters).length > 0 && (
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Showing {apartmentsData.total} apartments matching your filters
            </div>
          )}
          
          {/* Pagination - Note: pagination is for the unfiltered data from the server */}
          {apartmentsData.total > limit && (
            <div className="mt-8 flex justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="flex items-center px-4">
                Page {page} of {Math.ceil(apartmentsData.total / limit)}
              </span>
              <Button
                variant="outline"
                onClick={() => handlePageChange(page + 1)}
                disabled={!apartmentsData.hasMore}
              >
                Next
              </Button>
            </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Empty State */}
      {(list.status === 'completed' || list.status === 'processing' || list.status === 'failed' || list.status === null) && apartmentsData && apartmentsData.total === 0 && (
        <Card className="py-12 text-center">
          <CardContent>
            <p className="text-muted-foreground">No apartments found in this list.</p>
          </CardContent>
        </Card>
      )}

      {/* Processing State - Show only if no apartments loaded yet */}
      {list.status === 'processing' && !apartmentsData && (
        <Card className="py-12 text-center">
          <CardContent>
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">
              Your search is in progress. This page will update automatically.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Update Apartment Details Dialog */}
      {list && (
        <UpdateApartmentDetailsDialog
          listId={listId}
          listName={list.name}
          open={isUpdateDialogOpen}
          onOpenChange={setIsUpdateDialogOpen}
          onComplete={() => {
            refetchApartments();
            toast.success("Apartment details updated successfully!");
          }}
        />
      )}

    </div>
  );
}