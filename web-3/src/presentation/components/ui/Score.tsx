/**
 * Reusable Score Component
 * For displaying scores, ratings, and progress-based values
 */

import * as React from "react";
import { cn } from "~/lib/utils";
import { Badge } from "./Badge";
import { Progress } from "~/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Info, TrendingUp, Star, Award } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface ScoreProps {
  value: number;
  max?: number;
  label?: string;
  icon?: LucideIcon;
  size?: "sm" | "md" | "lg";
  showDetails?: boolean;
  variant?: "badge" | "progress" | "circular";
  colorScale?: "default" | "performance" | "rating";
  className?: string;
  children?: React.ReactNode; // For popover content
}

// Color scale functions
const getDefaultColor = (value: number, max: number) => {
  const percentage = (value / max) * 100;
  if (percentage >= 80) return "success";
  if (percentage >= 60) return "warning";
  if (percentage >= 40) return "info";
  return "destructive";
};

const getPerformanceColor = (value: number, max: number) => {
  const percentage = (value / max) * 100;
  if (percentage >= 90) return "green";
  if (percentage >= 70) return "yellow";
  if (percentage >= 50) return "orange";
  return "red";
};

const getRatingColor = (value: number, max: number) => {
  const percentage = (value / max) * 100;
  if (percentage >= 80) return "green";
  if (percentage >= 60) return "blue";
  if (percentage >= 40) return "yellow";
  return "red";
};

export const Score = React.forwardRef<HTMLDivElement, ScoreProps>(
  (
    {
      value,
      max = 100,
      label,
      icon: Icon = TrendingUp,
      size = "md",
      showDetails = false,
      variant = "badge",
      colorScale = "default",
      className,
      children,
    },
    ref
  ) => {
    const percentage = Math.round((value / max) * 100);
    
    // Get color based on scale
    let color: any = "default";
    if (colorScale === "performance") {
      color = getPerformanceColor(value, max);
    } else if (colorScale === "rating") {
      color = getRatingColor(value, max);
    } else {
      color = getDefaultColor(value, max);
    }

    const sizeClasses = {
      sm: "text-xs",
      md: "text-sm",
      lg: "text-base",
    };

    const iconSize = {
      sm: "h-3 w-3",
      md: "h-4 w-4",
      lg: "h-5 w-5",
    };

    // Badge variant
    if (variant === "badge") {
      const content = (
        <Badge
          variant={colorScale === "performance" ? "outline" : color}
          size={size}
          className={cn("cursor-pointer", className)}
        >
          <Icon className={cn(iconSize[size], "mr-1")} />
          {label ? `${label}: ${percentage}%` : `${percentage}%`}
          {showDetails && children && <Info className={cn(iconSize[size], "ml-1")} />}
        </Badge>
      );

      if (showDetails && children) {
        return (
          <Popover>
            <PopoverTrigger asChild>{content}</PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              {children}
            </PopoverContent>
          </Popover>
        );
      }

      return content;
    }

    // Progress variant
    if (variant === "progress") {
      return (
        <div ref={ref} className={cn("space-y-2", className)}>
          {(label || showDetails) && (
            <div className="flex items-center justify-between">
              {label && (
                <div className={cn("flex items-center gap-2", sizeClasses[size])}>
                  <Icon className={iconSize[size]} />
                  <span>{label}</span>
                </div>
              )}
              <span className={cn("font-medium", sizeClasses[size])}>
                {percentage}%
              </span>
            </div>
          )}
          <Progress
            value={percentage}
            className={cn(
              "h-2",
              size === "lg" && "h-3",
              size === "sm" && "h-1.5"
            )}
          />
          {showDetails && children && (
            <div className="text-xs text-muted-foreground">{children}</div>
          )}
        </div>
      );
    }

    // Circular variant
    if (variant === "circular") {
      const radius = size === "sm" ? 20 : size === "md" ? 30 : 40;
      const strokeWidth = size === "sm" ? 3 : size === "md" ? 4 : 5;
      const circumference = 2 * Math.PI * radius;
      const strokeDashoffset = circumference - (percentage / 100) * circumference;

      return (
        <div
          ref={ref}
          className={cn(
            "relative inline-flex items-center justify-center",
            className
          )}
        >
          <svg
            width={radius * 2 + strokeWidth * 2}
            height={radius * 2 + strokeWidth * 2}
            className="transform -rotate-90"
          >
            <circle
              cx={radius + strokeWidth}
              cy={radius + strokeWidth}
              r={radius}
              stroke="currentColor"
              strokeWidth={strokeWidth}
              fill="none"
              className="text-muted-foreground/20"
            />
            <circle
              cx={radius + strokeWidth}
              cy={radius + strokeWidth}
              r={radius}
              stroke="currentColor"
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className={cn(
                "transition-all duration-300",
                color === "green" && "text-green-500",
                color === "yellow" && "text-yellow-500",
                color === "orange" && "text-orange-500",
                color === "red" && "text-red-500",
                color === "blue" && "text-blue-500",
                color === "success" && "text-green-500",
                color === "warning" && "text-yellow-500",
                color === "info" && "text-blue-500",
                color === "destructive" && "text-red-500"
              )}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Icon className={iconSize[size]} />
            <span className={cn("font-semibold", sizeClasses[size])}>
              {percentage}%
            </span>
          </div>
        </div>
      );
    }

    return null;
  }
);
Score.displayName = "Score";

// Specialized score components
export interface MatchScoreProps extends Omit<ScoreProps, "icon" | "colorScale"> {
  matchType?: "apartment" | "location" | "commute";
}

export const MatchScore = React.forwardRef<HTMLDivElement, MatchScoreProps>(
  ({ matchType = "apartment", ...props }, ref) => {
    return (
      <Score
        ref={ref}
        icon={matchType === "location" ? Award : TrendingUp}
        colorScale="performance"
        {...props}
      />
    );
  }
);
MatchScore.displayName = "MatchScore";

export interface RatingScoreProps extends Omit<ScoreProps, "icon" | "colorScale" | "max"> {
  stars?: number;
}

export const RatingScore = React.forwardRef<HTMLDivElement, RatingScoreProps>(
  ({ value, stars = 5, ...props }, ref) => {
    return (
      <Score
        ref={ref}
        value={value}
        max={stars}
        icon={Star}
        colorScale="rating"
        {...props}
      />
    );
  }
);
RatingScore.displayName = "RatingScore";