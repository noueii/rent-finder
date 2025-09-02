"use client";

import * as React from "react";
import { Button, type ButtonProps } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";

interface FormSubmitProps extends Omit<ButtonProps, "type"> {
  loading?: boolean;
  loadingText?: string;
  icon?: LucideIcon;
  fullWidth?: boolean;
}

export function FormSubmit({
  children,
  loading = false,
  loadingText = "Loading...",
  icon: Icon,
  fullWidth = true,
  className,
  disabled,
  size = "lg",
  ...props
}: FormSubmitProps) {
  const isDisabled = loading || disabled;

  return (
    <Button
      type="submit"
      disabled={isDisabled}
      size={size}
      className={cn(fullWidth && "w-full", className)}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {loadingText}
        </>
      ) : (
        <>
          {Icon && <Icon className="mr-2 h-4 w-4" />}
          {children}
        </>
      )}
    </Button>
  );
}