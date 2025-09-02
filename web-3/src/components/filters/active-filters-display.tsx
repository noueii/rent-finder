'use client';

// TODO: Fix useFilters import - context not implemented yet
// import { useFilters } from '~/contexts';
import { Badge } from '~/presentation/components/ui';
import { Button } from '~/components/ui/button';

export function ActiveFiltersDisplay() {
  // TODO: Implement filters context
  // const { filters, resetFilter, clearFilters } = useFilters();
  const filters = {} as any;
  const resetFilter = (key: string) => {};
  const clearFilters = () => {};

  const activeFilters: { key: string; value: string; onRemove: () => void }[] = [];

  // Price filters
  if (filters.minRent || filters.maxRent) {
    const min = filters.minRent ? `¥${filters.minRent.toLocaleString()}` : '';
    const max = filters.maxRent ? `¥${filters.maxRent.toLocaleString()}` : '';
    activeFilters.push({
      key: 'price',
      value: `Price: ${min}${min && max ? ' - ' : ''}${max}`,
      onRemove: () => {
        resetFilter('minRent');
        resetFilter('maxRent');
      },
    });
  }

  // Commute time
  if (filters.maxCommuteTime) {
    activeFilters.push({
      key: 'commute',
      value: `Max commute: ${filters.maxCommuteTime}min`,
      onRemove: () => resetFilter('maxCommuteTime'),
    });
  }

  // Area filters
  if (filters.minArea || filters.maxArea) {
    const min = filters.minArea ? `${filters.minArea}m²` : '';
    const max = filters.maxArea ? `${filters.maxArea}m²` : '';
    activeFilters.push({
      key: 'area',
      value: `Area: ${min}${min && max ? ' - ' : ''}${max}`,
      onRemove: () => {
        resetFilter('minArea');
        resetFilter('maxArea');
      },
    });
  }

  // Property types
  if (filters.propertyTypes && filters.propertyTypes.length > 0) {
    filters.propertyTypes.forEach((type: string) => {
      activeFilters.push({
        key: `type-${type}`,
        value: type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' '),
        onRemove: () => {
          const updated = filters.propertyTypes?.filter((t: string) => t !== type) || [];
          resetFilter('propertyTypes');
          if (updated.length > 0) {
            // Re-apply the remaining types
            setTimeout(() => {
              resetFilter('propertyTypes');
            }, 0);
          }
        },
      });
    });
  }

  // Features
  if (filters.features && filters.features.length > 0) {
    filters.features.forEach((feature: string) => {
      activeFilters.push({
        key: `feature-${feature}`,
        value: feature.split('-').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
        onRemove: () => {
          const updated = filters.features?.filter((f: string) => f !== feature) || [];
          resetFilter('features');
          if (updated.length > 0) {
            // Re-apply the remaining features
            setTimeout(() => {
              resetFilter('features');
            }, 0);
          }
        },
      });
    });
  }

  // Stations
  if (filters.stations && filters.stations.length > 0) {
    filters.stations.forEach((station: any) => {
      activeFilters.push({
        key: `station-${station}`,
        value: `Station: ${station}`,
        onRemove: () => {
          const updated = filters.stations?.filter((s: any) => s !== station) || [];
          resetFilter('stations');
          if (updated.length > 0) {
            // Re-apply the remaining stations
            setTimeout(() => {
              resetFilter('stations');
            }, 0);
          }
        },
      });
    });
  }

  if (activeFilters.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Active filters:</span>
      {activeFilters.map((filter) => (
        <Badge 
          key={filter.key} 
          variant="secondary" 
          removable
          onRemove={filter.onRemove}
        >
          {filter.value}
        </Badge>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={clearFilters}
        className="text-muted-foreground"
      >
        Clear all
      </Button>
    </div>
  );
}