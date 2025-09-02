'use client';

import { Marker, Popup } from 'react-leaflet';
import { divIcon } from 'leaflet';
import type { LatLngExpression } from 'leaflet';
import { motion } from 'motion/react';
import type { ApartmentWithRelations } from '~/types/apartment';
import { ApartmentCard } from '~/components/apartment-card';

interface ApartmentMarkerProps {
  apartment: ApartmentWithRelations;
  isSelected?: boolean;
  onClick?: (apartment: ApartmentWithRelations) => void;
}

export function ApartmentMarker({ apartment, isSelected, onClick }: ApartmentMarkerProps) {
  if (!apartment.latitude || !apartment.longitude) {
    return null;
  }

  const position: LatLngExpression = [apartment.latitude, apartment.longitude];

  // Create custom HTML icon for the marker
  const markerIcon = divIcon({
    html: `
      <div class="apartment-marker ${isSelected ? 'selected' : ''}">
        <div class="marker-price">¥${(apartment.price / 10000).toFixed(1)}万</div>
      </div>
    `,
    className: 'custom-div-icon',
    iconSize: [80, 30],
    iconAnchor: [40, 30],
  });

  return (
    <Marker
      position={position}
      icon={markerIcon}
      eventHandlers={{
        click: () => onClick?.(apartment),
      }}
    >
      <Popup maxWidth={350} className="apartment-popup">
        <div className="w-full">
          <ApartmentCard apartment={apartment} variant="compact" />
        </div>
      </Popup>
    </Marker>
  );
}