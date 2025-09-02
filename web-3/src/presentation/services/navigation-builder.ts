/**
 * Navigation and URL building utilities for apartments
 * Handles route generation and navigation logic
 */

import type { ApartmentWithRelations } from "~/types";

export interface NavigationOptions {
  targetStationId?: string;
  listId?: string;
  returnUrl?: string;
}

/**
 * Build apartment detail page URL with query parameters
 */
export function buildApartmentDetailUrl(
  apartmentId: string,
  options: NavigationOptions = {}
): string {
  const { targetStationId, listId, returnUrl } = options;
  const params = new URLSearchParams();
  
  if (targetStationId) {
    params.append('station', targetStationId);
  } else if (listId) {
    params.append('list', listId);
  }
  
  if (returnUrl) {
    params.append('return', returnUrl);
  }
  
  const queryString = params.toString();
  return `/apartments/${apartmentId}${queryString ? `?${queryString}` : ''}`;
}

/**
 * Build apartment search URL with filters
 */
export function buildSearchUrl(filters: Record<string, any>): string {
  const params = new URLSearchParams();
  
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        value.forEach(v => params.append(key, String(v)));
      } else {
        params.append(key, String(value));
      }
    }
  });
  
  return `/search${params.toString() ? `?${params.toString()}` : ''}`;
}

/**
 * Extract apartment ID from URL
 */
export function extractApartmentId(url: string): string | null {
  const match = url.match(/\/apartments\/([a-zA-Z0-9-]+)/);
  return match ? match[1] : null;
}

/**
 * Build breadcrumb items for apartment page
 */
export function buildApartmentBreadcrumbs(
  apartment: ApartmentWithRelations,
  options: NavigationOptions = {}
): Array<{ label: string; href: string }> {
  const breadcrumbs = [
    { label: 'Home', href: '/' }
  ];
  
  if (options.listId) {
    breadcrumbs.push({ label: 'Lists', href: '/lists' });
    breadcrumbs.push({ label: 'List', href: `/lists/${options.listId}` });
  } else if (options.targetStationId) {
    breadcrumbs.push({ label: 'Search', href: '/search' });
  }
  
  breadcrumbs.push({ 
    label: apartment.title || 'Apartment', 
    href: buildApartmentDetailUrl(apartment.id, options) 
  });
  
  return breadcrumbs;
}

/**
 * Parse query parameters from current URL
 */
export function parseNavigationParams(searchParams: URLSearchParams): NavigationOptions {
  return {
    targetStationId: searchParams.get('station') || undefined,
    listId: searchParams.get('list') || undefined,
    returnUrl: searchParams.get('return') || undefined,
  };
}