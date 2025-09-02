"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";
import type { LucideIcon } from "lucide-react";

interface FormFieldProps {
  children: React.ReactNode;
  label?: string;
  error?: string;
  description?: string;
  required?: boolean;
  className?: string;
  icon?: LucideIcon;
  htmlFor?: string;
}

export function FormField({
  children,
  label,
  error,
  description,
  required,
  className,
  icon: Icon,
  htmlFor,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label
          htmlFor={htmlFor}
          className={cn("flex items-center gap-2", error && "text-destructive")}
        >
          {Icon && <Icon className="h-4 w-4" />}
          {label}
          {required && <span className="text-destructive">*</span>}
        </Label>
      )}
      
      {children}
      
      <AnimatePresence mode="wait">
        {error && (
          <FormError error={error} />
        )}
        {!error && description && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-sm text-muted-foreground"
          >
            {description}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// Separate FormError component for reusability
export function FormError({ error, className }: { error: string; className?: string }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn("text-sm text-destructive", className)}
      role="alert"
    >
      {error}
    </motion.p>
  );
}