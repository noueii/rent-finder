// Helper functions for generating map URLs

interface GoogleMapsDirectionsOptions {
  origin: {
    lat: number;
    lng: number;
  };
  destination: {
    lat: number;
    lng: number;
  };
  departureTime?: {
    hour: number; // 0-23
    minute?: number; // 0-59
  };
}

interface GoogleMapsSearchOptions {
  lat: number;
  lng: number;
}

/**
 * Generate a Google Maps directions URL with proper formatting
 * @param options - The origin, destination, and optional departure time
 * @returns The formatted Google Maps URL
 */
export function getGoogleMapsDirectionsUrl(options: GoogleMapsDirectionsOptions): string {
  const { origin, destination, departureTime } = options;
  
  // Base URL with origin and destination
  let url = `https://www.google.com/maps/dir/?api=1`;
  url += `&origin=${origin.lat},${origin.lng}`;
  url += `&destination=${destination.lat},${destination.lng}`;
  
  // Add transit mode flag
  url += `&travelmode=transit`; // Use transit/public transportation
  
  // Add departure time if specified
  if (departureTime) {
    // Calculate the next occurrence of the specified time
    const now = new Date();
    const targetTime = new Date(now);
    targetTime.setHours(departureTime.hour, departureTime.minute || 0, 0, 0);
    
    // If the target time has already passed today, use tomorrow
    if (targetTime <= now) {
      targetTime.setDate(targetTime.getDate() + 1);
    }
    
    // Format date as MM/DD/YYYY
    const month = String(targetTime.getMonth() + 1).padStart(2, '0');
    const day = String(targetTime.getDate()).padStart(2, '0');
    const year = targetTime.getFullYear();
    const dateStr = `${month}/${day}/${year}`;
    
    // Format time as HH:MM
    const hours = String(targetTime.getHours()).padStart(2, '0');
    const minutes = String(targetTime.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;
    
    url += `&date=${dateStr}`;
    url += `&time=${timeStr}`;
    url += `&ttype=dep`; // Departure time (not arrival)
  }
  
  return url;
}

/**
 * Generate a Google Maps search URL for a single location
 * @param options - The latitude and longitude
 * @returns The formatted Google Maps URL
 */
export function getGoogleMapsSearchUrl(options: GoogleMapsSearchOptions): string {
  return `https://www.google.com/maps/search/?api=1&query=${options.lat},${options.lng}`;
}

/**
 * Generate a Google Maps URL for an apartment
 * This is a convenience function that handles the common cases
 */
export function getApartmentMapsUrl(
  apartment: { latitude?: number | null; longitude?: number | null },
  destination?: { latitude?: number | null; longitude?: number | null },
  departureHour: number = 10
): string {
  // Check if we have valid coordinates
  if (!apartment.latitude || !apartment.longitude) {
    return '#'; // Return a safe fallback
  }
  
  // If we have a destination, generate directions
  if (destination?.latitude && destination?.longitude) {
    return getGoogleMapsDirectionsUrl({
      origin: { lat: apartment.latitude, lng: apartment.longitude },
      destination: { lat: destination.latitude, lng: destination.longitude },
      departureTime: { hour: departureHour }
    });
  }
  
  // Otherwise, just show the apartment location
  return getGoogleMapsSearchUrl({
    lat: apartment.latitude,
    lng: apartment.longitude
  });
}