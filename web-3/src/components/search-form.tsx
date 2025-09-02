"use client";

import * as React from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Slider } from "~/components/ui/slider";
import { StationSearch } from "./station-search";
import { Search, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import type { SearchFilters, CommuteSearch } from "~/types";
import type { StationWithLines } from "~/types/station";
import { SearchStateManager } from "~/presentation/services";
import { Form, FormField, FormSubmit } from "~/presentation/components/forms";
import { motion } from "framer-motion";

interface SearchFormProps {
  onSearch: (search: CommuteSearch) => void;
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
];

export function SearchForm({ onSearch, loading, className }: SearchFormProps) {
  const [workStationId, setWorkStationId] = React.useState<string>("");
  const [maxCommuteMinutes, setMaxCommuteMinutes] = React.useState(30);
  const [priceRange, setPriceRange] = React.useState([50000, 200000]);
  const [sizeRange, setSizeRange] = React.useState([20, 80]);
  const [selectedLayouts, setSelectedLayouts] = React.useState<string[]>([]);
  const [maxWalkingMinutes, setMaxWalkingMinutes] = React.useState(10);
  const [maxAge, setMaxAge] = React.useState<number | undefined>();
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workStationId) return;

    const filters: SearchFilters = {
      priceMin: priceRange[0],
      priceMax: priceRange[1],
      sizeMin: sizeRange[0],
      sizeMax: sizeRange[1],
      layout: selectedLayouts.length > 0 ? selectedLayouts : undefined,
      maxWalkingMinutes,
      buildingAge: maxAge || undefined,
    };

    onSearch({
      workplaceStationId: workStationId,
      maxCommuteMinutes,
      filters,
    });
  };

  const handleReset = () => {
    setWorkStationId("");
    setMaxCommuteMinutes(30);
    setPriceRange([50000, 200000]);
    setSizeRange([20, 80]);
    setSelectedLayouts([]);
    setMaxWalkingMinutes(10);
    setMaxAge(undefined);
  };

  return (
    <Form
      onSubmit={handleSubmit}
      className={className}
      title="Search Apartments by Commute"
      icon={Search}
      header={
        <div className="flex items-center justify-between w-full">
          <span className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Apartments by Commute
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset All
          </Button>
        </div>
      }
    >
      {/* Commute Search Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Commute Search (Optional)</h3>
        
        <FormField
          label="Your Work/School Station"
          htmlFor="work-station"
        >
          <StationSearch
            value={workStationId}
            onSelect={(station) => setWorkStationId(station.id)}
            placeholder="Search for a station..."
          />
        </FormField>

        <FormField
          label={`Maximum Commute Time: ${maxCommuteMinutes} minutes`}
          htmlFor="commute-time"
        >
          <Slider
            id="commute-time"
            min={10}
            max={90}
            step={5}
            value={[maxCommuteMinutes]}
            onValueChange={(value) => setMaxCommuteMinutes(value[0] ?? 30)}
            className="w-full"
          />
        </FormField>
      </div>

      {/* Basic Filters */}
      <div className="space-y-4 border-t pt-4">
        <h3 className="text-sm font-medium">Basic Filters</h3>
        
        <FormField
          label={`Price Range: ¥${priceRange[0]?.toLocaleString()} - ¥${priceRange[1]?.toLocaleString()}`}
        >
          <Slider
            min={30000}
            max={500000}
            step={10000}
            value={priceRange}
            onValueChange={setPriceRange}
            className="w-full"
          />
        </FormField>

        <FormField
          label={`Size Range: ${sizeRange[0]}m² - ${sizeRange[1]}m²`}
        >
          <Slider
            min={10}
            max={150}
            step={5}
            value={sizeRange}
            onValueChange={setSizeRange}
            className="w-full"
          />
        </FormField>

        <FormField label="Layout Types">
          <div className="flex flex-wrap gap-2">
            {LAYOUT_OPTIONS.map((layout) => (
              <Button
                key={layout.value}
                type="button"
                variant={selectedLayouts.includes(layout.value) ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectedLayouts((prev) =>
                    prev.includes(layout.value)
                      ? prev.filter((l) => l !== layout.value)
                      : [...prev, layout.value]
                  );
                }}
              >
                {layout.label}
              </Button>
            ))}
          </div>
        </FormField>
      </div>

      {/* Advanced Filters */}
      <div className="border-t pt-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="mb-4"
        >
          {showAdvanced ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
          {showAdvanced ? "Hide" : "Show"} Advanced Filters
        </Button>

        {showAdvanced && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <FormField
              label={`Maximum Walking Time to Station: ${maxWalkingMinutes} minutes`}
              htmlFor="walking-time"
            >
              <Slider
                id="walking-time"
                min={1}
                max={20}
                step={1}
                value={[maxWalkingMinutes]}
                onValueChange={(value) => setMaxWalkingMinutes(value[0] ?? 10)}
                className="w-full"
              />
            </FormField>

            <FormField
              label="Maximum Building Age (years)"
              htmlFor="building-age"
            >
              <Input
                id="building-age"
                type="number"
                min={0}
                max={50}
                value={maxAge || ""}
                onChange={(e) => setMaxAge(e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="Any age"
              />
            </FormField>
          </motion.div>
        )}
      </div>

      <FormSubmit
        loading={loading}
        loadingText="Searching..."
        icon={Search}
        disabled={!workStationId}
      >
        Search Apartments
      </FormSubmit>
    </Form>
  );
}