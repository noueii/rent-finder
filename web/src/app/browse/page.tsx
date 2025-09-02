'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { TinderApartmentView } from '~/components/TinderApartmentView';
// import { SearchForm } from '~/components/SearchForm';
import { LoadingSpinner } from '~/components/LoadingSpinner';
import { ErrorMessage } from '~/components/ErrorMessage';
import { api } from '~/utils/api';
import { useApartmentLists } from '~/hooks/useUserLists';
import { useLocalUserLists } from '~/hooks/useLocalUserLists';
import { Settings, ArrowLeft } from 'lucide-react';

// Helper function to map area to filter
function getAreaFilter(area: string) {
  const areaMap: Record<string, { cities?: string[]; wards?: string[] }> = {
    'central': { wards: ['千代田区', '中央区', '港区'] },
    'shibuya-shinjuku': { wards: ['渋谷区', '新宿区'] },
    'east': { wards: ['墨田区', '江東区', '台東区'] },
    'west': { wards: ['杉並区', '中野区', '練馬区'] },
    'north': { wards: ['北区', '足立区', '荒川区'] },
    'south': { wards: ['品川区', '大田区', '目黒区'] },
  };
  
  return areaMap[area] || {};
}

// Helper function to get area label
function getAreaLabel(area: string): string {
  const areaLabels: Record<string, string> = {
    'central': 'Central Tokyo',
    'shibuya-shinjuku': 'Shibuya/Shinjuku',
    'east': 'East Tokyo',
    'west': 'West Tokyo',
    'north': 'North Tokyo',
    'south': 'South Tokyo',
    'tama': 'Tama Area',
  };
  
  return areaLabels[area] || area;
}

// Helper function to map sort options
function mapSortBy(sortBy: string): 'price_asc' | 'price_desc' | 'size_asc' | 'size_desc' | 'commute_asc' | 'commute_desc' | 'walking_asc' | 'walking_desc' | 'building_age_asc' | 'building_age_desc' | 'updated_desc' | 'updated_asc' {
  const sortMap: Record<string, any> = {
    'rent_asc': 'price_asc',
    'rent_desc': 'price_desc',
    'size_asc': 'size_asc',
    'size_desc': 'size_desc',
    'newest': 'updated_desc',
    'commute_time': 'commute_asc',
  };
  
  return sortMap[sortBy] || 'price_asc';
}

export default function BrowsePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const { lists, toggleHidden, toggleLiked } = useLocalUserLists();
  
  // Get search parameters from URL
  const targetStation = searchParams.get('station') || '';
  const maxCommuteTimeParam = searchParams.get('maxTime');
  const maxCommuteTime = maxCommuteTimeParam ? parseInt(maxCommuteTimeParam) : 30;
  const maxRentParam = searchParams.get('maxRent');
  const maxRent = maxRentParam ? parseInt(maxRentParam) : undefined;
  const minRoomsParam = searchParams.get('minRooms');
  const minRooms = minRoomsParam ? parseInt(minRoomsParam) : undefined;
  const minSizeParam = searchParams.get('minSize');
  const minSize = minSizeParam ? parseInt(minSizeParam) : undefined;
  const maxSizeParam = searchParams.get('maxSize');
  const maxSize = maxSizeParam ? parseInt(maxSizeParam) : undefined;
  const area = searchParams.get('area') || '';
  const sortBy = searchParams.get('sortBy') || 'rent_asc';
  
  const hasValidFilters = Boolean(targetStation && !isNaN(maxCommuteTime) && maxCommuteTime > 0);

  // Search apartments based on filters
  const { data: searchResult, isLoading, error, refetch } = api.search.searchApartments.useQuery(
    {
      filters: {
        targetStation,
        maxCommuteTime,
        maxPrice: maxRent,
        layouts: minRooms ? [`${minRooms}LDK`, `${minRooms}DK`, `${minRooms}K`] : undefined,
        minSize,
        maxSize,
        // Add area filtering if we map it to cities/wards
        ...(area && getAreaFilter(area)),
      },
      pagination: {
        page: 1,
        limit: 100, // Get more apartments for browsing
      },
      sorting: {
        sortBy: mapSortBy(sortBy),
      },
    },
    {
      enabled: hasValidFilters,
    }
  );
  
  const apartments = searchResult?.apartments;

  // Get hidden list status for apartments
  const apartmentIds = apartments?.map(apt => apt.id) || [];
  const { listStatus } = useApartmentLists(apartmentIds);
  
  // Filter out hidden apartments from centralized store
  const availableApartments = apartments?.filter(apt => {
    return !lists.hidden.some(hiddenApt => hiddenApt.id === apt.id);
  }) || [];

  const handleSearch = (params: {
    targetStation: string;
    maxCommuteTime: number;
    maxRent?: number;
    minRooms?: number;
    minSize?: number;
    maxSize?: number;
    area?: string;
    sortBy?: string;
  }) => {
    const urlParams = new URLSearchParams();
    urlParams.set('station', params.targetStation);
    urlParams.set('maxTime', params.maxCommuteTime.toString());
    if (params.maxRent) urlParams.set('maxRent', params.maxRent.toString());
    if (params.minRooms) urlParams.set('minRooms', params.minRooms.toString());
    if (params.minSize) urlParams.set('minSize', params.minSize.toString());
    if (params.maxSize) urlParams.set('maxSize', params.maxSize.toString());
    if (params.area) urlParams.set('area', params.area);
    if (params.sortBy) urlParams.set('sortBy', params.sortBy);
    
    router.push(`/browse?${urlParams.toString()}`);
    setShowFilters(false);
    // Don't reset hidden apartments on new search - keep them persistent
  };

  const handleSwipeLeft = (apartmentId: string) => {
    const apartment = apartments?.find(apt => apt.id === apartmentId);
    if (apartment) {
      toggleHidden(apartment);
    }
  };

  const handleSwipeRight = (apartmentId: string) => {
    const apartment = apartments?.find(apt => apt.id === apartmentId);
    if (apartment) {
      toggleLiked(apartment);
    }
  };

  // Show filters if no valid search parameters
  useEffect(() => {
    if (!hasValidFilters) {
      setShowFilters(true);
    }
  }, [hasValidFilters]);

  // Prevent body scrolling on mobile
  useEffect(() => {
    // Prevent scroll on body and document
    const originalBodyStyle = {
      overflow: document.body.style.overflow,
      height: document.body.style.height,
      position: document.body.style.position
    };
    const originalHtmlStyle = {
      overflow: document.documentElement.style.overflow,
      height: document.documentElement.style.height
    };
    
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100vh';
    document.body.style.height = '100dvh';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.height = '100vh';
    document.documentElement.style.height = '100dvh';
    
    return () => {
      // Restore original styles when leaving page
      document.body.style.overflow = originalBodyStyle.overflow;
      document.body.style.height = originalBodyStyle.height;
      document.body.style.position = originalBodyStyle.position;
      document.body.style.width = '';
      document.documentElement.style.overflow = originalHtmlStyle.overflow;
      document.documentElement.style.height = originalHtmlStyle.height;
    };
  }, []);

  return (
    <div className="bg-gray-50 overflow-hidden flex flex-col fixed inset-0" style={{ height: '100vh', height: '100dvh' }}>
      {/* Header */}
      <div className="bg-white shadow-sm z-10 flex-shrink-0">
        <div className="max-w-md mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => router.back()}
              className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            
            <h1 className="text-base font-semibold">Browse Apartments</h1>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
            >
              <Settings size={18} />
            </button>
          </div>
          
          {/* Compact Filters Display */}
          {hasValidFilters && !showFilters && (
            <div className="text-xs text-gray-600 flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1">
              <span className="font-medium text-gray-800">{targetStation}</span>
              <span className="text-gray-400">•</span>
              <span>{maxCommuteTime}min</span>
              {maxRent && (
                <>
                  <span className="text-gray-400">•</span>
                  <span>¥{(maxRent/1000).toFixed(0)}k</span>
                </>
              )}
              {minRooms && (
                <>
                  <span className="text-gray-400">•</span>
                  <span>{minRooms}R+</span>
                </>
              )}
              {(minSize || maxSize) && (
                <>
                  <span className="text-gray-400">•</span>
                  <span>
                    {minSize && maxSize 
                      ? `${minSize}-${maxSize}m²`
                      : minSize 
                        ? `${minSize}m²+`
                        : `≤${maxSize}m²`
                    }
                  </span>
                </>
              )}
              {area && (
                <>
                  <span className="text-gray-400">•</span>
                  <span>{getAreaLabel(area).split(' ')[0]}</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white border-b shadow-sm">
          <div className="max-w-2xl mx-auto px-4 py-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Search Filters</h2>
              {hasValidFilters && (
                <button
                  onClick={() => setShowFilters(false)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Close
                </button>
              )}
            </div>
            {/* <SearchForm 
              onSearch={handleSearch} 
              initialValues={{
                targetStation,
                maxCommuteTime,
                maxRent,
                minRooms,
                minSize,
                maxSize,
                area,
                sortBy,
              }}
            /> */}
            <div className="text-center py-4">
              <p className="text-gray-500">Search form temporarily disabled</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 px-4 py-4 overflow-hidden">
        {!hasValidFilters ? (
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              Set your search criteria
            </h2>
            <p className="text-gray-500 mb-6">
              Choose your target station and preferences to start browsing apartments
            </p>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="py-12">
            <ErrorMessage 
              message="Failed to load apartments. Please try again." 
              onRetry={() => refetch()}
            />
          </div>
        ) : availableApartments.length === 0 ? (
          <div className="text-center py-12">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              {apartments?.length === 0 ? "No apartments found" : "No more apartments"}
            </h3>
            <p className="text-gray-500 mb-6">
              {apartments?.length === 0 
                ? "Try adjusting your search criteria to see more results."
                : "You've seen all available apartments. Try adjusting your filters or check back later for new listings."
              }
            </p>
            <button
              onClick={() => setShowFilters(true)}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Adjust Filters
            </button>
          </div>
        ) : (
          <div className="h-full">
            <TinderApartmentView
              apartments={availableApartments}
              filters={{
                targetStation,
                maxCommuteTime,
                maxRent,
                minRooms,
              }}
              onSwipeLeft={handleSwipeLeft}
              onSwipeRight={handleSwipeRight}
            />
          </div>
        )}
      </div>

    </div>
  );
}