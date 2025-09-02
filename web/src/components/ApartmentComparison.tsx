'use client';

import { useState } from 'react';
import { useApartmentComparison } from '~/hooks/useApartmentComparison';
import { cn } from '~/utils/cn';
import { 
  ScaleIcon, 
  XMarkIcon, 
  TrashIcon,
  ArrowsUpDownIcon,
  HomeIcon,
  CurrencyYenIcon,
  ClockIcon,
  MapPinIcon,
  BuildingOfficeIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

interface ApartmentComparisonProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ApartmentComparison({ isOpen, onClose }: ApartmentComparisonProps) {
  const {
    comparisonApartments,
    removeFromComparison,
    clearComparisons,
    getComparisonStats,
  } = useApartmentComparison();

  const [sortBy, setSortBy] = useState<'rent' | 'size' | 'commute'>('rent');

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  const sortedApartments = [...comparisonApartments].sort((a, b) => {
    switch (sortBy) {
      case 'rent':
        return a.rentMonthly - b.rentMonthly;
      case 'size':
        return b.size - a.size;
      case 'commute':
        return a.commute.totalMinutes - b.commute.totalMinutes;
      default:
        return 0;
    }
  });

  const stats = getComparisonStats();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <ScaleIcon className="h-6 w-6 text-primary-600" />
            <h2 className="text-2xl font-bold text-gray-900">
              Compare Apartments ({comparisonApartments.length})
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {comparisonApartments.length > 0 && (
              <button
                onClick={clearComparisons}
                className="flex items-center gap-1 px-4 py-2 text-red-600 hover:text-red-700 transition-colors"
              >
                <TrashIcon className="h-4 w-4" />
                Clear All
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        {comparisonApartments.length === 0 ? (
          <div className="p-12 text-center">
            <ScaleIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No apartments selected for comparison
            </h3>
            <p className="text-gray-600">
              Add apartments to comparison from the search results to see them here
            </p>
          </div>
        ) : (
          <>
            {/* Controls */}
            <div className="flex items-center justify-between p-6 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700">Sort by:</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSortBy('rent')}
                    className={cn(
                      "px-3 py-1 rounded-md text-sm font-medium transition-colors",
                      sortBy === 'rent' 
                        ? "bg-primary-100 text-primary-700" 
                        : "bg-white text-gray-600 hover:bg-gray-100"
                    )}
                  >
                    Price
                  </button>
                  <button
                    onClick={() => setSortBy('size')}
                    className={cn(
                      "px-3 py-1 rounded-md text-sm font-medium transition-colors",
                      sortBy === 'size' 
                        ? "bg-primary-100 text-primary-700" 
                        : "bg-white text-gray-600 hover:bg-gray-100"
                    )}
                  >
                    Size
                  </button>
                  <button
                    onClick={() => setSortBy('commute')}
                    className={cn(
                      "px-3 py-1 rounded-md text-sm font-medium transition-colors",
                      sortBy === 'commute' 
                        ? "bg-primary-100 text-primary-700" 
                        : "bg-white text-gray-600 hover:bg-gray-100"
                    )}
                  >
                    Commute
                  </button>
                </div>
              </div>

              {/* Stats */}
              {stats && (
                <div className="flex items-center gap-6 text-sm text-gray-600">
                  <div className="text-center">
                    <div className="font-medium">{formatPrice(stats.rent.avg)}</div>
                    <div className="text-xs">Avg Rent</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium">{stats.size.avg}㎡</div>
                    <div className="text-xs">Avg Size</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium">{stats.commute.avg} min</div>
                    <div className="text-xs">Avg Commute</div>
                  </div>
                </div>
              )}
            </div>

            {/* Comparison Grid */}
            <div className="p-6 overflow-x-auto">
              <div className="min-w-max">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sortedApartments.map((apartment, index) => (
                    <div key={apartment.id} className="relative">
                      {/* Ranking badge */}
                      {sortBy === 'rent' && (
                        <div className={cn(
                          "absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white z-10",
                          index === 0 ? "bg-green-500" : index === 1 ? "bg-yellow-500" : "bg-red-500"
                        )}>
                          {index + 1}
                        </div>
                      )}

                      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                        {/* Remove button */}
                        <div className="absolute top-2 right-2 z-10">
                          <button
                            onClick={() => removeFromComparison(apartment.id)}
                            className="w-6 h-6 bg-white rounded-full shadow-sm flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Image */}
                        <div className="aspect-video bg-gray-100 flex items-center justify-center">
                          {apartment.imageUrls && apartment.imageUrls.length > 0 ? (
                            <img
                              src={apartment.imageUrls[0]}
                              alt={apartment.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="text-gray-400 text-sm">No image</div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="p-4 space-y-3">
                          <h3 className="font-semibold text-gray-900 line-clamp-2">
                            {apartment.title}
                          </h3>

                          {/* Key metrics */}
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="p-2 bg-gray-50 rounded">
                              <div className="text-lg font-bold text-primary-600">
                                {formatPrice(apartment.rentMonthly)}
                              </div>
                              <div className="text-xs text-gray-500">Monthly</div>
                            </div>
                            <div className="p-2 bg-gray-50 rounded">
                              <div className="text-lg font-bold text-green-600">
                                {apartment.size}㎡
                              </div>
                              <div className="text-xs text-gray-500">Size</div>
                            </div>
                            <div className="p-2 bg-gray-50 rounded">
                              <div className="text-lg font-bold text-blue-600">
                                {apartment.commute.totalMinutes}min
                              </div>
                              <div className="text-xs text-gray-500">Commute</div>
                            </div>
                          </div>

                          {/* Details */}
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <HomeIcon className="h-4 w-4 text-gray-400" />
                              <span>{apartment.layout}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPinIcon className="h-4 w-4 text-gray-400" />
                              <span>{apartment.station.name} ({apartment.walkingMinutes} min walk)</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <ClockIcon className="h-4 w-4 text-gray-400" />
                              <span>
                                {apartment.commute.transitMinutes} min transit
                                {apartment.commute.transferCount > 0 && (
                                  <span className="ml-1">• {apartment.commute.transferCount} transfer{apartment.commute.transferCount > 1 ? 's' : ''}</span>
                                )}
                              </span>
                            </div>
                            {apartment.buildingAge && (
                              <div className="flex items-center gap-2">
                                <BuildingOfficeIcon className="h-4 w-4 text-gray-400" />
                                <span>{apartment.buildingAge} years old</span>
                              </div>
                            )}
                          </div>

                          {/* Features */}
                          {apartment.features && apartment.features.length > 0 && (
                            <div className="pt-2 border-t border-gray-200">
                              <div className="flex items-center gap-1 mb-2">
                                <SparklesIcon className="h-4 w-4 text-gray-400" />
                                <span className="text-sm font-medium text-gray-700">Features</span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {apartment.features.slice(0, 3).map((feature, i) => (
                                  <span
                                    key={i}
                                    className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs"
                                  >
                                    {feature}
                                  </span>
                                ))}
                                {apartment.features.length > 3 && (
                                  <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                                    +{apartment.features.length - 3} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="pt-2 border-t border-gray-200">
                            <a
                              href={`/apartment/${apartment.id}`}
                              className="block w-full text-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors text-sm font-medium"
                            >
                              View Details
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}