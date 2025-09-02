"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { SelectItem } from "~/components/ui/select";
import { StationSearch } from "~/components/station-search";
import { StationBadge } from "~/components/station-badge";
import { PriceRangeInput } from "./price-range-input";
import { Filter, RotateCcw } from "lucide-react";
import { cn } from "~/lib/utils";
import { advancedFilterSchema, type AdvancedFilterFormData } from "~/lib/validation/forms";
import type { StationWithLines } from "~/types/station";
import { useForm } from "react-hook-form";
import { Form, FormField, FormSubmit, FormInput, FormSlider, FormSelect } from "~/presentation/components/forms";

interface AdvancedFilterFormProps {
  onSubmit: (data: AdvancedFilterFormData) => void;
  defaultValues?: Partial<AdvancedFilterFormData>;
  loading?: boolean;
  className?: string;
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

const AMENITY_OPTIONS = [
  { value: "pet_allowed", label: "Pet Allowed" },
  { value: "parking", label: "Parking" },
  { value: "bicycle_parking", label: "Bicycle Parking" },
  { value: "auto_lock", label: "Auto Lock" },
  { value: "delivery_box", label: "Delivery Box" },
  { value: "balcony", label: "Balcony" },
  { value: "air_conditioning", label: "Air Conditioning" },
  { value: "floor_heating", label: "Floor Heating" },
  { value: "bath_toilet_separate", label: "Bath/Toilet Separate" },
  { value: "washroom_separate", label: "Washroom Separate" },
  { value: "storage", label: "Storage Room" },
  { value: "security_camera", label: "Security Camera" },
];

export function AdvancedFilterForm({
  onSubmit,
  defaultValues,
  loading,
  className,
}: AdvancedFilterFormProps) {
  const [selectedStations, setSelectedStations] = React.useState<string[]>(defaultValues?.stationIds ?? []);
  
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<AdvancedFilterFormData>({
    resolver: zodResolver(advancedFilterSchema),
    defaultValues: {
      layout: [],
      amenities: [],
      stationIds: [],
      ...defaultValues,
    },
  });

  const selectedLayouts = watch("layout") ?? [];
  const selectedAmenities = watch("amenities") ?? [];

  const handleStationSelect = (station: StationWithLines) => {
    if (!selectedStations.includes(station.id)) {
      const newStations = [...selectedStations, station.id];
      setSelectedStations(newStations);
      setValue("stationIds", newStations);
    }
  };

  const handleStationRemove = (stationId: string) => {
    const newStations = selectedStations.filter(id => id !== stationId);
    setSelectedStations(newStations);
    setValue("stationIds", newStations);
  };

  const toggleLayout = (layout: string) => {
    const current = selectedLayouts ?? [];
    const updated = current.includes(layout)
      ? current.filter(l => l !== layout)
      : [...current, layout];
    setValue("layout", updated);
  };

  const toggleAmenity = (amenity: string) => {
    const current = selectedAmenities ?? [];
    const updated = current.includes(amenity)
      ? current.filter(a => a !== amenity)
      : [...current, amenity];
    setValue("amenities", updated);
  };

  const handleReset = () => {
    reset();
    setSelectedStations([]);
  };

  return (
    <Form
      onSubmit={handleSubmit(onSubmit)}
      className={className}
      title="Advanced Filters"
      description="Fine-tune your apartment search with detailed criteria"
      icon={Filter}
      header={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Advanced Filters
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </div>
      }
    >
      {/* Price Range */}
      <FormField
        label="Price Range"
        error={errors.priceMax?.message}
      >
        <PriceRangeInput
          minValue={watch("priceMin")}
          maxValue={watch("priceMax")}
          onMinChange={(value) => setValue("priceMin", value)}
          onMaxChange={(value) => setValue("priceMax", value)}
          minError={errors.priceMin?.message}
          maxError={errors.priceMax?.message}
        />
      </FormField>

      {/* Size Range */}
      <FormField
        label="Size Range (m²)"
        error={errors.sizeMax?.message}
      >
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            label="Minimum"
            type="number"
            min={0}
            {...register("sizeMin", { valueAsNumber: true })}
            placeholder="20"
            fieldClassName="space-y-2"
          />
          <FormInput
            label="Maximum"
            type="number"
            min={0}
            {...register("sizeMax", { valueAsNumber: true })}
            placeholder="100"
            fieldClassName="space-y-2"
          />
        </div>
      </FormField>

      {/* Layout Types */}
      <FormField label="Layout Types">
        <div className="flex flex-wrap gap-2">
          {LAYOUT_OPTIONS.map((layout) => (
            <Button
              key={layout.value}
              type="button"
              variant={selectedLayouts?.includes(layout.value) ? "default" : "outline"}
              size="sm"
              onClick={() => toggleLayout(layout.value)}
            >
              {layout.label}
            </Button>
          ))}
        </div>
      </FormField>

      {/* Preferred Stations */}
      <FormField label="Preferred Stations">
        <StationSearch
          value=""
          onSelect={handleStationSelect}
          placeholder="Add preferred stations..."
        />
        {selectedStations.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {selectedStations.map((stationId) => (
              <StationBadge
                key={stationId}
                stationId={stationId}
                onRemove={() => handleStationRemove(stationId)}
              />
            ))}
          </div>
        )}
      </FormField>


      {/* Building Age */}
      <FormInput
        label="Maximum Building Age (years)"
        error={errors.maxAge?.message}
        type="number"
        min={0}
        max={100}
        {...register("maxAge", { valueAsNumber: true })}
        placeholder="Any age"
      />

      {/* Amenities */}
      <FormField label="Required Amenities">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {AMENITY_OPTIONS.map((amenity) => (
            <label
              key={amenity.value}
              className="flex items-center space-x-2 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedAmenities?.includes(amenity.value) ?? false}
                onChange={() => toggleAmenity(amenity.value)}
                className="rounded border-gray-300"
              />
              <span className="text-sm">{amenity.label}</span>
            </label>
          ))}
        </div>
      </FormField>

      {/* Availability */}
      <FormSelect
        label="Availability"
        htmlFor="availability"
        value={watch("availability")}
        onValueChange={(value) => setValue("availability", value as any)}
        placeholder="All listings"
      >
        <SelectItem value="all">All listings</SelectItem>
        <SelectItem value="available">Available only</SelectItem>
        <SelectItem value="occupied">Occupied only</SelectItem>
        <SelectItem value="unknown">Unknown status</SelectItem>
      </FormSelect>

      {/* Submit Button */}
      <FormSubmit
        loading={loading}
        loadingText="Applying Filters..."
        icon={Filter}
      >
        Apply Filters
      </FormSubmit>
    </Form>
  );
}