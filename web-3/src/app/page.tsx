"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ApartmentFilters } from "~/components/apartment-filters";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { CreateListForm } from "~/components/forms";
import type { ApartmentSearchFilters } from "~/types/apartment";
import { ListType } from "@prisma/client";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { useFilterState } from "~/hooks/use-filter-state";

export default function HomePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { 
    appliedFilters, 
    draftFilters, 
    updateDraftFilters,
    applyFilters,
  } = useFilterState();
  const [showListDialog, setShowListDialog] = useState(false);
  const [commuteSearchData, setCommuteSearchData] = useState<any>(null);
  
  // tRPC mutation for commute search (creates list automatically)
  const searchWithCommuteMutation = api.search.searchWithCommute.useMutation({
    onSuccess: (result) => {
      toast.success("Commute search started!");
      setShowListDialog(false);
      // Redirect to the list page to show progress
      router.push(`/lists/${result.listId}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to start commute search");
    },
  });

  const handleSearch = (searchType: 'standard' | 'commute', data: any) => {
    if (searchType === 'commute') {
      if (!session) {
        toast.error("Please sign in to use commute search");
        router.push("/api/auth/signin");
        return;
      }
      // Show dialog for commute search to create a list
      setCommuteSearchData(data);
      setShowListDialog(true);
    } else {
      // Apply filters and navigate to search page
      applyFilters();
      router.push('/search');
    }
  };

  const handleListCreate = async (listData: any) => {
    // Pass both the list data (name, description) and commute search parameters
    searchWithCommuteMutation.mutate({
      workplaceStationId: commuteSearchData.workplaceStationId,
      maxCommuteMinutes: commuteSearchData.maxCommuteMinutes,
      filters: commuteSearchData.filters,
      listName: listData.name,
      listDescription: listData.description,
    });
  };

  return (
    <main className="flex min-h-screen w-full flex-col">
      {/* Hero Section with Search */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10 py-20 lg:py-32 w-full">
        <div className="w-full relative z-10 px-4">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="mb-6 text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              Find Your Perfect Home by{" "}
              <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Commute Time
              </span>
            </h1>
            <p className="mb-8 text-lg text-muted-foreground sm:text-xl">
              Discover apartments in Tokyo based on what really matters - your daily commute.
              Search by train time, not just location.
            </p>
            
            {/* Search Form with Filters */}
            <div className="mx-auto max-w-3xl">
              <ApartmentFilters 
                showApplyButton={true}
                showClientSideFilters={false}
                showCommuteSearch={true}
                context="home"
                onSearchButtonClick={handleSearch}
                initialFilters={draftFilters}
                onFiltersChange={updateDraftFilters}
              />
            </div>
          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
        </div>
      </section>

      {/* List Creation Dialog */}
      <Dialog open={showListDialog} onOpenChange={setShowListDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Commute Search List</DialogTitle>
            <DialogDescription>
              We'll create a list of all apartments within your specified commute time.
              This search may take a few minutes to complete.
            </DialogDescription>
          </DialogHeader>
          <CreateListForm 
            onSubmit={handleListCreate}
            defaultValues={{
              name: commuteSearchData ? `${commuteSearchData.workplaceStationName} - ${commuteSearchData.maxCommuteMinutes} min` : '',
              type: ListType.SEARCH_RESULT,
              isPublic: false,
            }}
            hideTypeSelector={true}
            loading={searchWithCommuteMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </main>
  );
}