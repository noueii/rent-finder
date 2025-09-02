/**
 * Map URL generation utilities
 * Handles creating map links for various services
 */

import type { ApartmentWithRelations } from "~/types";

export interface MapDestination {
  name: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Generate Google Maps URL for apartment
 */
export function generateGoogleMapsUrl(
  apartment: ApartmentWithRelations,
  destination?: MapDestination | null
): string {
  const baseUrl = 'https://www.google.com/maps';
  
  // If we have coordinates, use them
  if (apartment.latitude && apartment.longitude) {
    if (destination?.latitude && destination?.longitude) {
      // Generate directions URL
      const params = new URLSearchParams({
        api: '1',
        origin: `${apartment.latitude},${apartment.longitude}`,
        destination: `${destination.latitude},${destination.longitude}`,
        travelmode: 'transit'
      });
      return `${baseUrl}/dir/?${params.toString()}`;
    } else {
      // Just show the apartment location
      const params = new URLSearchParams({
        api: '1',
        query: `${apartment.latitude},${apartment.longitude}`
      });
      return `${baseUrl}/search/?${params.toString()}`;
    }
  }
  
  // Fallback to address search
  const searchQuery = destination 
    ? `${apartment.address} to ${destination.name} station`
    : apartment.address;
    
  const params = new URLSearchParams({
    api: '1',
    query: searchQuery
  });
  
  return `${baseUrl}/search/?${params.toString()}`;
}

/**
 * Generate Apple Maps URL (for iOS users)
 */
export function generateAppleMapsUrl(
  apartment: ApartmentWithRelations,
  destination?: MapDestination | null
): string {
  const baseUrl = 'https://maps.apple.com/';
  const params = new URLSearchParams();
  
  if (apartment.latitude && apartment.longitude) {
    if (destination?.latitude && destination?.longitude) {
      // Directions
      params.append('saddr', `${apartment.latitude},${apartment.longitude}`);
      params.append('daddr', `${destination.latitude},${destination.longitude}`);
      params.append('dirflg', 'r'); // Transit directions
    } else {
      // Location
      params.append('ll', `${apartment.latitude},${apartment.longitude}`);
      params.append('q', apartment.title || apartment.address);
    }
  } else {
    // Address search
    params.append('q', apartment.address);
  }
  
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Determine best station destination for navigation
 */
export function getBestNavigationDestination(
  apartment: ApartmentWithRelations
): MapDestination | null {
  // Check for preferred station
  if ((apartment as any).preferredStation) {
    return {
      name: (apartment as any).preferredStation.name,
      latitude: (apartment as any).preferredStation.latitude,
      longitude: (apartment as any).preferredStation.longitude,
    };
  }
  
  // Check for route destination
  if ((apartment as any).routes?.[0]?.toStation) {
    return {
      name: (apartment as any).routes[0].toStation.name,
      latitude: (apartment as any).routes[0].toStation.latitude,
      longitude: (apartment as any).routes[0].toStation.longitude,
    };
  }
  
  // Fallback to nearest station
  if (apartment.nearestStations?.[0]?.station) {
    return {
      name: apartment.nearestStations[0].station.name,
      latitude: apartment.nearestStations[0].station.latitude,
      longitude: apartment.nearestStations[0].station.longitude,
    };
  }
  
  return null;
}

/**
 * Check if user is on iOS
 */
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

/**
 * Get platform-appropriate maps URL
 */
export function getApartmentMapsUrl(
  apartment: ApartmentWithRelations,
  destination?: MapDestination | null
): string {
  const navDestination = destination || getBestNavigationDestination(apartment);
  
  if (isIOS()) {
    return generateAppleMapsUrl(apartment, navDestination);
  }
  
  return generateGoogleMapsUrl(apartment, navDestination);
}