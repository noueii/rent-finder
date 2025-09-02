/**
 * Reusable Price Component
 * For displaying prices, costs, and monetary values
 */

import * as React from "react";
import { cn } from "~/lib/utils";
import { Badge } from "./Badge";
import { Calculator, TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface PriceProps {
  value: number;
  currency?: string;
  locale?: string;
  variant?: "default" | "badge" | "compact" | "detailed";
  size?: "sm" | "md" | "lg";
  showTrend?: boolean;
  previousValue?: number;
  label?: string;
  suffix?: string; // e.g., "/mo", "/year"
  className?: string;
}

export const Price = React.forwardRef<HTMLDivElement, PriceProps>(
  (
    {
      value,
      currency = "JPY",
      locale = "ja-JP",
      variant = "default",
      size = "md",
      showTrend = false,
      previousValue,
      label,
      suffix,
      className,
    },
    ref
  ) => {
    const formatted = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

    const sizeClasses = {
      sm: "text-sm",
      md: "text-base",
      lg: "text-lg",
    };

    const iconSize = {
      sm: "h-3 w-3",
      md: "h-4 w-4",
      lg: "h-5 w-5",
    };

    // Calculate trend
    let TrendIcon: LucideIcon | null = null;
    let trendColor = "";
    let trendPercentage = 0;
    
    if (showTrend && previousValue !== undefined && previousValue !== value) {
      const difference = value - previousValue;
      trendPercentage = Math.round((difference / previousValue) * 100);
      
      if (difference > 0) {
        TrendIcon = TrendingUp;
        trendColor = "text-red-500";
      } else if (difference < 0) {
        TrendIcon = TrendingDown;
        trendColor = "text-green-500";
      } else {
        TrendIcon = Minus;
        trendColor = "text-muted-foreground";
      }
    }

    // Badge variant
    if (variant === "badge") {
      return (
        <Badge size={size} className={className}>
          {label && <span className="mr-1">{label}:</span>}
          {formatted}
          {suffix && <span className="ml-0.5">{suffix}</span>}
        </Badge>
      );
    }

    // Compact variant
    if (variant === "compact") {
      return (
        <span
          ref={ref}
          className={cn(
            "font-semibold",
            sizeClasses[size],
            className
          )}
        >
          {formatted}
          {suffix && <span className="font-normal">{suffix}</span>}
        </span>
      );
    }

    // Detailed variant
    if (variant === "detailed") {
      return (
        <div ref={ref} className={cn("space-y-1", className)}>
          {label && (
            <p className="text-xs text-muted-foreground">{label}</p>
          )}
          <div className="flex items-baseline gap-2">
            <span className={cn("font-semibold", sizeClasses[size])}>
              {formatted}
            </span>
            {suffix && (
              <span className={cn("text-muted-foreground", sizeClasses[size])}>
                {suffix}
              </span>
            )}
            {TrendIcon && (
              <div className={cn("flex items-center gap-1", trendColor)}>
                <TrendIcon className={iconSize[size]} />
                <span className="text-xs">{Math.abs(trendPercentage)}%</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Default variant
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-baseline gap-1",
          sizeClasses[size],
          className
        )}
      >
        {label && <span className="text-muted-foreground">{label}:</span>}
        <span className="font-semibold">{formatted}</span>
        {suffix && <span className="text-muted-foreground">{suffix}</span>}
      </div>
    );
  }
);
Price.displayName = "Price";

// Specialized price breakdown component
export interface PriceBreakdownProps {
  items: Array<{
    label: string;
    value: number;
    highlight?: boolean;
  }>;
  total?: {
    label: string;
    value: number;
  };
  currency?: string;
  locale?: string;
  className?: string;
}

export const PriceBreakdown = React.forwardRef<HTMLDivElement, PriceBreakdownProps>(
  ({ items, total, currency = "JPY", locale = "ja-JP", className }, ref) => {
    const formatPrice = (value: number) =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);

    return (
      <div ref={ref} className={cn("space-y-2", className)}>
        {items.map((item, index) => (
          <div
            key={index}
            className={cn(
              "flex items-center justify-between text-sm",
              item.highlight && "font-semibold"
            )}
          >
            <span className={cn(!item.highlight && "text-muted-foreground")}>
              {item.label}
            </span>
            <span>{formatPrice(item.value)}</span>
          </div>
        ))}
        {total && (
          <div className="flex items-center justify-between border-t pt-2">
            <span className="font-semibold">{total.label}</span>
            <span className="font-semibold text-lg">
              {formatPrice(total.value)}
            </span>
          </div>
        )}
      </div>
    );
  }
);
PriceBreakdown.displayName = "PriceBreakdown";

// Cost calculation component
export interface CostCalculatorProps {
  monthlyRent: number;
  initialCosts?: {
    deposit?: number;
    keyMoney?: number;
    agencyFee?: number;
    other?: number;
  };
  period?: number; // in months
  currency?: string;
  locale?: string;
  className?: string;
}

export const CostCalculator = React.forwardRef<HTMLDivElement, CostCalculatorProps>(
  (
    {
      monthlyRent,
      initialCosts = {},
      period = 24,
      currency = "JPY",
      locale = "ja-JP",
      className,
    },
    ref
  ) => {
    const totalInitial = Object.values(initialCosts).reduce(
      (sum, cost) => sum + (cost || 0),
      0
    );
    const totalRent = monthlyRent * period;
    const totalCost = totalInitial + totalRent;
    const monthlyAverage = Math.round(totalCost / period);

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-between p-2 rounded-md bg-muted/50",
          className
        )}
      >
        <div className="flex items-center gap-1.5">
          <Calculator className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {period}-month avg:
          </span>
        </div>
        <div className="text-right">
          <Price
            value={monthlyAverage}
            currency={currency}
            locale={locale}
            variant="compact"
            size="sm"
            suffix="/mo"
          />
          <div className="text-xs text-muted-foreground">
            Total: <Price
              value={totalCost}
              currency={currency}
              locale={locale}
              variant="compact"
              size="sm"
            />
          </div>
        </div>
      </div>
    );
  }
);
CostCalculator.displayName = "CostCalculator";