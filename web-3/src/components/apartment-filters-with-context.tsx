"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Slider } from "~/components/ui/slider";
import { Card } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { StationSearch } from "~/components/station-search";
import { StationBadge } from "~/components/station-badge";
import { PriceRangeInput } from "~/components/forms/price-range-input";
import { RotateCcw, X, Train, Clock, Bookmark, Heart, EyeOff, Lock, ChevronDown } from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useSearch } from "~/contexts/SearchContext";
import { useUserPreferences } from "~/contexts/UserPreferencesContext";

interface ApartmentFiltersWithContextProps {
  className?: string;
  onSearchButtonClick?: (searchType: 'standard' | 'commute') => void;
  showApplyButton?: boolean;
  collapsible?: boolean;
  showClientSideFilters?: boolean;
  showCommuteSearch?: boolean;
  showCommuteTimeFilter?: boolean;
  context?: 'home' | 'search' | 'userlist';
}

const LAYOUT_OPTIONS = [
  { value: "1R", label: "1R" },
  { value: "1K", label: "1K" },
  { value: "1DK", label: "1DK" },
  { value: "1LDK", label: "1LDK" },
  { value: "2K", label: "2K" },
  { value: "2DK", label: "2DK" },
  { value: "2LDK", label: "2LDK" },
  { value: "3K", label: "3K" },
  { value: "3DK", label: "3DK" },
  { value: "3LDK", label: "3LDK" },
  { value: "4LDK+", label: "4LDK+" },
];

export function ApartmentFiltersWithContext({
  className,
  onSearchButtonClick,
  showApplyButton = false,
  collapsible = false,
  showClientSideFilters = false,
  showCommuteSearch = true,
  showCommuteTimeFilter = false,
  context = 'search',
}: ApartmentFiltersWithContextProps) {
  const { data: session } = useSession();
  
  // Use context hooks
  const {
    filters,
    updateFilters,
    resetFilters,
    commuteFilters,
    updateCommuteFilters,
    setWorkplaceStation,
    searchMode,
    selectedStations,
    addStation,
    removeStation,
  } = useSearch();
  
  const {
    clientSideFilters,
    updateClientSideFilters,
    showBookmarked,
    showLiked,
    hideViewed,
    setShowBookmarked,
    setShowLiked,
    setHideViewed,
  } = useUserPreferences();
  
  // Local state for UI-specific things
  const [wardFilterOpen, setWardFilterOpen] = React.useState(false);
  
  // Fetch available wards from database
  const { data: availableWards = [] } = api.apartment.getAvailableWards.useQuery();
  
  const toggleLayout = (layoutValue: string) => {
    const current = filters.layout || [];
    const updated = current.includes(layoutValue)
      ? current.filter(l => l !== layoutValue)
      : [...current, layoutValue];
    updateFilters({ layout: updated });
  };
  
  const toggleWard = (ward: string) => {
    const current = filters.excludeWards || [];
    const updated = current.includes(ward)
      ? current.filter(w => w !== ward)
      : [...current, ward];
    updateFilters({ excludeWards: updated });
  };
  
  const handleReset = () => {
    resetFilters();
  };
  
  const handleSearch = () => {
    if (onSearchButtonClick) {
      onSearchButtonClick(searchMode);
    }
  };
  
  const filterContent = (
    <div className="space-y-4">
      {/* Commute Search Section */}
      {showCommuteSearch && (
        <Card className={cn("p-4", !session && "opacity-60")}>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <Train className="h-4 w-4 flex-shrink-0" />
                <Label className="text-base font-semibold">Commute Search</Label>
              </div>
              {!session && <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
            </div>
            
            {!session ? (
              <p className="text-sm text-muted-foreground">
                Sign in to search by commute time from your workplace
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="workplace-station">Workplace Station</Label>
                  <StationSearch
                    onSelect={setWorkplaceStation}
                    placeholder="Select your workplace station..."
                    disabled={!session}
                  />
                  {commuteFilters.workplaceStationId && (
                    <div className="mt-2">
                      <StationBadge
                        stationId={commuteFilters.workplaceStationId}
                        onRemove={() => updateCommuteFilters({ workplaceStationId: undefined })}
                      />
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Clock className="h-4 w-4 flex-shrink-0" />
                    <span>Max Commute Time: {commuteFilters.maxCommuteMinutes} min</span>
                  </Label>
                  <Slider
                    min={10}
                    max={90}
                    step={5}
                    value={[commuteFilters.maxCommuteMinutes || 30]}
                    onValueChange={(value) => updateCommuteFilters({ maxCommuteMinutes: value[0] })}
                    disabled={!session}
                    className="w-full"
                  />
                </div>
              </>
            )}
          </div>
        </Card>
      )}

      {/* Price Range */}
      <div className="space-y-2">
        <Label>Price Range (¥/month)</Label>
        <PriceRangeInput
          minValue={filters.priceMin}
          maxValue={filters.priceMax}
          onMinChange={(value) => updateFilters({ priceMin: value })}
          onMaxChange={(value) => updateFilters({ priceMax: value })}
        />
      </div>

      {/* 2-Year Monthly Average Range */}
      <div className="space-y-2">
        <Label>2-Year Monthly Average (¥/month)</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            min={0}
            value={filters.twoYearAvgMin || ""}
            onChange={(e) => updateFilters({ 
              twoYearAvgMin: e.target.value ? parseInt(e.target.value) : undefined 
            })}
            placeholder="Min"
          />
          <Input
            type="number"
            min={0}
            value={filters.twoYearAvgMax || ""}
            onChange={(e) => updateFilters({ 
              twoYearAvgMax: e.target.value ? parseInt(e.target.value) : undefined 
            })}
            placeholder="Max"
          />
        </div>
      </div>

      {/* Size Range */}
      <div className="space-y-2">
        <Label>Size Range (m²)</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            min={0}
            value={filters.sizeMin || ""}
            onChange={(e) => updateFilters({ 
              sizeMin: e.target.value ? parseFloat(e.target.value) : undefined 
            })}
            placeholder="Min"
          />
          <Input
            type="number"
            min={0}
            value={filters.sizeMax || ""}
            onChange={(e) => updateFilters({ 
              sizeMax: e.target.value ? parseFloat(e.target.value) : undefined 
            })}
            placeholder="Max"
          />
        </div>
      </div>

      {/* Layout Types */}
      <div className="space-y-2">
        <Label>Layout</Label>
        <div className="grid grid-cols-4 gap-2">
          {LAYOUT_OPTIONS.map((layout) => (
            <Button
              key={layout.value}
              type="button"
              variant={filters.layout?.includes(layout.value) ? "default" : "outline"}
              size="sm"
              onClick={() => toggleLayout(layout.value)}
              className="h-8"
            >
              {layout.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Station Selection - show for userlist context or standard search */}
      {(context === 'userlist' || searchMode === 'standard') && (
        <div className="space-y-2">
          <Label>Near Stations</Label>
          <StationSearch
            value=""
            onSelect={(station) => addStation(station.id)}
            placeholder="Add stations..."
            className="w-full"
          />
          {selectedStations.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {selectedStations.map((stationId) => (
                <StationBadge
                  key={stationId}
                  stationId={stationId}
                  onRemove={() => removeStation(stationId)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Building Age */}
      <div className="space-y-2">
        <Label>Max Building Age (years)</Label>
        <Input
          type="number"
          min={0}
          max={100}
          value={filters.buildingAge || ""}
          onChange={(e) => updateFilters({ 
            buildingAge: e.target.value ? parseInt(e.target.value) : undefined 
          })}
          placeholder="Any age"
        />
      </div>

      {/* Ward Exclusion Filter */}
      <div className="space-y-2">
        <Label>Exclude Wards</Label>
        <Collapsible open={wardFilterOpen} onOpenChange={setWardFilterOpen}>
          <CollapsibleTrigger asChild>
            <Button 
              variant="outline" 
              className="w-full justify-between"
              type="button"
            >
              <span>
                {filters.excludeWards?.length ? 
                  `${filters.excludeWards.length} ward${filters.excludeWards.length > 1 ? 's' : ''} excluded`
                  : 'Select wards to exclude'
                }
              </span>
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform",
                wardFilterOpen && "rotate-180"
              )} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <Card className="p-3">
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {availableWards.map((ward) => (
                    <div key={ward} className="flex items-center space-x-2">
                      <Checkbox
                        id={`ward-${ward}`}
                        checked={filters.excludeWards?.includes(ward) || false}
                        onCheckedChange={() => toggleWard(ward)}
                      />
                      <label
                        htmlFor={`ward-${ward}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {ward}
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              {filters.excludeWards?.length ? (
                <div className="mt-3 pt-3 border-t">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => updateFilters({ excludeWards: [] })}
                    className="w-full"
                  >
                    Clear all
                  </Button>
                </div>
              ) : null}
            </Card>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Commute Time Filter - only for search result lists */}
      {showCommuteTimeFilter && (
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Max Commute Time: {filters.maxCommuteMinutes || 60} min
          </Label>
          <Slider
            min={10}
            max={120}
            step={5}
            value={[filters.maxCommuteMinutes || 60]}
            onValueChange={(value) => updateFilters({ maxCommuteMinutes: value[0] })}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>10 min</span>
            <span>60 min</span>
            <span>120 min</span>
          </div>
        </div>
      )}

      {/* Client-side Filters */}
      {showClientSideFilters && (
        <Card className="p-4">
          <Label className="mb-3 block text-base font-semibold">Filter Results</Label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showBookmarked}
                onChange={(e) => setShowBookmarked(e.target.checked)}
                className="rounded"
              />
              <span className="flex items-center gap-2 text-sm">
                <Bookmark className="h-4 w-4" />
                Show only bookmarked
              </span>
            </label>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showLiked}
                onChange={(e) => setShowLiked(e.target.checked)}
                className="rounded"
              />
              <span className="flex items-center gap-2 text-sm">
                <Heart className="h-4 w-4" />
                Show only liked
              </span>
            </label>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hideViewed}
                onChange={(e) => setHideViewed(e.target.checked)}
                className="rounded"
              />
              <span className="flex items-center gap-2 text-sm">
                <EyeOff className="h-4 w-4" />
                Hide viewed apartments
              </span>
            </label>
          </div>
        </Card>
      )}

      {/* Action Buttons - only show if requested */}
      {(showApplyButton || onSearchButtonClick) && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="flex-1"
          >
            <RotateCcw className="mr-2 h-3 w-3" />
            Reset
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSearch}
            className="flex-1"
            disabled={searchMode === 'commute' && !commuteFilters.workplaceStationId}
          >
            {searchMode === 'commute' 
              ? (context === 'userlist' ? 'Create Commute List' : 'Search by Commute') 
              : 'Apply Filters'}
          </Button>
        </div>
      )}
    </div>
  );

  if (collapsible) {
    const [isExpanded, setIsExpanded] = React.useState(true);
    
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Filters</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <X className="h-4 w-4" /> : "Show"}
          </Button>
        </div>
        {isExpanded && filterContent}
      </div>
    );
  }

  return (
    <div className={cn(className)}>
      {filterContent}
    </div>
  );
}