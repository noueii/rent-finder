/**
 * ApartmentPrice Component
 * Displays apartment pricing information including 2-year cost calculation
 */

import * as React from "react";
import { Price, CostCalculator } from "~/presentation/components/ui";
import { calculateCostBreakdown } from "~/presentation/services/price-calculator";
import type { Apartment } from "~/types";

interface ApartmentPriceProps {
  apartment: Apartment;
  showBadge?: boolean;
  showBreakdown?: boolean;
  className?: string;
}

export function ApartmentPrice({
  apartment,
  showBadge = false,
  showBreakdown = true,
  className
}: ApartmentPriceProps) {
  const costBreakdown = React.useMemo(
    () => calculateCostBreakdown(apartment),
    [apartment]
  );

  if (showBadge) {
    return (
      <Price
        value={apartment.price}
        variant="badge"
        size="lg"
        suffix="/mo"
        className={className}
      />
    );
  }

  if (!showBreakdown) {
    return (
      <Price
        value={apartment.price}
        variant="compact"
        suffix="/mo"
        className={className}
      />
    );
  }

  // Extract fees from JSON if available
  const fees = apartment.feesJson as { deposit?: number; keyMoney?: number; agencyFee?: number } | null;
  
  return (
    <CostCalculator
      monthlyRent={apartment.price}
      initialCosts={{
        deposit: fees?.deposit || apartment.price * 2,
        keyMoney: fees?.keyMoney || 0,
        agencyFee: fees?.agencyFee || apartment.price,
      }}
      period={24}
      className={className}
    />
  );
}