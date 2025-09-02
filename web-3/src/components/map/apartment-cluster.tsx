'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import type { ApartmentWithRelations } from '~/types/apartment';

interface ApartmentClusterProps {
  apartments: ApartmentWithRelations[];
  onMarkerClick?: (apartment: ApartmentWithRelations) => void;
}

export function ApartmentCluster({ apartments, onMarkerClick }: ApartmentClusterProps) {
  const map = useMap();

  useEffect(() => {
    // Create marker cluster group
    const markers = L.markerClusterGroup({
      chunkedLoading: true,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      maxClusterRadius: 50,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        let size = 'small';
        let className = 'marker-cluster-small';
        
        if (count > 10) {
          size = 'medium';
          className = 'marker-cluster-medium';
        }
        if (count > 50) {
          size = 'large';
          className = 'marker-cluster-large';
        }

        return L.divIcon({
          html: `<div><span>${count}</span></div>`,
          className: `marker-cluster ${className}`,
          iconSize: L.point(40, 40),
        });
      },
    });

    // Add markers for each apartment
    apartments.forEach((apartment) => {
      if (apartment.latitude && apartment.longitude) {
        const marker = L.marker([apartment.latitude, apartment.longitude], {
          icon: L.divIcon({
            html: `
              <div class="apartment-marker">
                <div class="marker-price">¥${(apartment.price / 10000).toFixed(1)}万</div>
              </div>
            `,
            className: 'custom-div-icon',
            iconSize: [80, 30],
            iconAnchor: [40, 30],
          }),
        });

        marker.on('click', () => {
          onMarkerClick?.(apartment);
        });

        // Add popup
        const popupContent = `
          <div class="apartment-popup-content">
            <h3 class="font-semibold text-sm mb-2">${apartment.title}</h3>
            <div class="text-xs space-y-1">
              <p>¥${apartment.price.toLocaleString()}/月</p>
              <p>${apartment.size}㎡ ${apartment.layout || ''}</p>
              <p>${apartment.address}</p>
            </div>
          </div>
        `;
        marker.bindPopup(popupContent);

        markers.addLayer(marker);
      }
    });

    map.addLayer(markers);

    // Cleanup
    return () => {
      map.removeLayer(markers);
    };
  }, [map, apartments, onMarkerClick]);

  return null;
}