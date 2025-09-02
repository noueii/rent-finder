import type { ApartmentWithRelations } from "~/types";
import type { ApartmentSearchFilters } from "~/types/apartment";

export interface ClientSideFilters {
  showBookmarked?: boolean;
  showLiked?: boolean;
  hideViewed?: boolean;
}

export interface CommuteSearchFilters {
  workplaceStationId?: string;
  maxCommuteMinutes?: number;
}

/**
 * Service for handling apartment filtering logic
 */
export class ApartmentFilters {
  /**
   * Apply client-side filters to apartments
   */
  static applyClientFilters(
    apartments: ApartmentWithRelations[],
    filters: ClientSideFilters
  ): ApartmentWithRelations[] {
    let filtered = [...apartments];

    if (filters.showBookmarked) {
      filtered = filtered.filter((apt) => apt.isBookmarked);
    }

    if (filters.showLiked) {
      filtered = filtered.filter((apt) => apt.isLiked);
    }

    if (filters.hideViewed) {
      filtered = filtered.filter((apt) => !apt.viewedAt);
    }

    return filtered;
  }

  /**
   * Check if any filters are active
   */
  static hasActiveFilters(filters: ApartmentSearchFilters): boolean {
    return (
      (filters.priceMin !== undefined && filters.priceMin > 0) ||
      (filters.priceMax !== undefined && filters.priceMax > 0) ||
      (filters.sizeMin !== undefined && filters.sizeMin > 0) ||
      (filters.sizeMax !== undefined && filters.sizeMax > 0) ||
      (filters.layout && filters.layout.length > 0) ||
      (filters.stationIds && filters.stationIds.length > 0) ||
      (filters.buildingAge !== undefined && filters.buildingAge > 0) ||
      (filters.excludeWards && filters.excludeWards.length > 0) ||
      (filters.maxCommuteMinutes !== undefined && filters.maxCommuteMinutes < 60) ||
      (filters.twoYearAvgMin !== undefined && filters.twoYearAvgMin > 0) ||
      (filters.twoYearAvgMax !== undefined && filters.twoYearAvgMax > 0)
    );
  }

  /**
   * Get filter summary text
   */
  static getFilterSummary(filters: ApartmentSearchFilters): string {
    const parts: string[] = [];

    if (filters.priceMin || filters.priceMax) {
      if (filters.priceMin && filters.priceMax) {
        parts.push(`¥${filters.priceMin.toLocaleString()}-${filters.priceMax.toLocaleString()}`);
      } else if (filters.priceMin) {
        parts.push(`¥${filters.priceMin.toLocaleString()}+`);
      } else if (filters.priceMax) {
        parts.push(`Up to ¥${filters.priceMax.toLocaleString()}`);
      }
    }

    if (filters.layout && filters.layout.length > 0) {
      parts.push(filters.layout.join(", "));
    }

    if (filters.sizeMin || filters.sizeMax) {
      if (filters.sizeMin && filters.sizeMax) {
        parts.push(`${filters.sizeMin}-${filters.sizeMax}m²`);
      } else if (filters.sizeMin) {
        parts.push(`${filters.sizeMin}m²+`);
      } else if (filters.sizeMax) {
        parts.push(`Up to ${filters.sizeMax}m²`);
      }
    }


    if (filters.buildingAge) {
      parts.push(`≤${filters.buildingAge} years old`);
    }

    return parts.length > 0 ? parts.join(" • ") : "No filters applied";
  }

  /**
   * Reset filters to default values
   */
  static resetFilters(): ApartmentSearchFilters {
    return {};
  }

  /**
   * Merge two filter objects
   */
  static mergeFilters(
    base: ApartmentSearchFilters,
    overrides: Partial<ApartmentSearchFilters>
  ): ApartmentSearchFilters {
    return { ...base, ...overrides };
  }

  /**
   * Validate filter values
   */
  static validateFilters(filters: ApartmentSearchFilters): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (filters.priceMin && filters.priceMax && filters.priceMin > filters.priceMax) {
      errors.push("Minimum price cannot be greater than maximum price");
    }

    if (filters.sizeMin && filters.sizeMax && filters.sizeMin > filters.sizeMax) {
      errors.push("Minimum size cannot be greater than maximum size");
    }

    if (filters.twoYearAvgMin && filters.twoYearAvgMax && filters.twoYearAvgMin > filters.twoYearAvgMax) {
      errors.push("Minimum 2-year average cannot be greater than maximum");
    }


    if (filters.buildingAge && (filters.buildingAge < 0 || filters.buildingAge > 100)) {
      errors.push("Building age must be between 0 and 100 years");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get default filter values
   */
  static getDefaultFilters(): ApartmentSearchFilters {
    return {
      layout: [],
      stationIds: [],
      excludeWards: [],
    };
  }

  /**
   * Serialize filters for URL
   */
  static toQueryString(filters: ApartmentSearchFilters): string {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          if (value.length > 0) {
            params.set(key, value.join(","));
          }
        } else {
          params.set(key, String(value));
        }
      }
    });

    return params.toString();
  }

  /**
   * Parse filters from URL query string
   */
  static fromQueryString(queryString: string): ApartmentSearchFilters {
    const params = new URLSearchParams(queryString);
    const filters: ApartmentSearchFilters = {};

    // Parse numeric fields
    const numericFields = [
      "priceMin",
      "priceMax",
      "sizeMin",
      "sizeMax",
      "buildingAge",
      "maxCommuteMinutes",
      "twoYearAvgMin",
      "twoYearAvgMax",
    ];

    numericFields.forEach((field) => {
      const value = params.get(field);
      if (value) {
        const parsed = field.includes("size") ? parseFloat(value) : parseInt(value, 10);
        if (!isNaN(parsed)) {
          (filters as any)[field] = parsed;
        }
      }
    });

    // Parse array fields
    const arrayFields = ["layout", "stationIds", "excludeWards"];

    arrayFields.forEach((field) => {
      const value = params.get(field);
      if (value) {
        (filters as any)[field] = value.split(",").filter(Boolean);
      }
    });

    return filters;
  }
}