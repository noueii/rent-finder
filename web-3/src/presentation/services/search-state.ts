import type { ApartmentSearchFilters } from "~/types/apartment";
import type { StationWithLines } from "~/types/station";

export interface SearchState {
  filters: ApartmentSearchFilters;
  searchMode: "standard" | "commute";
  workplaceStation?: StationWithLines;
  maxCommuteMinutes?: number;
  isSearching: boolean;
  resultCount?: number;
  lastSearchAt?: Date;
  savedSearchId?: string;
}

export interface SearchHistory {
  id: string;
  timestamp: Date;
  filters: ApartmentSearchFilters;
  searchMode: "standard" | "commute";
  workplaceStationId?: string;
  maxCommuteMinutes?: number;
  resultCount: number;
  label?: string;
}

/**
 * Service for managing search UI state
 */
export class SearchStateManager {
  private static readonly STORAGE_KEY = "apartment-search-state";
  private static readonly HISTORY_KEY = "apartment-search-history";
  private static readonly MAX_HISTORY = 10;

  /**
   * Save current search state to localStorage
   */
  static saveState(state: SearchState): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error("Failed to save search state:", error);
    }
  }

  /**
   * Load search state from localStorage
   */
  static loadState(): SearchState | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return null;

      const state = JSON.parse(stored) as SearchState;
      // Convert date strings back to Date objects
      if (state.lastSearchAt) {
        state.lastSearchAt = new Date(state.lastSearchAt);
      }
      return state;
    } catch (error) {
      console.error("Failed to load search state:", error);
      return null;
    }
  }

  /**
   * Clear saved search state
   */
  static clearState(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear search state:", error);
    }
  }

  /**
   * Add search to history
   */
  static addToHistory(search: Omit<SearchHistory, "id" | "timestamp">): void {
    try {
      const history = this.getHistory();
      const newEntry: SearchHistory = {
        ...search,
        id: `search-${Date.now()}`,
        timestamp: new Date(),
      };

      // Add to beginning and limit size
      const updated = [newEntry, ...history].slice(0, this.MAX_HISTORY);
      localStorage.setItem(this.HISTORY_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error("Failed to save search history:", error);
    }
  }

  /**
   * Get search history
   */
  static getHistory(): SearchHistory[] {
    try {
      const stored = localStorage.getItem(this.HISTORY_KEY);
      if (!stored) return [];

      const history = JSON.parse(stored) as SearchHistory[];
      // Convert date strings back to Date objects
      return history.map((entry) => ({
        ...entry,
        timestamp: new Date(entry.timestamp),
      }));
    } catch (error) {
      console.error("Failed to load search history:", error);
      return [];
    }
  }

  /**
   * Clear search history
   */
  static clearHistory(): void {
    try {
      localStorage.removeItem(this.HISTORY_KEY);
    } catch (error) {
      console.error("Failed to clear search history:", error);
    }
  }

  /**
   * Get search summary text
   */
  static getSearchSummary(state: SearchState): string {
    const parts: string[] = [];

    if (state.searchMode === "commute" && state.workplaceStation) {
      parts.push(`Within ${state.maxCommuteMinutes || 30} min of ${state.workplaceStation.name}`);
    }

    const filterCount = this.getActiveFilterCount(state.filters);
    if (filterCount > 0) {
      parts.push(`${filterCount} filter${filterCount > 1 ? "s" : ""} applied`);
    }

    if (state.resultCount !== undefined) {
      parts.push(`${state.resultCount} result${state.resultCount !== 1 ? "s" : ""}`);
    }

    return parts.length > 0 ? parts.join(" • ") : "No search criteria";
  }

  /**
   * Count active filters
   */
  static getActiveFilterCount(filters: ApartmentSearchFilters): number {
    let count = 0;

    if (filters.priceMin || filters.priceMax) count++;
    if (filters.sizeMin || filters.sizeMax) count++;
    if (filters.layout && filters.layout.length > 0) count++;
    if (filters.stationIds && filters.stationIds.length > 0) count++;
    if (filters.maxWalkingMinutes && filters.maxWalkingMinutes < 10) count++;
    if (filters.buildingAge) count++;
    if (filters.excludeWards && filters.excludeWards.length > 0) count++;
    if (filters.twoYearAvgMin || filters.twoYearAvgMax) count++;

    return count;
  }

  /**
   * Check if search state has changed
   */
  static hasStateChanged(state1: SearchState, state2: SearchState): boolean {
    // Check search mode
    if (state1.searchMode !== state2.searchMode) return true;

    // Check commute search params
    if (state1.searchMode === "commute") {
      if (state1.workplaceStation?.id !== state2.workplaceStation?.id) return true;
      if (state1.maxCommuteMinutes !== state2.maxCommuteMinutes) return true;
    }

    // Check filters
    return JSON.stringify(state1.filters) !== JSON.stringify(state2.filters);
  }

  /**
   * Create empty search state
   */
  static createEmptyState(): SearchState {
    return {
      filters: {},
      searchMode: "standard",
      isSearching: false,
    };
  }

  /**
   * Merge search states
   */
  static mergeStates(base: SearchState, updates: Partial<SearchState>): SearchState {
    return {
      ...base,
      ...updates,
      filters: updates.filters ? { ...base.filters, ...updates.filters } : base.filters,
    };
  }

  /**
   * Validate search state
   */
  static isValidState(state: SearchState): boolean {
    // Commute search requires workplace station
    if (state.searchMode === "commute" && !state.workplaceStation) {
      return false;
    }

    // Standard search should have at least one filter
    if (state.searchMode === "standard") {
      return this.getActiveFilterCount(state.filters) > 0 || 
             (state.filters.stationIds && state.filters.stationIds.length > 0);
    }

    return true;
  }

  /**
   * Convert state to shareable URL params
   */
  static toShareableUrl(state: SearchState): string {
    const params = new URLSearchParams();

    params.set("mode", state.searchMode);

    if (state.searchMode === "commute") {
      if (state.workplaceStation) {
        params.set("workplace", state.workplaceStation.id);
      }
      if (state.maxCommuteMinutes) {
        params.set("maxCommute", state.maxCommuteMinutes.toString());
      }
    }

    // Add filters
    Object.entries(state.filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value) && value.length > 0) {
          params.set(key, value.join(","));
        } else if (!Array.isArray(value)) {
          params.set(key, String(value));
        }
      }
    });

    return params.toString();
  }

  /**
   * Parse state from URL params
   */
  static fromShareableUrl(urlParams: URLSearchParams): Partial<SearchState> {
    const state: Partial<SearchState> = {
      filters: {},
    };

    // Parse search mode
    const mode = urlParams.get("mode");
    if (mode === "commute" || mode === "standard") {
      state.searchMode = mode;
    }

    // Parse commute params
    if (mode === "commute") {
      const maxCommute = urlParams.get("maxCommute");
      if (maxCommute) {
        state.maxCommuteMinutes = parseInt(maxCommute, 10);
      }
      // Note: workplaceStation needs to be loaded separately by ID
    }

    // Parse filters
    const filters: ApartmentSearchFilters = {};
    
    // Numeric filters
    ["priceMin", "priceMax", "sizeMin", "sizeMax", "maxWalkingMinutes", "buildingAge", "twoYearAvgMin", "twoYearAvgMax"].forEach((key) => {
      const value = urlParams.get(key);
      if (value) {
        const parsed = key.includes("size") ? parseFloat(value) : parseInt(value, 10);
        if (!isNaN(parsed)) {
          (filters as any)[key] = parsed;
        }
      }
    });

    // Array filters
    ["layout", "stationIds", "excludeWards"].forEach((key) => {
      const value = urlParams.get(key);
      if (value) {
        (filters as any)[key] = value.split(",").filter(Boolean);
      }
    });

    state.filters = filters;
    return state;
  }
}