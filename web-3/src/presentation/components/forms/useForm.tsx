"use client";

import * as React from "react";
import { 
  useForm as useReactHookForm, 
  type UseFormProps as ReactHookFormProps,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodSchema } from "zod";

interface UseFormProps<TFieldValues extends FieldValues = FieldValues> 
  extends Omit<ReactHookFormProps<TFieldValues>, "resolver"> {
  schema?: ZodSchema<TFieldValues>;
}

export function useForm<TFieldValues extends FieldValues = FieldValues>({
  schema,
  ...props
}: UseFormProps<TFieldValues> = {}): UseFormReturn<TFieldValues> {
  return useReactHookForm<TFieldValues>({
    ...props,
    resolver: schema ? zodResolver(schema) : undefined,
  });
}

// Additional form utilities
export function useFormField<TFieldValues extends FieldValues = FieldValues>(
  form: UseFormReturn<TFieldValues>,
  name: keyof TFieldValues
) {
  const fieldState = form.getFieldState(name as any);
  const value = form.watch(name as any);
  
  return {
    value,
    error: fieldState.error?.message,
    isDirty: fieldState.isDirty,
    isTouched: fieldState.isTouched,
    isValid: !fieldState.error,
  };
}

// Form reset with animation helper
export function useFormReset<TFieldValues extends FieldValues = FieldValues>(
  form: UseFormReturn<TFieldValues>
) {
  const [isResetting, setIsResetting] = React.useState(false);

  const reset = React.useCallback(
    async (values?: TFieldValues) => {
      setIsResetting(true);
      // Small delay for animation
      await new Promise(resolve => setTimeout(resolve, 150));
      form.reset(values);
      setIsResetting(false);
    },
    [form]
  );

  return { reset, isResetting };
}

// Form submission with loading state
export function useFormSubmit<TFieldValues extends FieldValues = FieldValues>(
  onSubmit: (data: TFieldValues) => void | Promise<void>
) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const handleSubmit = React.useCallback(
    async (data: TFieldValues) => {
      setIsSubmitting(true);
      setSubmitError(null);
      
      try {
        await onSubmit(data);
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "An error occurred");
      } finally {
        setIsSubmitting(false);
      }
    },
    [onSubmit]
  );

  return {
    handleSubmit,
    isSubmitting,
    submitError,
  };
}