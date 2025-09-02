/**
 * Price calculation utilities for apartments
 * Handles all monetary calculations and formatting
 */

import type { Apartment } from "~/types";

export interface CostBreakdown {
  monthlyRent: number;
  deposit: number;
  keyMoney: number;
  reikin: number;
  agencyFee: number;
  totalInitialCost: number;
  twoYearTotal: number;
  monthlyAverage: number;
}

/**
 * Calculate comprehensive cost breakdown for an apartment
 */
export function calculateCostBreakdown(apartment: Apartment): CostBreakdown {
  const monthlyRent = apartment.price;
  const deposit = apartment.deposit || (apartment.price * 2); // Default 2 months
  const keyMoney = apartment.keyMoney || 0;
  const reikin = apartment.reikin || 0;
  const agencyFee = apartment.agencyFee || apartment.price; // Default 1 month
  
  const totalInitialCost = deposit + keyMoney + reikin + agencyFee;
  const twoYearTotal = totalInitialCost + (monthlyRent * 24);
  const monthlyAverage = Math.round(twoYearTotal / 24);
  
  return {
    monthlyRent,
    deposit,
    keyMoney,
    reikin,
    agencyFee,
    totalInitialCost,
    twoYearTotal,
    monthlyAverage,
  };
}

/**
 * Format price in Japanese Yen
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    minimumFractionDigits: 0,
  }).format(price);
}

/**
 * Format price for display (without currency symbol)
 */
export function formatPriceCompact(price: number): string {
  return `¥${price.toLocaleString()}`;
}

/**
 * Get price range label
 */
export function getPriceRangeLabel(price: number): string {
  if (price < 50000) return "Budget";
  if (price < 100000) return "Affordable";
  if (price < 150000) return "Mid-range";
  if (price < 200000) return "Premium";
  return "Luxury";
}

/**
 * Calculate price per square meter
 */
export function calculatePricePerSqm(price: number, size: number): number {
  if (!size || size === 0) return 0;
  return Math.round(price / size);
}