"use client";

import * as React from "react";
import { Select, SelectContent, SelectTrigger, SelectValue } from "~/components/ui/select";
import { FormField } from "./FormField";
import { cn } from "~/lib/utils";

interface FormSelectProps {
  label: string;
  error?: string;
  description?: string;
  required?: boolean;
  fieldClassName?: string;
  selectClassName?: string;
  placeholder?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  htmlFor?: string;
}

export function FormSelect({
  label,
  error,
  description,
  required,
  fieldClassName,
  selectClassName,
  placeholder,
  value,
  onValueChange,
  children,
  disabled,
  icon,
  htmlFor,
}: FormSelectProps) {
  const selectId = htmlFor || React.useId();
  
  return (
    <FormField
      label={label}
      error={error}
      description={description}
      required={required}
      className={fieldClassName}
      icon={icon}
      htmlFor={selectId}
    >
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger 
          id={selectId}
          className={cn(
            error && "border-destructive",
            selectClassName
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {children}
        </SelectContent>
      </Select>
    </FormField>
  );
}