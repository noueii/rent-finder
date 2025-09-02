"use client";

import * as React from "react";
import { Input, type InputProps } from "~/components/ui/input";
import { FormField, type FormFieldProps } from "./FormField";
import { cn } from "~/lib/utils";

interface FormInputProps extends Omit<InputProps, "className"> {
  label: string;
  error?: string;
  description?: string;
  required?: boolean;
  fieldClassName?: string;
  inputClassName?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  ({ 
    label, 
    error, 
    description, 
    required, 
    fieldClassName, 
    inputClassName,
    icon,
    id,
    ...inputProps 
  }, ref) => {
    const inputId = id || inputProps.name || React.useId();
    
    return (
      <FormField
        label={label}
        error={error}
        description={description}
        required={required}
        className={fieldClassName}
        icon={icon}
        htmlFor={inputId}
      >
        <Input
          ref={ref}
          id={inputId}
          className={cn(
            error && "border-destructive",
            inputClassName
          )}
          {...inputProps}
        />
      </FormField>
    );
  }
);

FormInput.displayName = "FormInput";