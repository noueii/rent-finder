'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { api } from '~/utils/api';
import { useSearchFilters } from '~/hooks/useSearchFilters';
import { useLocalUserLists } from '~/hooks/useLocalUserLists';
import { ImageScrapeButton } from '~/components/ImageScrapeButton';
import { useNavigationWithPreferences } from '~/hooks/useNavigationWithPreferences';

// Dynamically import the map component to avoid SSR issues
const ApartmentMap = dynamic(() => import('~/components/ApartmentMap').then(mod => ({ default: mod.ApartmentMap })), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
      <div className="text-gray-500">Loading map...</div>
    </div>
  ),
});

export default function MapPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { navigateToSearch, getUrlWithPreferences } = useNavigationWithPreferences();
  const { filters } = useSearchFilters();
  const [selectedApartment, setSelectedApartment] = useState<string | null>(null);
  const [mapBounds, setMapBounds] = useState<{
    north: number;
    south: number;
    east: number;
    west: number;
  } | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  
  // Use local apartment lists
  const { lists, getListStatus, toggleSaved, toggleStarred, toggleLiked, toggleBlocked } = useLocalUserLists();

  // Parse URL parameters for search filters
  const getParamNumber = (key: string, defaultValue?: number) => {
    const value = searchParams.get(key);
    return value ? Number(value) : defaultValue;
  };

  // Use URL params if available, otherwise use saved filters
  const currentFilters = {
    targetStation: searchParams.get('station') || filters.targetStation,
    maxCommuteTime: getParamNumber('commuteTime') || filters.maxCommuteTime,
    minPrice: getParamNumber('minPrice', filters.minPrice || 50000),
    maxPrice: getParamNumber('maxPrice', filters.maxPrice || 200000),
    minSize: getParamNumber('minSize', filters.minSize || 20),
    maxSize: getParamNumber('maxSize', filters.maxSize || 80),
  };

  // Fetch stations with apartments
  const { data: mapData, isLoading, error } = api.search.getStationsWithApartments.useQuery(
    {
      filters: currentFilters,
    },
    {
      enabled: !!(currentFilters.targetStation && currentFilters.maxCommuteTime),
    }
  );

  // Filter stations that are visible in current map bounds
  const visibleStations = mapBounds && mapData?.stations ? 
    mapData.stations.filter(station => 
      station.latitude >= mapBounds.south &&
      station.latitude <= mapBounds.north &&
      station.longitude >= mapBounds.west &&
      station.longitude <= mapBounds.east
    ) : [];

  // Get all apartments from visible stations and filter out blocked ones
  const visibleApartments = visibleStations.flatMap(station => 
    station.apartments
      .filter(apartment => !lists.blocked.some(blockedApt => blockedApt.id === apartment.id))
      .map(apartment => ({
        ...apartment,
        stationName: station.name,
        stationId: station.id,
        // Add missing properties that might be expected
        address: apartment.address || `Near ${station.name}`,
        buildingAge: apartment.buildingAge || undefined,
        imageUrls: apartment.imageUrls || [],
      commuteInfo: apartment.commuteInfo || undefined,
    }))
  )
  .sort((a, b) => a.rentMonthly - b.rentMonthly) // Sort by price ascending
  .slice(0, 100); // Limit to 100 for performance


  const handleApartmentSelect = (apartmentId: string) => {
    router.push(`/apartment/${apartmentId}`);
  };

  const handleMapBoundsChange = (bounds: { north: number; south: number; east: number; west: number }) => {
    setMapBounds(bounds);
  };

  const handleBackToList = () => {
    // Build URL with current search parameters
    const params = new URLSearchParams();
    if (currentFilters.targetStation) params.set('station', currentFilters.targetStation);
    if (currentFilters.maxCommuteTime) params.set('commuteTime', currentFilters.maxCommuteTime.toString());
    if (currentFilters.minPrice !== 50000) params.set('minPrice', currentFilters.minPrice.toString());
    if (currentFilters.maxPrice !== 200000) params.set('maxPrice', currentFilters.maxPrice.toString());
    if (currentFilters.minSize !== 20) params.set('minSize', currentFilters.minSize.toString());
    if (currentFilters.maxSize !== 80) params.set('maxSize', currentFilters.maxSize.toString());
    
    navigateToSearch({
      station: currentFilters.targetStation,
      commuteTime: currentFilters.maxCommuteTime,
      minPrice: currentFilters.minPrice !== 50000 ? currentFilters.minPrice : undefined,
      maxPrice: currentFilters.maxPrice !== 200000 ? currentFilters.maxPrice : undefined,
      minSize: currentFilters.minSize !== 20 ? currentFilters.minSize : undefined,
      maxSize: currentFilters.maxSize !== 80 ? currentFilters.maxSize : undefined,
    });
  };

  if (!currentFilters.targetStation || !currentFilters.maxCommuteTime) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Map View</h1>
          <p className="text-gray-600 mb-6">Please select a target station and commute time to view apartments on the map.</p>
          <Link
            href={getUrlWithPreferences('search')}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
          >
            Go to Search
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBackToList}
                className="inline-flex items-center text-blue-600 hover:text-blue-800"
              >
                <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to List View
              </button>
              
              <h1 className="text-xl font-bold text-gray-900">
                Map View - Apartments within {currentFilters.maxCommuteTime} min
              </h1>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-500">
                {mapData?.stations?.length || 0} stations • {mapData?.totalApartments || 0} apartments
              </div>
              
              <ImageScrapeButton
                filters={{
                  targetStation: currentFilters.targetStation,
                  maxCommuteTime: currentFilters.maxCommuteTime,
                  minPrice: currentFilters.minPrice,
                  maxPrice: currentFilters.maxPrice,
                }}
                apartmentIds={visibleApartments.map(apt => apt.id)}
                onScrapingComplete={() => {
                  // Optionally refresh to show new images
                  window.location.reload();
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Map + Sidebar */}
      <div className="h-[calc(100vh-4rem)] flex">
        {/* Map Container */}
        <div className={`${showSidebar ? 'flex-1' : 'w-full'} relative`}>
          {/* Toggle Sidebar Button */}
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="absolute top-4 right-4 z-[1000] bg-white shadow-lg rounded-lg p-2 hover:bg-gray-50"
            title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {showSidebar ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          {isLoading ? (
            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading apartments...</p>
              </div>
            </div>
          ) : error ? (
            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Error Loading Map</h2>
                <p className="text-gray-600 mb-4">{error.message}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : mapData?.stations ? (
            <ApartmentMap
              stations={mapData.stations}
              onApartmentSelect={handleApartmentSelect}
              onBoundsChange={handleMapBoundsChange}
            />
          ) : (
            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-900 mb-2">No Apartments Found</h2>
                <p className="text-gray-600 mb-4">
                  No apartments found within {currentFilters.maxCommuteTime} minutes of your target station.
                </p>
                <button
                  onClick={handleBackToList}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Adjust Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - Viewport Apartments */}
        {showSidebar && (
          <div className="w-96 bg-white border-l border-gray-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">
                  Apartments in View
                </h2>
                {mapBounds && (
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {mapBounds ? (
                  `${visibleApartments.length} apartments visible`
                ) : (
                  'Move the map to see apartments in this area'
                )}
              </p>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {mapBounds && visibleApartments.length > 0 ? (
                <div className="p-4 space-y-4">
                  {visibleApartments.map((apartment) => (
                    <div
                      key={apartment.id}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => handleApartmentSelect(apartment.id)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold text-gray-900 text-sm line-clamp-2 flex-1 pr-2">
                          {apartment.title}
                        </h4>
                        <div className="flex items-center gap-1">
                          {/* Save Button */}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleSaved(apartment);
                            }}
                            className="p-1 rounded hover:bg-gray-100 transition-colors"
                            title="Save for later"
                          >
                            {getListStatus(apartment.id).saved ? (
                              <svg className="w-4 h-4 text-gray-900" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 text-gray-600 hover:text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                              </svg>
                            )}
                          </button>

                          {/* Star Button */}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleStarred(apartment);
                            }}
                            className="p-1 rounded hover:bg-gray-100 transition-colors"
                            title="Add to favorites"
                          >
                            {getListStatus(apartment.id).starred ? (
                              <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 text-gray-600 hover:text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                      
                      <div className="text-lg font-bold text-gray-900 mb-2">
                        ¥{apartment.rentMonthly.toLocaleString()}
                        <span className="text-xs font-normal text-gray-500">/month</span>
                      </div>
                      
                      <div className="flex items-center gap-3 text-xs text-gray-600 mb-2">
                        <span>{apartment.size}m² • {apartment.layout}</span>
                        <span>•</span>
                        <span>{apartment.walkingMinutes} min walk</span>
                      </div>
                      
                      <div className="text-xs text-gray-600">
                        <span>{apartment.stationName}</span>
                      </div>
                      
                      {apartment.commuteInfo && (
                        <div className="mt-2 bg-blue-50 rounded px-2 py-1 text-xs">
                          <span className="text-blue-700 font-medium">
                            {apartment.commuteInfo.totalTime} min commute • {apartment.commuteInfo.transfers} transfers
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : mapBounds && visibleApartments.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-gray-400 mb-2">
                    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <p className="text-gray-600 text-sm">No apartments in this area</p>
                </div>
              ) : !mapBounds ? (
                <div className="p-8 text-center">
                  <div className="text-gray-400 mb-2">
                    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <p className="text-gray-600 text-sm">Pan around the map to see apartments</p>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}