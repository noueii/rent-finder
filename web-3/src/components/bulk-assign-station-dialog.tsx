"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { MapPin, Navigation, AlertCircle } from "lucide-react";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { StationSearch } from "./station-search";
import type { Station } from "@prisma/client";

interface BulkAssignStationDialogProps {
  listId: string;
  listName: string;
  apartmentCount: number;
  onSuccess?: () => void;
  trigger?: React.ReactNode;
}

export function BulkAssignStationDialog({
  listId,
  listName,
  apartmentCount,
  onSuccess,
  trigger,
}: BulkAssignStationDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedStation, setSelectedStation] = React.useState<Station | null>(null);

  const updateAllMutation = api.list.updateAllApartmentsPreferredStation.useMutation({
    onSuccess: (data) => {
      toast.success(`Updated ${data.updatedCount} apartments with preferred station`);
      setOpen(false);
      setSelectedStation(null);
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update apartments");
    },
  });

  const handleConfirm = () => {
    if (!selectedStation) {
      toast.error("Please select a station");
      return;
    }

    updateAllMutation.mutate({
      listId,
      stationId: selectedStation.id,
    });
  };

  const handleRemoveAll = () => {
    updateAllMutation.mutate({
      listId,
      stationId: null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Navigation className="mr-2 h-4 w-4" />
            Set Navigation Station
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Set Navigation Station for All Apartments</DialogTitle>
          <DialogDescription>
            Choose a station to use for Google Maps navigation for all {apartmentCount} apartments in "{listName}".
            This will override any individually set preferred stations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Station</label>
            <StationSearch
              onSelect={(station) => setSelectedStation(station)}
              placeholder="Search for a station..."
              className="w-full"
            />
          </div>

          {selectedStation && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-muted">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Selected:</span>
              <Badge variant="secondary">{selectedStation.name}</Badge>
            </div>
          )}

          <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3">
            <div className="flex gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <p className="font-medium mb-1">This will update all apartments</p>
                <p className="text-xs">
                  All {apartmentCount} apartments in this list will use {selectedStation ? selectedStation.name : "the selected station"} for navigation directions.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleRemoveAll}
            disabled={updateAllMutation.isPending}
            className="sm:mr-auto"
          >
            Remove All Stations
          </Button>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={updateAllMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedStation || updateAllMutation.isPending}
          >
            {updateAllMutation.isPending ? "Updating..." : "Apply to All"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}