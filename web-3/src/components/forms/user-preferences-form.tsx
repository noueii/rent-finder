"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Label } from "~/components/ui/label";
import { Slider } from "~/components/ui/slider";
import { StationSearch } from "~/components/station-search";
import { StationBadge } from "~/components/station-badge";
import { PriceRangeInput } from "./price-range-input";
import { Settings, Save } from "lucide-react";
import { cn } from "~/lib/utils";
import { userPreferencesSchema, type UserPreferencesFormData } from "~/lib/validation/forms";
import type { StationWithLines } from "~/types/station";
import { useForm } from "react-hook-form";
import { Form, FormField, FormSubmit } from "~/presentation/components/forms";

interface UserPreferencesFormProps {
  onSubmit: (data: UserPreferencesFormData) => void;
  defaultValues?: Partial<UserPreferencesFormData>;
  loading?: boolean;
  className?: string;
}

export function UserPreferencesForm({
  onSubmit,
  defaultValues,
  loading,
  className,
}: UserPreferencesFormProps) {
  const [preferredStations, setPreferredStations] = React.useState<string[]>(
    defaultValues?.preferredStations ?? []
  );

  const {
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<UserPreferencesFormData>({
    resolver: zodResolver(userPreferencesSchema),
    defaultValues: {
      maxCommute: 30,
      preferredStations: [],
      priceRange: { min: undefined, max: undefined },
      sizeRange: { min: undefined, max: undefined },
      ...defaultValues,
    },
  });

  const maxCommute = watch("maxCommute");
  const priceRange = watch("priceRange");
  const sizeRange = watch("sizeRange");

  const handleStationSelect = (station: StationWithLines) => {
    if (!preferredStations.includes(station.id)) {
      const newStations = [...preferredStations, station.id];
      setPreferredStations(newStations);
      setValue("preferredStations", newStations, { shouldDirty: true });
    }
  };

  const handleStationRemove = (stationId: string) => {
    const newStations = preferredStations.filter(id => id !== stationId);
    setPreferredStations(newStations);
    setValue("preferredStations", newStations, { shouldDirty: true });
  };

  return (
    <Form
      onSubmit={handleSubmit(onSubmit)}
      className={className}
      title="Search Preferences"
      description="Set your default search preferences to save time on future searches"
      icon={Settings}
    >
      {/* Maximum Commute Time */}
      <FormField
        label={`Default Maximum Commute Time: ${maxCommute ?? 30} minutes`}
        error={errors.maxCommute?.message}
        description="This will be your default when searching by commute"
      >
        <Slider
          min={5}
          max={120}
          step={5}
          value={[maxCommute ?? 30]}
          onValueChange={(value) => setValue("maxCommute", value[0], { shouldDirty: true })}
          className="w-full"
        />
      </FormField>

      {/* Preferred Stations */}
      <FormField
        label="Preferred Stations"
        description="These stations will appear as quick options in search"
      >
        <StationSearch
          value=""
          onSelect={handleStationSelect}
          placeholder="Add stations you frequently commute to..."
        />
        {preferredStations.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {preferredStations.map((stationId) => (
              <StationBadge
                key={stationId}
                stationId={stationId}
                onRemove={() => handleStationRemove(stationId)}
              />
            ))}
          </div>
        )}
      </FormField>

      {/* Default Price Range */}
      <FormField
        label="Default Price Range"
        description="Leave empty to search all price ranges by default"
      >
        <PriceRangeInput
          minValue={priceRange?.min}
          maxValue={priceRange?.max}
          onMinChange={(value) => setValue("priceRange.min", value, { shouldDirty: true })}
          onMaxChange={(value) => setValue("priceRange.max", value, { shouldDirty: true })}
        />
      </FormField>

      {/* Default Size Range */}
      <FormField
        label="Default Size Range (m²)"
        description="Leave empty to search all sizes by default"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="size-min" className="text-sm text-muted-foreground">Minimum</Label>
            <input
              id="size-min"
              type="number"
              min={0}
              value={sizeRange?.min ?? ""}
              onChange={(e) => setValue("sizeRange.min", e.target.value ? Number(e.target.value) : undefined, { shouldDirty: true })}
              placeholder="20"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="size-max" className="text-sm text-muted-foreground">Maximum</Label>
            <input
              id="size-max"
              type="number"
              min={0}
              value={sizeRange?.max ?? ""}
              onChange={(e) => setValue("sizeRange.max", e.target.value ? Number(e.target.value) : undefined, { shouldDirty: true })}
              placeholder="100"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>
      </FormField>

      {/* Submit Button */}
      <FormSubmit
        loading={loading}
        loadingText="Saving..."
        icon={Save}
        disabled={!isDirty}
      >
        Save Preferences
      </FormSubmit>

      {isDirty && (
        <p className="text-sm text-muted-foreground text-center">
          You have unsaved changes
        </p>
      )}
    </Form>
  );
}