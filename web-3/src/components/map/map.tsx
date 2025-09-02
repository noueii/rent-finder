'use client';

import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import type { MapContainerProps } from 'react-leaflet';
import { Map as LeafletMap } from 'leaflet';
import type { LatLngExpression } from 'leaflet';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in Next.js
import L from 'leaflet';

// Fix leaflet icon issue in Next.js
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: '/leaflet/marker-icon.png',
    iconRetinaUrl: '/leaflet/marker-icon-2x.png',
    shadowUrl: '/leaflet/marker-shadow.png',
  });
}

interface MapProps extends Omit<MapContainerProps, 'children'> {
  children?: React.ReactNode;
  onMapReady?: (map: LeafletMap) => void;
}

// Hook to handle map events
function MapEventHandler({ onMapReady }: { onMapReady?: (map: LeafletMap) => void }) {
  const map = useMap();
  
  useEffect(() => {
    if (onMapReady) {
      onMapReady(map);
    }
  }, [map, onMapReady]);
  
  return null;
}

export interface MapRef {
  getMap: () => LeafletMap | null;
}

export const Map = forwardRef<MapRef, MapProps>(
  ({ center = [35.6762, 139.6503], zoom = 13, children, onMapReady, ...props }, ref) => {
    const mapRef = useRef<LeafletMap | null>(null);
    
    useImperativeHandle(ref, () => ({
      getMap: () => mapRef.current,
    }));
    
    return (
      <MapContainer
        center={center as LatLngExpression}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        {...props}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapEventHandler
          onMapReady={(map) => {
            mapRef.current = map;
            onMapReady?.(map);
          }}
        />
        {children}
      </MapContainer>
    );
  }
);

Map.displayName = 'Map';