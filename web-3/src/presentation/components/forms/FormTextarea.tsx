"use client";

import * as React from "react";
import { FormField } from "./FormField";
import { cn } from "~/lib/utils";

interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  description?: string;
  required?: boolean;
  fieldClassName?: string;
  textareaClassName?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export const FormTextarea = React.forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ 
    label, 
    error, 
    description, 
    required, 
    fieldClassName,
    textareaClassName,
    icon,
    id,
    ...textareaProps 
  }, ref) => {
    const textareaId = id || textareaProps.name || React.useId();
    
    return (
      <FormField
        label={label}
        error={error}
        description={description}
        required={required}
        className={fieldClassName}
        icon={icon}
        htmlFor={textareaId}
      >
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-destructive",
            textareaClassName
          )}
          {...textareaProps}
        />
      </FormField>
    );
  }
);

FormTextarea.displayName = "FormTextarea";