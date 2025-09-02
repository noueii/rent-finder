"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import type { LucideIcon } from "lucide-react";

interface FormProps {
  children: React.ReactNode;
  onSubmit: (e: React.FormEvent) => void;
  className?: string;
  card?: boolean;
  title?: string;
  description?: string;
  icon?: LucideIcon;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  animate?: boolean;
}

export function Form({
  children,
  onSubmit,
  className,
  card = true,
  title,
  description,
  icon: Icon,
  header,
  footer,
  animate = true,
}: FormProps) {
  const formContent = (
    <form onSubmit={onSubmit} className={cn("space-y-6", !card && className)}>
      {children}
    </form>
  );

  if (!card) {
    return formContent;
  }

  const content = (
    <Card className={cn("w-full", className)}>
      {(title || description || header) && (
        <CardHeader>
          {header || (
            <>
              {title && (
                <CardTitle className="flex items-center gap-2">
                  {Icon && <Icon className="h-5 w-5" />}
                  {title}
                </CardTitle>
              )}
              {description && <CardDescription>{description}</CardDescription>}
            </>
          )}
        </CardHeader>
      )}
      <CardContent>
        {formContent}
        {footer}
      </CardContent>
    </Card>
  );

  if (!animate) {
    return content;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {content}
    </motion.div>
  );
}