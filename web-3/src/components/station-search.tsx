"use client";

import * as React from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "~/components/ui/command";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { Icons } from "~/components/ui/icons";
import { useDebounce } from "~/presentation/hooks";
import type { StationWithLines } from "~/types/station";

interface StationSearchProps {
  value?: string; // Station ID
  onSelect?: (station: StationWithLines) => void;
  onChange?: (stationId: string | undefined) => void; // For clearing
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  preventAutoFocus?: boolean;
}

export function StationSearch({
  value,
  onSelect,
  onChange,
  placeholder = "Search stations...",
  className,
  disabled = false,
  preventAutoFocus = false,
}: StationSearchProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);
  
  // Get selected station details
  const { data: selectedStation } = api.station.getById.useQuery(
    { id: value! },
    { enabled: !!value }
  );
  
  // Update search when value changes (controlled component)
  React.useEffect(() => {
    if (selectedStation) {
      setSearch(selectedStation.nameEn || selectedStation.name);
    } else if (!value) {
      setSearch("");
    }
  }, [selectedStation, value]);

  // Always fetch all stations (they're cached)
  const { data: allStations = [], isLoading } = api.station.getAll.useQuery(undefined, { 
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });
  
  // Filter stations client-side using fuzzy search
  const stations = React.useMemo(() => {
    if (!debouncedSearch) return allStations.slice(0, 20);
    
    // Normalize string by removing spaces and special characters
    const normalize = (str: string): string => {
      return str.toLowerCase().replace(/[\s\-\.\,\(\)\'\"]/g, '');
    };
    
    // Import fuzzy search function inline to avoid circular dependency
    const fuzzyScore = (stationName: string, query: string): number => {
      const nameNormalized = normalize(stationName);
      const queryNormalized = normalize(query);
      
      if (nameNormalized === queryNormalized) return 1000;
      if (nameNormalized.startsWith(queryNormalized)) return 900;
      if (nameNormalized.includes(queryNormalized)) return 800;
      
      // Simple character matching on normalized strings
      let score = 0;
      let queryIndex = 0;
      for (let i = 0; i < nameNormalized.length && queryIndex < queryNormalized.length; i++) {
        if (nameNormalized[i] === queryNormalized[queryIndex]) {
          queryIndex++;
          score += 100;
        }
      }
      
      return queryIndex === queryNormalized.length ? score : 0;
    };
    
    const scored = allStations
      .map(station => ({
        station,
        score: Math.max(
          station.nameEn ? fuzzyScore(station.nameEn, debouncedSearch) : 0,
          fuzzyScore(station.name, debouncedSearch)
        )
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map(item => item.station);
    
    return scored;
  }, [allStations, debouncedSearch]);

  function handleSearchChange(searchValue: string) {
    setSearch(searchValue);
    // If user clears the input, notify parent
    if (!searchValue && value) {
      onChange?.(undefined);
    }
  }

  return (
    <div className={cn("relative w-full", className)}>
      <Command className="overflow-visible bg-transparent" shouldFilter={false}>
        <div className="relative">
          <CommandInput
            placeholder={placeholder}
            value={search}
            onValueChange={handleSearchChange}
            onFocus={(e) => {
              if (!disabled && !preventAutoFocus) {
                setOpen(true);
              }
            }}
            onBlur={() => {
              // Small delay to allow item selection
              setTimeout(() => setOpen(false), 200);
            }}
            disabled={disabled}
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          {isLoading && open && (
            <Icons.spinner className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        
        {open && (
          <div className="absolute top-full z-50 mt-2 w-full">
            <CommandList className="max-h-[400px] overflow-auto rounded-lg border bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95">
              {isLoading ? (
                <CommandEmpty className="flex items-center justify-center p-6 text-sm">
                  <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                  Loading stations...
                </CommandEmpty>
              ) : stations.length === 0 ? (
                <CommandEmpty className="p-6 text-center text-sm">
                  No stations found matching "{debouncedSearch}"
                </CommandEmpty>
              ) : (
                <CommandGroup>
                  {stations.map((station) => (
                    <CommandItem
                      key={station.id}
                      value={station.id}
                      onSelect={() => {
                        onSelect?.(station as StationWithLines);
                        setSearch(station.nameEn || station.name);
                        setOpen(false);
                      }}
                      className="flex cursor-pointer select-none items-start space-x-3 rounded-md px-2 py-3 outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-baseline justify-between">
                          <p className="text-sm font-medium leading-none">
                            {station.nameEn || station.name}
                          </p>
                          {station.nameEn && (
                            <p className="text-xs text-muted-foreground">
                              {station.name}
                            </p>
                          )}
                        </div>
                        {'lines' in station && (station as StationWithLines).lines?.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {(station as StationWithLines).lines.slice(0, 3).map(({ line }) => (
                              <span
                                key={line.id}
                                className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium shadow-sm"
                                style={{
                                  backgroundColor: `${line.color || '#6B7280'}20`,
                                  color: line.color || '#6B7280',
                                  border: `1px solid ${line.color || '#6B7280'}40`,
                                }}
                              >
                                {line.nameEn || line.name}
                              </span>
                            ))}
                            {(station as StationWithLines).lines.length > 3 && (
                              <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                +{(station as StationWithLines).lines.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </div>
        )}
      </Command>
      
      {selectedStation && !open && (
        <div className="mt-2 flex items-center space-x-2 rounded-md bg-muted/50 px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="flex-1 text-sm">
            <span className="font-medium">{selectedStation.nameEn || selectedStation.name}</span>
            {selectedStation.nameEn && (
              <span className="text-muted-foreground"> • {selectedStation.name}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}