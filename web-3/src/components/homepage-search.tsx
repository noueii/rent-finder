"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Search } from "lucide-react";
import { Card } from "~/components/ui/card";
import { StationSearch } from "~/components/station-search";
import type { StationWithLines } from "~/types/station";

export function HomepageSearch() {
  const router = useRouter();
  const [selectedStation, setSelectedStation] = React.useState<StationWithLines | null>(null);

  const handleQuickSearch = () => {
    if (selectedStation) {
      // Redirect to search page with the station ID
      router.push(`/search?stationId=${selectedStation.id}&station=${encodeURIComponent(selectedStation.nameEn || selectedStation.name)}`);
    }
  };

  const handleStationSelect = (station: StationWithLines) => {
    setSelectedStation(station);
  };

  return (
    <Card className="p-6">
      <div className="flex gap-4">
        <div className="flex-1">
          <StationSearch
            onSelect={handleStationSelect}
            placeholder="Enter your work/school station..."
          />
        </div>
        <Button 
          onClick={handleQuickSearch} 
          size="lg"
          disabled={!selectedStation}
        >
          <Search className="mr-2 h-5 w-5" />
          Search
        </Button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Search for your workplace or school station to find apartments within your ideal commute time
      </p>
    </Card>
  );
}