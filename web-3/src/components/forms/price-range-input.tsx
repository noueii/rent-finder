"use client";

import * as React from "react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";

interface PriceRangeInputProps {
  minValue?: number;
  maxValue?: number;
  onMinChange: (value: number | undefined) => void;
  onMaxChange: (value: number | undefined) => void;
  minError?: string;
  maxError?: string;
  className?: string;
}

export function PriceRangeInput({
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  minError,
  maxError,
  className,
}: PriceRangeInputProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="price-min">Min Price (¥)</Label>
          <Input
            id="price-min"
            type="number"
            min={0}
            value={minValue ?? ""}
            onChange={(e) => onMinChange(e.target.value ? Number(e.target.value) : undefined)}
            placeholder="0"
            className={cn(minError && "border-destructive")}
          />
          {minError && (
            <p className="text-sm text-destructive">{minError}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="price-max">Max Price (¥)</Label>
          <Input
            id="price-max"
            type="number"
            min={0}
            value={maxValue ?? ""}
            onChange={(e) => onMaxChange(e.target.value ? Number(e.target.value) : undefined)}
            placeholder="500,000"
            className={cn(maxError && "border-destructive")}
          />
          {maxError && (
            <p className="text-sm text-destructive">{maxError}</p>
          )}
        </div>
      </div>
    </div>
  );
}