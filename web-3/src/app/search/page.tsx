"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { ApartmentList } from "~/components/apartment-list";
import { ApartmentFilters } from "~/components/apartment-filters";
import { Button } from "~/components/ui/button";
import { ActionBar } from "~/presentation/components/ui";
import { Card } from "~/presentation/components/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { api } from "~/trpc/react";
import { SlidersHorizontal, X, Map, List, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { ApartmentSearchFilters, ApartmentWithRelations } from "~/types";
import { useFilterState } from "~/hooks/use-filter-state";

// Dynamic import for map component to avoid SSR issues
const SearchResultsMap = dynamic(
  () => import("~/components/map").then((mod) => mod.SearchResultsMap),
  { 
    ssr: false,
    loading: () => <div className="h-[600px] bg-muted animate-pulse rounded-lg" />
  }
);

const getSortOptions = () => [
  { value: "score-desc", label: "Best Match" },
  { value: "createdAt-desc", label: "Newest First" },
  { value: "createdAt-asc", label: "Oldest First" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "size-asc", label: "Size: Small to Large" },
  { value: "size-desc", label: "Size: Large to Small" },
];

export default function SearchPage() {
  const router = useRouter();
  const { 
    appliedFilters, 
    draftFilters, 
    updateDraftFilters,
    applyFilters,
    resetFilters,
    isInitialized 
  } = useFilterState();
  
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedApartment, setSelectedApartment] = useState<ApartmentWithRelations | undefined>();
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  // Map sortBy field for API compatibility (commuteTime not supported yet)
  const sortField = appliedFilters.sortBy === 'commuteTime' ? 'score' : 
                   appliedFilters.sortBy || 'score';
  
  // Fetch apartments with filters
  const { data, isLoading, error, refetch } = api.apartment.search.useQuery({
    filters: appliedFilters,
    pagination: { page, limit: 20 },
    sort: { field: sortField as 'price' | 'size' | 'createdAt' | 'scrapedAt' | 'score', order: appliedFilters.sortOrder || 'desc' },
  }, {
    enabled: isInitialized,
  });

  // Refresh apartments mutation
  const refreshMutation = api.search.refreshApartments.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
      // Refetch the search results
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to refresh apartments");
    },
  });

  // Reset page when applied filters change
  useEffect(() => {
    setPage(1);
  }, [appliedFilters]);

  const handleSortChange = (value: string) => {
    const [apiSortField, newSortOrder] = value.split("-") as ["price" | "size" | "createdAt" | "score", "asc" | "desc"];
    updateDraftFilters({ 
      sortBy: apiSortField, 
      sortOrder: newSortOrder 
    });
    applyFilters();
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Search Header */}
      <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold">Search Results</h1>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              className="lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="container px-4 py-8">
        <div className="flex gap-8">
          {/* Filters Sidebar - Desktop */}
          <aside className="hidden w-64 flex-shrink-0 lg:block">
            <Card className="p-6">
              <ApartmentFilters 
                initialFilters={draftFilters} 
                onFiltersChange={updateDraftFilters}
                showApplyButton={true}
                onSearchButtonClick={() => {
                  applyFilters();
                  setPage(1);
                }}
              />
            </Card>
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            {/* Results Header */}
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {isLoading ? (
                  <Skeleton className="h-6 w-32" />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {data?.total || 0} apartments found
                  </p>
                )}
                
                {/* View Mode Toggle */}
                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "list" | "map")}>
                  <TabsList>
                    <TabsTrigger value="list" className="gap-2">
                      <List className="h-4 w-4" />
                      List
                    </TabsTrigger>
                    <TabsTrigger value="map" className="gap-2">
                      <Map className="h-4 w-4" />
                      Map
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Map sortField to allowed values for refresh mutation
                    const refreshSortField = sortField === 'score' ? 'createdAt' : sortField;
                    refreshMutation.mutate({ 
                      filters: appliedFilters, 
                      sort: { 
                        field: refreshSortField as 'price' | 'size' | 'createdAt', 
                        order: appliedFilters.sortOrder || 'desc' 
                      } 
                    });
                  }}
                  disabled={refreshMutation.isPending}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
                  {refreshMutation.isPending ? 'Refreshing...' : 'Refresh'}
                </Button>
                
                <Select 
                  value={`${appliedFilters.sortBy || 'score'}-${appliedFilters.sortOrder || 'desc'}`} 
                  onValueChange={handleSortChange}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getSortOptions().map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Results */}
            {error ? (
              <Card className="p-8 text-center">
                <p className="text-red-500">Error loading apartments. Please try again.</p>
              </Card>
            ) : isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-48 w-full" />
                ))}
              </div>
            ) : data?.apartments && data.apartments.length > 0 ? (
              <>
                {viewMode === "list" ? (
                  <>
                    <ApartmentList 
                      apartments={data.apartments}
                      showScore={true}
                    />
                    
                    {/* Pagination */}
                    {data.total > data.limit && (
                      <div className="mt-8 flex justify-center gap-2">
                        <Button
                          variant="outline"
                          onClick={() => handlePageChange(page - 1)}
                          disabled={page === 1}
                        >
                          Previous
                        </Button>
                        <div className="flex items-center px-4">
                          Page {page} of {Math.ceil(data.total / data.limit)}
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => handlePageChange(page + 1)}
                          disabled={!data.hasMore}
                        >
                          Next
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-4">
                    <SearchResultsMap
                      apartments={data.apartments}
                      selectedApartment={selectedApartment}
                      onApartmentClick={setSelectedApartment}
                      className="h-[600px]"
                      showStations
                      useClustering
                    />
                    
                    {/* Selected apartment details */}
                    {selectedApartment && (
                      <Card className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg mb-2">{selectedApartment.title}</h3>
                            <p className="text-sm text-muted-foreground mb-3">{selectedApartment.address}</p>
                            <div className="flex items-center gap-6 text-sm">
                              <span className="font-medium text-lg">¥{selectedApartment.price.toLocaleString()}/月</span>
                              <span>{selectedApartment.size}㎡</span>
                              {selectedApartment.layout && <span>{selectedApartment.layout}</span>}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`/apartments/${selectedApartment.id}`, '_blank')}
                          >
                            View Details
                          </Button>
                        </div>
                      </Card>
                    )}
                  </div>
                )}
              </>
            ) : (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">
                  No apartments found matching your criteria.
                </p>
              </Card>
            )}
          </main>
        </div>
      </div>

      {/* Mobile Filters Drawer */}
      <AnimatePresence>
        {showFilters && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black lg:hidden"
              onClick={() => setShowFilters(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 20 }}
              className="fixed inset-y-0 right-0 z-50 w-80 bg-background shadow-xl lg:hidden overflow-y-auto"
            >
              <div className="sticky top-0 bg-background p-6 pb-0 z-10">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Filters</h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowFilters(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="p-6 pt-2">
                <ApartmentFilters 
                  initialFilters={draftFilters} 
                  onFiltersChange={updateDraftFilters}
                  showApplyButton={true}
                  onSearchButtonClick={() => {
                    applyFilters();
                    setPage(1);
                    setShowFilters(false);
                  }}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}