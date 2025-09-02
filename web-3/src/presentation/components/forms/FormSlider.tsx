"use client";

import * as React from "react";
import { Slider, type SliderProps } from "~/components/ui/slider";
import { FormField } from "./FormField";
import { cn } from "~/lib/utils";

interface FormSliderProps extends SliderProps {
  label: string | React.ReactNode;
  error?: string;
  description?: string;
  required?: boolean;
  fieldClassName?: string;
  sliderClassName?: string;
  icon?: React.ComponentType<{ className?: string }>;
  htmlFor?: string;
}

export function FormSlider({
  label,
  error,
  description,
  required,
  fieldClassName,
  sliderClassName,
  icon,
  htmlFor,
  className,
  ...sliderProps
}: FormSliderProps) {
  const sliderId = htmlFor || React.useId();
  
  return (
    <FormField
      label={label}
      error={error}
      description={description}
      required={required}
      className={fieldClassName}
      icon={icon}
      htmlFor={sliderId}
    >
      <Slider
        id={sliderId}
        className={cn("w-full", sliderClassName, className)}
        {...sliderProps}
      />
    </FormField>
  );
}