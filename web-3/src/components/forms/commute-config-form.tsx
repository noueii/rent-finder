"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Label } from "~/components/ui/label";
import { StationSearch } from "~/components/station-search";
import { StationBadge } from "~/components/station-badge";
import { Train, Clock, MapPin, Info } from "lucide-react";
import { cn } from "~/lib/utils";
import { commuteConfigSchema, type CommuteConfigFormData } from "~/lib/validation/forms";
import type { StationWithLines } from "~/types/station";
import { useForm } from "react-hook-form";
import { Form, FormField, FormSubmit, FormSlider } from "~/presentation/components/forms";

interface CommuteConfigFormProps {
  onSubmit: (data: CommuteConfigFormData) => void;
  defaultValues?: Partial<CommuteConfigFormData>;
  loading?: boolean;
  className?: string;
  showFilters?: boolean;
}

export function CommuteConfigForm({
  onSubmit,
  defaultValues,
  loading,
  className,
  showFilters = true,
}: CommuteConfigFormProps) {
  const {
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CommuteConfigFormData>({
    resolver: zodResolver(commuteConfigSchema),
    defaultValues: {
      maxCommuteMinutes: 30,
      ...defaultValues,
    },
  });

  const workplaceStationId = watch("workplaceStationId");
  const maxCommuteMinutes = watch("maxCommuteMinutes");

  return (
    <Form
      onSubmit={handleSubmit(onSubmit)}
      className={className}
      title="Commute Search Configuration"
      description="Find apartments based on your commute time"
      icon={Train}
    >
      {/* Workplace Station */}
      <FormField
        label="Your Workplace/School Station"
        icon={MapPin}
        error={errors.workplaceStationId?.message}
      >
        <StationSearch
          value={workplaceStationId}
          onSelect={(station) => setValue("workplaceStationId", station.id)}
          placeholder="Search for your destination station..."
        />
        {workplaceStationId && (
          <div className="mt-2">
            <StationBadge stationId={workplaceStationId} />
          </div>
        )}
      </FormField>

      {/* Maximum Commute Time */}
      <FormSlider
        label={
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Maximum Commute Time: {maxCommuteMinutes} minutes
          </span>
        }
        error={errors.maxCommuteMinutes?.message}
        min={5}
        max={120}
        step={5}
        value={[maxCommuteMinutes]}
        onValueChange={(value) => setValue("maxCommuteMinutes", value[0] ?? 30)}
      />
      <div className="flex justify-between text-sm text-muted-foreground -mt-4">
        <span>5 min</span>
        <span>30 min</span>
        <span>60 min</span>
        <span>90 min</span>
        <span>120 min</span>
      </div>

      {/* Info Box */}
      <div className="rounded-lg border bg-muted/50 p-4">
        <div className="flex gap-3">
          <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="space-y-2 text-sm">
            <p className="font-medium">How Commute Search Works:</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• We'll calculate all stations reachable within your time limit</li>
              <li>• Commute time includes walking to the station</li>
              <li>• Search will find apartments near all reachable stations</li>
              <li>• Results include actual commute time for each apartment</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Basic Filters (Optional) */}
      {showFilters && (
        <div className="space-y-4 border-t pt-4">
          <Label>Additional Filters (Optional)</Label>
          <p className="text-sm text-muted-foreground">
            You can apply additional filters after the search completes
          </p>
        </div>
      )}

      {/* Submit Button */}
      <FormSubmit
        loading={loading}
        loadingText="Starting Search..."
        icon={Train}
        disabled={!workplaceStationId}
      >
        Start Commute Search
      </FormSubmit>

      {loading && (
        <p className="text-sm text-muted-foreground text-center">
          This may take a few minutes as we calculate reachable stations and search for apartments...
        </p>
      )}
    </Form>
  );
}