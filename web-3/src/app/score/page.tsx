"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { 
  ArrowLeft,
  AlertCircle,
  Star,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { ApartmentCard } from "~/components/apartment-card";

export default function ScorePage() {
  const router = useRouter();
  const { data: session } = useSession();
  
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [page, setPage] = useState(1);
  const [scores, setScores] = useState<Record<string, { location: number; design: number; space: number }>>({});
  
  // Fetch user's lists
  const { data: userLists } = api.list.getUserLists.useQuery({
    includeCount: true,
  });
  
  // Fetch apartments from selected list
  const { data: apartmentsData, isLoading: apartmentsLoading, refetch } = api.list.getApartments.useQuery(
    { 
      listId: selectedListId, 
      pagination: { page, limit: 20 },
      filters: {},
      sort: { field: 'addedAt', order: 'desc' },
    },
    { 
      enabled: !!selectedListId,
    }
  );
  
  // Update score mutation
  const updateScoreMutation = api.list.updateApartmentScore.useMutation({
    onSuccess: () => {
      toast.success("Score saved!");
      // Refetch apartments to get updated scores
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update score");
    },
  });
  
  // Remove apartment from list mutation
  const removeApartmentMutation = api.list.removeApartment.useMutation({
    onSuccess: () => {
      toast.success("Apartment removed from list");
      // Refetch to update the list
      refetch();
      // If we removed the current apartment, navigate to next or previous
      if (apartments.length > 1) {
        if (currentIndex >= apartments.length - 1) {
          setCurrentIndex(Math.max(0, currentIndex - 1));
        }
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to remove apartment");
    },
  });
  
  const apartments = apartmentsData?.apartments || [];
  const currentApartment = apartments[currentIndex];
  const currentScore = currentApartment ? scores[currentApartment.id] || { location: 0, design: 0, space: 0 } : { location: 0, design: 0, space: 0 };
  
  // Handle score update
  const handleScoreChange = (type: 'location' | 'design' | 'space', value: number) => {
    if (!currentApartment) return;
    
    setScores(prev => ({
      ...prev,
      [currentApartment.id]: {
        ...prev[currentApartment.id] || { location: 0, design: 0, space: 0 },
        [type]: value
      }
    }));
  };
  
  // Save current scores (even if partial)
  const handleSaveScore = () => {
    if (!currentApartment || !selectedListId) return;
    
    const score = scores[currentApartment.id] || { location: 0, design: 0, space: 0 };
    
    // Save the score (0 means TBD/unscored)
    updateScoreMutation.mutate({
      listId: selectedListId,
      apartmentId: currentApartment.id,
      locationScore: score.location || null,
      designScore: score.design || null,
      spaceScore: score.space || null,
    });
  };
  
  // Save score and move to next
  const handleSaveAndNext = () => {
    handleSaveScore();
    // Move to next
    handleNext();
  };
  
  // Navigation
  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };
  
  const handleNext = () => {
    if (currentIndex < apartments.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else if (apartmentsData?.hasMore) {
      // Load next page
      setPage(page + 1);
      setCurrentIndex(0);
    }
  };
  
  // Handle removing apartment from list
  const handleRemoveFromList = () => {
    if (!currentApartment || !selectedListId) return;
    
    removeApartmentMutation.mutate({
      listId: selectedListId,
      apartmentId: currentApartment.id,
    });
  };
  
  // Reset when list changes
  useEffect(() => {
    setCurrentIndex(0);
    setPage(1);
    setScores({});
  }, [selectedListId]);
  
  // Load existing scores
  useEffect(() => {
    if (currentApartment && apartmentsData) {
      // Check if apartment already has scores in the database
      const listItem = (apartmentsData as any).listItems?.find((item: any) => 
        item.apartmentId === currentApartment.id
      );
      
      if (listItem && (listItem.locationScore !== undefined || listItem.designScore !== undefined || listItem.spaceScore !== undefined)) {
        setScores(prev => ({
          ...prev,
          [currentApartment.id]: {
            location: listItem.locationScore || 0,
            design: listItem.designScore || 0,
            space: listItem.spaceScore || 0
          }
        }));
      }
    }
  }, [currentApartment, apartmentsData]);
  
  if (!session) {
    return (
      <div className="container px-4 py-8">
        <Card className="mx-auto max-w-md">
          <div className="p-6 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Sign In Required</h2>
            <p className="text-muted-foreground mb-4">
              You need to sign in to score apartments
            </p>
            <Button asChild>
              <a href="/auth/signin">Sign In</a>
            </Button>
          </div>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container px-4 py-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Score Apartments</h1>
            <p className="text-muted-foreground mt-1">
              Rate apartments on location and design quality
            </p>
          </div>
          
          {/* List Selector */}
          <div className="w-64">
            <Select value={selectedListId} onValueChange={setSelectedListId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a list..." />
              </SelectTrigger>
              <SelectContent>
                {userLists?.map((list) => (
                  <SelectItem key={list.id} value={list.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{list.name}</span>
                      <Badge variant="secondary" className="ml-2">
                        {list._count?.apartments || 0}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      {!selectedListId ? (
        <Card className="p-12 text-center">
          <h3 className="text-xl font-semibold mb-2">Select a List</h3>
          <p className="text-muted-foreground">
            Choose a list from the dropdown to start scoring apartments
          </p>
        </Card>
      ) : apartmentsLoading ? (
        <div className="flex items-center justify-center h-[600px]">
          <Skeleton className="h-full w-full max-w-md" />
        </div>
      ) : apartments.length === 0 ? (
        <Card className="p-12 text-center">
          <h3 className="text-xl font-semibold mb-2">No Apartments</h3>
          <p className="text-muted-foreground">
            This list doesn't have any apartments yet.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Progress */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                Apartment {currentIndex + 1} of {apartments.length}
                {apartmentsData?.hasMore && "+"}
              </span>
              {(() => {
                const listItem = (apartmentsData as any).listItems?.find((item: any) => 
                  item.apartmentId === currentApartment?.id
                );
                if (listItem?.scoredAt) {
                  return (
                    <Badge variant="secondary" className="text-xs">
                      Previously scored
                    </Badge>
                  );
                }
                return null;
              })()}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevious}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNext}
                disabled={currentIndex === apartments.length - 1 && !apartmentsData?.hasMore}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Apartment Display */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Apartment Card */}
            <div>
              <AnimatePresence mode="wait">
                {currentApartment && (
                  <motion.div
                    key={currentApartment.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ApartmentCard
                      apartment={currentApartment as any}
                      variant="default"
                      listId={selectedListId}
                      animate={false}
                      onRemoveFromList={handleRemoveFromList}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {/* Scoring Panel */}
            <div>
              <Card className="p-6 sticky top-24">
                <h3 className="text-lg font-semibold mb-4">Rate this Apartment</h3>
                <div className="space-y-6">
                  {/* Location Score */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Location Score
                    </label>
                    <p className="text-xs text-muted-foreground mb-3">
                      How convenient is the location? Consider proximity to stations, shops, and amenities.
                    </p>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((score) => (
                          <Button
                            key={score}
                            variant={currentScore.location === score ? "default" : "outline"}
                            size="lg"
                            className="flex-1"
                            onClick={() => handleScoreChange('location', score)}
                          >
                            <Star className={`h-5 w-5 ${currentScore.location >= score ? 'fill-current' : ''}`} />
                          </Button>
                        ))}
                      </div>
                      <Button
                        variant={currentScore.location === 0 ? "secondary" : "ghost"}
                        size="sm"
                        className="w-full"
                        onClick={() => handleScoreChange('location', 0)}
                      >
                        TBD / Skip for now
                      </Button>
                    </div>
                  </div>
                  
                  {/* Design Score */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Design Score
                    </label>
                    <p className="text-xs text-muted-foreground mb-3">
                      How appealing is the apartment design? Consider layout, aesthetics, and overall feel.
                    </p>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((score) => (
                          <Button
                            key={score}
                            variant={currentScore.design === score ? "default" : "outline"}
                            size="lg"
                            className="flex-1"
                            onClick={() => handleScoreChange('design', score)}
                          >
                            <Star className={`h-5 w-5 ${currentScore.design >= score ? 'fill-current' : ''}`} />
                          </Button>
                        ))}
                      </div>
                      <Button
                        variant={currentScore.design === 0 ? "secondary" : "ghost"}
                        size="sm"
                        className="w-full"
                        onClick={() => handleScoreChange('design', 0)}
                      >
                        TBD / Skip for now
                      </Button>
                    </div>
                  </div>
                  
                  {/* Space Score */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Space Score
                    </label>
                    <p className="text-xs text-muted-foreground mb-3">
                      How spacious is the apartment? Consider room size, storage, and overall living space.
                    </p>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((score) => (
                          <Button
                            key={score}
                            variant={currentScore.space === score ? "default" : "outline"}
                            size="lg"
                            className="flex-1"
                            onClick={() => handleScoreChange('space', score)}
                          >
                            <Star className={`h-5 w-5 ${currentScore.space >= score ? 'fill-current' : ''}`} />
                          </Button>
                        ))}
                      </div>
                      <Button
                        variant={currentScore.space === 0 ? "secondary" : "ghost"}
                        size="sm"
                        className="w-full"
                        onClick={() => handleScoreChange('space', 0)}
                      >
                        TBD / Skip for now
                      </Button>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="pt-4 border-t space-y-2">
                    <div className="flex gap-2">
                      <Button 
                        className="flex-1" 
                        size="lg"
                        variant="outline"
                        onClick={handleSaveScore}
                      >
                        Save Current
                      </Button>
                      <Button 
                        className="flex-1" 
                        size="lg"
                        onClick={handleSaveAndNext}
                      >
                        Save & Next
                      </Button>
                    </div>
                    
                    <div className="text-xs text-center text-muted-foreground space-y-1">
                      {currentScore.location === 0 && currentScore.design === 0 && currentScore.space === 0 ? (
                        <p>No scores selected - will save as TBD</p>
                      ) : (
                        <>
                          <p>Location: {currentScore.location > 0 ? `${currentScore.location} stars` : 'TBD'}</p>
                          <p>Design: {currentScore.design > 0 ? `${currentScore.design} stars` : 'TBD'}</p>
                          <p>Space: {currentScore.space > 0 ? `${currentScore.space} stars` : 'TBD'}</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}