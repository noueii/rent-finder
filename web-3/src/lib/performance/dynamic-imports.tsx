/**
 * Dynamic Import Utilities
 * Provides centralized dynamic imports for heavy components
 */

import React from 'react';
import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

// Loading components
const MapSkeleton = () => {
  return (
    <div className="w-full h-full bg-muted animate-pulse rounded-lg flex items-center justify-center">
      <span className="text-muted-foreground">Loading map...</span>
    </div>
  );
};

const ChartSkeleton = () => {
  return (
    <div className="w-full h-64 bg-muted animate-pulse rounded-lg flex items-center justify-center">
      <span className="text-muted-foreground">Loading chart...</span>
    </div>
  );
};

const TableSkeleton = () => {
  return (
    <div className="w-full space-y-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-12 bg-muted animate-pulse rounded" />
      ))}
    </div>
  );
};

// Dynamic imports with loading states
export const DynamicMap = dynamic(
  () => import('~/components/apartment/Map').then(mod => mod.default || mod.Map),
  {
    loading: () => <MapSkeleton />,
    ssr: false, // Maps don't work with SSR
  }
);

export const DynamicPropertyMap = dynamic(
  () => import('~/components/apartment/PropertyMap').then(mod => mod.default || mod.PropertyMap),
  {
    loading: () => <MapSkeleton />,
    ssr: false,
  }
);

export const DynamicStationChart = dynamic(
  () => import('~/components/charts/StationChart').then(mod => mod.default || mod.StationChart),
  {
    loading: () => <ChartSkeleton />,
  }
);

export const DynamicPriceChart = dynamic(
  () => import('~/components/charts/PriceChart').then(mod => mod.default || mod.PriceChart),
  {
    loading: () => <ChartSkeleton />,
  }
);

export const DynamicAnalyticsChart = dynamic(
  () => import('~/components/charts/AnalyticsChart').then(mod => mod.default || mod.AnalyticsChart),
  {
    loading: () => <ChartSkeleton />,
  }
);

export const DynamicDataTable = dynamic(
  () => import('~/components/ui/data-table').then(mod => mod.default || mod.DataTable),
  {
    loading: () => <TableSkeleton />,
  }
);

// Utility function for custom dynamic imports
export function createDynamicComponent<P = {}>(
  importFn: () => Promise<{ default: ComponentType<P> } | ComponentType<P>>,
  options?: {
    loading?: ComponentType;
    ssr?: boolean;
  }
): ComponentType<P> {
  return dynamic(
    async () => {
      const module = await importFn();
      return 'default' in module ? module : { default: module };
    },
    {
      loading: options?.loading || (() => <div className="animate-pulse">Loading...</div>),
      ssr: options?.ssr ?? true,
    }
  );
}

// Preload utilities for critical dynamic components
export const preloadMap = () => {
  void import('~/components/apartment/Map');
};

export const preloadCharts = () => {
  void import('~/components/charts/StationChart');
  void import('~/components/charts/PriceChart');
};

// Usage example:
/*
import { DynamicMap, preloadMap } from '~/lib/performance/dynamic-imports';

// In your component
function PropertyPage() {
  // Preload on hover or focus
  const handleMapHover = () => {
    preloadMap();
  };

  return (
    <div onMouseEnter={handleMapHover}>
      <DynamicMap properties={properties} />
    </div>
  );
}
*/