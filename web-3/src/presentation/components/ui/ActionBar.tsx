/**
 * Reusable Action Bar Component
 * For consistent action button layouts and interactions
 */

import * as React from "react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import type { LucideIcon } from "lucide-react";

export interface ActionItem {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: "default" | "ghost" | "outline" | "secondary" | "destructive";
  disabled?: boolean;
  loading?: boolean;
  tooltip?: string;
}

export interface ActionBarProps {
  actions: ActionItem[];
  variant?: "default" | "compact" | "floating" | "inline";
  size?: "sm" | "md" | "lg";
  align?: "start" | "center" | "end" | "between";
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export const ActionBar = React.forwardRef<HTMLDivElement, ActionBarProps>(
  (
    {
      actions,
      variant = "default",
      size = "md",
      align = "end",
      orientation = "horizontal",
      className,
    },
    ref
  ) => {
    const sizeMap = {
      sm: "sm" as const,
      md: "default" as const,
      lg: "lg" as const,
    };

    const alignMap = {
      start: "justify-start",
      center: "justify-center",
      end: "justify-end",
      between: "justify-between",
    };

    const baseClasses = cn(
      "flex gap-2",
      orientation === "vertical" ? "flex-col" : "flex-row",
      alignMap[align]
    );

    // Default variant
    if (variant === "default") {
      return (
        <div ref={ref} className={cn(baseClasses, className)}>
          {actions.map((action) => (
            <Button
              key={action.id}
              variant={action.variant || "outline"}
              size={sizeMap[size]}
              onClick={action.onClick}
              disabled={action.disabled || action.loading}
              title={action.tooltip}
            >
              <action.icon className={cn(
                size === "sm" && "h-3 w-3",
                size === "md" && "h-4 w-4",
                size === "lg" && "h-5 w-5",
                "mr-2"
              )} />
              {action.label}
            </Button>
          ))}
        </div>
      );
    }

    // Compact variant (icon only)
    if (variant === "compact") {
      return (
        <div ref={ref} className={cn(baseClasses, className)}>
          {actions.map((action) => (
            <Button
              key={action.id}
              variant={action.variant || "ghost"}
              size="icon"
              onClick={action.onClick}
              disabled={action.disabled || action.loading}
              title={action.tooltip || action.label}
              className={cn(
                size === "sm" && "h-8 w-8",
                size === "md" && "h-9 w-9",
                size === "lg" && "h-10 w-10"
              )}
            >
              <action.icon className={cn(
                size === "sm" && "h-3 w-3",
                size === "md" && "h-4 w-4",
                size === "lg" && "h-5 w-5"
              )} />
            </Button>
          ))}
        </div>
      );
    }

    // Floating variant
    if (variant === "floating") {
      return (
        <div
          ref={ref}
          className={cn(
            baseClasses,
            "backdrop-blur-sm bg-background/80 rounded-full p-1 shadow-lg",
            className
          )}
        >
          {actions.map((action) => (
            <Button
              key={action.id}
              variant={action.variant || "ghost"}
              size="icon"
              onClick={action.onClick}
              disabled={action.disabled || action.loading}
              title={action.tooltip || action.label}
              className="rounded-full"
            >
              <action.icon className={cn(
                size === "sm" && "h-3 w-3",
                size === "md" && "h-4 w-4",
                size === "lg" && "h-5 w-5"
              )} />
            </Button>
          ))}
        </div>
      );
    }

    // Inline variant (text links)
    if (variant === "inline") {
      return (
        <div ref={ref} className={cn(baseClasses, "items-center", className)}>
          {actions.map((action, index) => (
            <React.Fragment key={action.id}>
              {index > 0 && orientation === "horizontal" && (
                <span className="text-muted-foreground">•</span>
              )}
              <button
                onClick={action.onClick}
                disabled={action.disabled || action.loading}
                title={action.tooltip}
                className={cn(
                  "inline-flex items-center gap-1 text-sm hover:text-primary transition-colors",
                  action.disabled && "opacity-50 cursor-not-allowed",
                  action.variant === "destructive" && "text-destructive hover:text-destructive/80"
                )}
              >
                <action.icon className={cn(
                  size === "sm" && "h-3 w-3",
                  size === "md" && "h-4 w-4",
                  size === "lg" && "h-5 w-5"
                )} />
                {action.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      );
    }

    return null;
  }
);
ActionBar.displayName = "ActionBar";

// Quick action button component
export interface QuickActionProps {
  icon: LucideIcon;
  label?: string;
  onClick: () => void;
  active?: boolean;
  badge?: string | number;
  variant?: "default" | "primary" | "destructive";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const QuickAction = React.forwardRef<HTMLButtonElement, QuickActionProps>(
  (
    {
      icon: Icon,
      label,
      onClick,
      active = false,
      badge,
      variant = "default",
      size = "md",
      className,
    },
    ref
  ) => {
    const sizeClasses = {
      sm: "h-8 w-8",
      md: "h-10 w-10",
      lg: "h-12 w-12",
    };

    const iconSizes = {
      sm: "h-4 w-4",
      md: "h-5 w-5",
      lg: "h-6 w-6",
    };

    const variantClasses = {
      default: cn(
        "hover:bg-accent hover:text-accent-foreground",
        active && "bg-accent text-accent-foreground"
      ),
      primary: cn(
        "text-primary hover:bg-primary/10",
        active && "bg-primary/20"
      ),
      destructive: cn(
        "text-destructive hover:bg-destructive/10",
        active && "bg-destructive/20"
      ),
    };

    return (
      <button
        ref={ref}
        onClick={onClick}
        className={cn(
          "relative inline-flex items-center justify-center rounded-full transition-colors",
          sizeClasses[size],
          variantClasses[variant],
          className
        )}
        title={label}
      >
        <Icon className={iconSizes[size]} />
        {badge !== undefined && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center">
            {badge}
          </span>
        )}
      </button>
    );
  }
);
QuickAction.displayName = "QuickAction";