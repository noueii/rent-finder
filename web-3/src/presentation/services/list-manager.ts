import type { ApartmentWithRelations } from "~/types";

export interface ListAction {
  type: "add" | "remove" | "move" | "bookmark" | "like" | "view";
  apartmentId: string;
  listId?: string;
  targetListId?: string;
  timestamp: Date;
}

export interface ListState {
  apartments: ApartmentWithRelations[];
  selected: Set<string>;
  sortField?: string;
  sortOrder?: "asc" | "desc";
}

/**
 * Service for managing apartment lists in the UI
 */
export class ListManager {
  /**
   * Add apartments to a list
   */
  static addToList(
    currentList: ApartmentWithRelations[],
    newApartments: ApartmentWithRelations[]
  ): ApartmentWithRelations[] {
    const existingIds = new Set(currentList.map((apt) => apt.id));
    const toAdd = newApartments.filter((apt) => !existingIds.has(apt.id));
    return [...currentList, ...toAdd];
  }

  /**
   * Remove apartments from a list
   */
  static removeFromList(
    currentList: ApartmentWithRelations[],
    apartmentIds: string[]
  ): ApartmentWithRelations[] {
    const idsToRemove = new Set(apartmentIds);
    return currentList.filter((apt) => !idsToRemove.has(apt.id));
  }

  /**
   * Toggle apartment selection
   */
  static toggleSelection(
    selected: Set<string>,
    apartmentId: string
  ): Set<string> {
    const newSelected = new Set(selected);
    if (newSelected.has(apartmentId)) {
      newSelected.delete(apartmentId);
    } else {
      newSelected.add(apartmentId);
    }
    return newSelected;
  }

  /**
   * Select all apartments
   */
  static selectAll(apartments: ApartmentWithRelations[]): Set<string> {
    return new Set(apartments.map((apt) => apt.id));
  }

  /**
   * Clear all selections
   */
  static clearSelection(): Set<string> {
    return new Set();
  }

  /**
   * Get selected apartments
   */
  static getSelected(
    apartments: ApartmentWithRelations[],
    selected: Set<string>
  ): ApartmentWithRelations[] {
    return apartments.filter((apt) => selected.has(apt.id));
  }

  /**
   * Sort apartments by field
   */
  static sortApartments(
    apartments: ApartmentWithRelations[],
    field: string,
    order: "asc" | "desc" = "asc"
  ): ApartmentWithRelations[] {
    const sorted = [...apartments].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (field) {
        case "price":
          aValue = a.price;
          bValue = b.price;
          break;
        case "size":
          aValue = a.size;
          bValue = b.size;
          break;
        case "buildingAge":
          aValue = a.buildingAge || 0;
          bValue = b.buildingAge || 0;
          break;
        case "score":
          aValue = (a as any).score || 0;
          bValue = (b as any).score || 0;
          break;
        case "createdAt":
          aValue = a.createdAt.getTime();
          bValue = b.createdAt.getTime();
          break;
        case "walkingMinutes":
          // Sort by shortest walking time to any station
          aValue = Math.min(...a.nearStations.map((ns) => ns.walkingMinutes));
          bValue = Math.min(...b.nearStations.map((ns) => ns.walkingMinutes));
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return order === "asc" ? -1 : 1;
      if (aValue > bValue) return order === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }

  /**
   * Group apartments by a field
   */
  static groupApartments(
    apartments: ApartmentWithRelations[],
    field: "ward" | "layout" | "priceRange"
  ): Record<string, ApartmentWithRelations[]> {
    const groups: Record<string, ApartmentWithRelations[]> = {};

    apartments.forEach((apt) => {
      let key: string;

      switch (field) {
        case "ward":
          key = apt.ward || "Unknown";
          break;
        case "layout":
          key = apt.layout || "Unknown";
          break;
        case "priceRange":
          if (apt.price < 100000) key = "Under ¥100,000";
          else if (apt.price < 150000) key = "¥100,000 - ¥150,000";
          else if (apt.price < 200000) key = "¥150,000 - ¥200,000";
          else if (apt.price < 300000) key = "¥200,000 - ¥300,000";
          else key = "Over ¥300,000";
          break;
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(apt);
    });

    return groups;
  }

  /**
   * Get list statistics
   */
  static getListStats(apartments: ApartmentWithRelations[]): {
    count: number;
    avgPrice: number;
    avgSize: number;
    avgScore?: number;
    priceRange: { min: number; max: number };
    sizeRange: { min: number; max: number };
    wards: string[];
    layouts: string[];
  } {
    if (apartments.length === 0) {
      return {
        count: 0,
        avgPrice: 0,
        avgSize: 0,
        priceRange: { min: 0, max: 0 },
        sizeRange: { min: 0, max: 0 },
        wards: [],
        layouts: [],
      };
    }

    const prices = apartments.map((apt) => apt.price);
    const sizes = apartments.map((apt) => apt.size);
    const scores = apartments
      .map((apt) => (apt as any).score)
      .filter((score) => score !== undefined);

    const uniqueWards = new Set(apartments.map((apt) => apt.ward).filter(Boolean));
    const uniqueLayouts = new Set(apartments.map((apt) => apt.layout).filter(Boolean));

    return {
      count: apartments.length,
      avgPrice: prices.reduce((sum, price) => sum + price, 0) / prices.length,
      avgSize: sizes.reduce((sum, size) => sum + size, 0) / sizes.length,
      avgScore: scores.length > 0
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length
        : undefined,
      priceRange: {
        min: Math.min(...prices),
        max: Math.max(...prices),
      },
      sizeRange: {
        min: Math.min(...sizes),
        max: Math.max(...sizes),
      },
      wards: Array.from(uniqueWards) as string[],
      layouts: Array.from(uniqueLayouts) as string[],
    };
  }

  /**
   * Paginate apartments
   */
  static paginate(
    apartments: ApartmentWithRelations[],
    page: number,
    pageSize: number
  ): {
    items: ApartmentWithRelations[];
    totalPages: number;
    currentPage: number;
    hasNext: boolean;
    hasPrevious: boolean;
  } {
    const totalPages = Math.ceil(apartments.length / pageSize);
    const currentPage = Math.max(1, Math.min(page, totalPages));
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;

    return {
      items: apartments.slice(start, end),
      totalPages,
      currentPage,
      hasNext: currentPage < totalPages,
      hasPrevious: currentPage > 1,
    };
  }

  /**
   * Check if apartment is in list
   */
  static isInList(
    apartments: ApartmentWithRelations[],
    apartmentId: string
  ): boolean {
    return apartments.some((apt) => apt.id === apartmentId);
  }

  /**
   * Get list action description
   */
  static getActionDescription(action: ListAction): string {
    switch (action.type) {
      case "add":
        return `Added to ${action.listId || "list"}`;
      case "remove":
        return `Removed from ${action.listId || "list"}`;
      case "move":
        return `Moved from ${action.listId} to ${action.targetListId}`;
      case "bookmark":
        return "Bookmarked";
      case "like":
        return "Liked";
      case "view":
        return "Viewed";
      default:
        return "Updated";
    }
  }
}