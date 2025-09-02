'use client';

import { useState } from 'react';
import { StationSearch } from '~/components/StationSearch';
import { SearchFilterValues } from '~/app/search/page';
import { 
  Filter, 
  DollarSign, 
  Home, 
  MapPin, 
  Building, 
  Train,
  Heart,
  Bookmark,
  Star,
  EyeOff,
  Clock
} from 'lucide-react';

interface SearchFiltersProps {
  filters: SearchFilterValues;
  onFiltersChange: (filters: SearchFilterValues) => void;
  onApplyFilters: () => void;
  isLoading?: boolean;
}

export function SearchFilters({
  filters,
  onFiltersChange,
  onApplyFilters,
  isLoading = false,
}: SearchFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const updateFilter = <K extends keyof SearchFilterValues>(
    key: K,
    value: SearchFilterValues[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };
  
  const layoutOptions = ['1K', '1DK', '1LDK', '2K', '2DK', '2LDK', '3K', '3DK', '3LDK', '4LDK+'];
  const wardOptions = [
    '千代田区', '中央区', '港区', '新宿区', '文京区', '台東区',
    '墨田区', '江東区', '品川区', '目黒区', '大田区', '世田谷区',
    '渋谷区', '中野区', '杉並区', '豊島区', '北区', '荒川区',
    '板橋区', '練馬区', '足立区', '葛飾区', '江戸川区'
  ];
  
  const listTypes = [
    { value: 'saved', label: 'Saved', icon: Bookmark },
    { value: 'liked', label: 'Liked', icon: Heart },
    { value: 'favorites', label: 'Favorites', icon: Star },
    { value: 'hidden', label: 'Hidden', icon: EyeOff },
  ];
  
  const sortOptions = [
    { value: 'price_asc', label: 'Price: Low to High' },
    { value: 'price_desc', label: 'Price: High to Low' },
    { value: 'size_asc', label: 'Size: Small to Large' },
    { value: 'size_desc', label: 'Size: Large to Small' },
    { value: 'newest', label: 'Newest First' },
    { value: 'commute_asc', label: 'Shortest Commute' },
  ];
  
  const hasActiveFilters = () => {
    return !!(
      filters.maxRent ||
      filters.minRent ||
      filters.minSize ||
      filters.maxSize ||
      filters.layouts?.length ||
      filters.targetStation ||
      filters.maxCommuteTime ||
      filters.wards?.length ||
      filters.maxBuildingAge ||
      filters.minBuildingAge ||
      (filters.includeFromLists?.length && filters.includeFromLists.length > 0) ||
      (filters.excludeFromLists?.length && filters.excludeFromLists.length !== 1)
    );
  };
  
  const clearFilters = () => {
    onFiltersChange({
      sortBy: 'price_asc',
      excludeFromLists: ['hidden'],
    });
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Filter size={20} />
          Filters
        </h2>
        {hasActiveFilters() && (
          <button
            onClick={clearFilters}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Clear all
          </button>
        )}
      </div>
      
      {/* Commute Time Filter */}
      <div className="space-y-3">
        <h3 className="font-medium flex items-center gap-2">
          <Train size={16} />
          Commute Time
        </h3>
        <StationSearch
          id={filters.targetStation || ''}
          onSelect={(stationId, stationName) => updateFilter('targetStation', stationId)}
          placeholder="Select target station"
        />
        {filters.targetStation && (
          <div className="space-y-2">
            <label className="text-sm text-gray-600">
              Max commute time (minutes)
            </label>
            <input
              type="number"
              value={filters.maxCommuteTime || ''}
              onChange={(e) => updateFilter('maxCommuteTime', e.target.value ? parseInt(e.target.value) : undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., 30"
              min="5"
              max="120"
            />
          </div>
        )}
      </div>
      
      {/* Price Range */}
      <div className="space-y-3">
        <h3 className="font-medium flex items-center gap-2">
          <DollarSign size={16} />
          Monthly Rent
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            value={filters.minRent || ''}
            onChange={(e) => updateFilter('minRent', e.target.value ? parseInt(e.target.value) : undefined)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Min"
          />
          <input
            type="number"
            value={filters.maxRent || ''}
            onChange={(e) => updateFilter('maxRent', e.target.value ? parseInt(e.target.value) : undefined)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Max"
          />
        </div>
      </div>
      
      {/* Size Range */}
      <div className="space-y-3">
        <h3 className="font-medium flex items-center gap-2">
          <Home size={16} />
          Size (m²)
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            value={filters.minSize || ''}
            onChange={(e) => updateFilter('minSize', e.target.value ? parseInt(e.target.value) : undefined)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Min"
          />
          <input
            type="number"
            value={filters.maxSize || ''}
            onChange={(e) => updateFilter('maxSize', e.target.value ? parseInt(e.target.value) : undefined)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Max"
          />
        </div>
      </div>
      
      {/* Layout */}
      <div className="space-y-3">
        <h3 className="font-medium">Layout</h3>
        <div className="grid grid-cols-3 gap-2">
          {layoutOptions.map((layout) => (
            <label
              key={layout}
              className="flex items-center justify-center"
            >
              <input
                type="checkbox"
                checked={filters.layouts?.includes(layout) || false}
                onChange={(e) => {
                  const layouts = filters.layouts || [];
                  if (e.target.checked) {
                    updateFilter('layouts', [...layouts, layout]);
                  } else {
                    updateFilter('layouts', layouts.filter(l => l !== layout));
                  }
                }}
                className="sr-only"
              />
              <span
                className={`px-3 py-1.5 text-sm rounded-md cursor-pointer transition-colors ${
                  filters.layouts?.includes(layout)
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {layout}
              </span>
            </label>
          ))}
        </div>
      </div>
      
      {/* List Filters */}
      <div className="space-y-3">
        <h3 className="font-medium">List Filters</h3>
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Exclude apartments from:</p>
          {listTypes.map(({ value, label, icon: Icon }) => (
            <label key={value} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.excludeFromLists?.includes(value as any) || false}
                onChange={(e) => {
                  const excludeList = filters.excludeFromLists || [];
                  if (e.target.checked) {
                    updateFilter('excludeFromLists', [...excludeList, value] as any);
                  } else {
                    updateFilter('excludeFromLists', excludeList.filter(l => l !== value) as any);
                  }
                }}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <Icon size={16} />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </div>
      
      {/* Advanced Filters Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        {isExpanded ? 'Hide' : 'Show'} advanced filters
      </button>
      
      {/* Advanced Filters */}
      {isExpanded && (
        <>
          {/* Location */}
          <div className="space-y-3">
            <h3 className="font-medium flex items-center gap-2">
              <MapPin size={16} />
              Location (Wards)
            </h3>
            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md p-2">
              {wardOptions.map((ward) => (
                <label key={ward} className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    checked={filters.wards?.includes(ward) || false}
                    onChange={(e) => {
                      const wards = filters.wards || [];
                      if (e.target.checked) {
                        updateFilter('wards', [...wards, ward]);
                      } else {
                        updateFilter('wards', wards.filter(w => w !== ward));
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">{ward}</span>
                </label>
              ))}
            </div>
          </div>
          
          {/* Building Age */}
          <div className="space-y-3">
            <h3 className="font-medium flex items-center gap-2">
              <Building size={16} />
              Building Age (years)
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={filters.minBuildingAge || ''}
                onChange={(e) => updateFilter('minBuildingAge', e.target.value ? parseInt(e.target.value) : undefined)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Min"
              />
              <input
                type="number"
                value={filters.maxBuildingAge || ''}
                onChange={(e) => updateFilter('maxBuildingAge', e.target.value ? parseInt(e.target.value) : undefined)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Max"
              />
            </div>
          </div>
        </>
      )}
      
      {/* Sort By */}
      <div className="space-y-3">
        <h3 className="font-medium">Sort By</h3>
        <select
          value={filters.sortBy || 'price_asc'}
          onChange={(e) => updateFilter('sortBy', e.target.value as any)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      
      {/* Apply Button */}
      <button
        onClick={onApplyFilters}
        disabled={isLoading}
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
      >
        {isLoading ? 'Searching...' : 'Apply Filters'}
      </button>
    </div>
  );
}