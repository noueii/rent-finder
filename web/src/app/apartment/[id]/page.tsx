'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '~/utils/api';
import { useLocalUserLists } from '~/hooks/useLocalUserLists';
import { useUserSettings } from '~/hooks/useUserSettings';
import { ImageCarousel } from '~/components/ImageCarousel';
import { ApartmentMap } from '~/components/ApartmentMap';

// Action buttons component
function ActionButtons({ apartment }: { apartment: any }) {
  const { getListStatus, toggleSaved, toggleFavorites, toggleLiked, toggleHidden } = useLocalUserLists();
  const status = getListStatus(apartment.id);

  return (
    <div className="grid grid-cols-2 gap-2 mb-4">
      {/* Save Button */}
      <button
        onClick={() => toggleSaved(apartment)}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
          status.saved
            ? 'bg-gray-900 text-white border-gray-900'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
        }`}
        title="Save for later"
      >
        {status.saved ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        )}
        <span className="text-sm font-medium">Save</span>
      </button>
      
      {/* Star Button */}
      <button
        onClick={() => toggleFavorites(apartment)}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
          status.favorites
            ? 'bg-yellow-500 text-white border-yellow-500'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
        }`}
        title="Add to favorites"
      >
        {status.favorites ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        )}
        <span className="text-sm font-medium">Star</span>
      </button>
      
      {/* Heart Button */}
      <button
        onClick={() => toggleLiked(apartment)}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
          status.liked
            ? 'bg-red-500 text-white border-red-500'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
        }`}
        title="Like"
      >
        {status.liked ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        )}
        <span className="text-sm font-medium">Like</span>
      </button>
      
      {/* Block Button */}
      <button
        onClick={() => toggleHidden(apartment)}
        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors col-span-2 ${
          status.hidden
            ? 'bg-gray-900 text-white border-gray-900'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
        }`}
        title="Hide apartment"
      >
        {status.hidden ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
          </svg>
        )}
        <span className="text-sm font-medium">{status.hidden ? 'Unhide' : 'Hide'}</span>
      </button>
    </div>
  );
}

export default function ApartmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { settings } = useUserSettings();

  // Generate Google Maps directions URL
  const getDirectionsUrl = (stationName: string) => {
    // Use work location from settings, fallback to default
    const origin = settings.workLocation?.address || "Colorkrew、〒111-0041 Tokyo, Taito City, Motoasakusa, 3 Chome−7−1 住友不動産上野御徒町ビル 5階";
    const destination = `${stationName} Station, Tokyo, Japan`;
    
    // Use Google Maps with public transport mode (travelmode=transit)
    const params = new URLSearchParams({
      api: '1',
      origin: origin,
      destination: destination,
      travelmode: 'transit' // Public transport mode
    });
    
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  };

  // Fetch apartment details
  const { data: apartment, isLoading, error } = api.apartment.getById.useQuery(
    { apartmentId: id },
    { 
      enabled: !!id,
      onSuccess: (data) => {
        console.log('Apartment details:', data);
        console.log('Images:', data?.images);
        console.log('MainImageUrl:', data?.mainImageUrl);
      }
    }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading apartment details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Apartment</h1>
          <p className="text-gray-600 mb-4">{error.message}</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Search
          </button>
        </div>
      </div>
    );
  }

  if (!apartment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Apartment Not Found</h1>
          <p className="text-gray-600 mb-4">The apartment you're looking for doesn't exist.</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Search
          </button>
        </div>
      </div>
    );
  }

  // Build the source URL
  let sourceUrl = apartment.sourceUrl;
  if (apartment.sourceSite === 'yolo-home.com' && !apartment.sourceUrl?.startsWith('http')) {
    const propertyId = apartment.sourceUrl?.split('/').pop() || apartment.sourceUrl;
    sourceUrl = `https://yolo-home.com/en/property/${propertyId}`;
  } else if (apartment.sourceSite === 'realestate.co.jp' && !apartment.sourceUrl?.startsWith('http')) {
    const propertyId = apartment.sourceUrl?.split('/').pop() || apartment.sourceUrl;
    sourceUrl = `https://realestate.co.jp/en/rent/view/${propertyId}`;
  }

  // Show apartment details
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Back button */}
        <Link
          href="/"
          className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-6"
        >
          <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Search
        </Link>

        {/* Main content - Horizontal layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left column - Images */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <ImageCarousel 
                images={apartment.images || []}
                mainImageUrl={apartment.mainImageUrl}
                floorPlanUrl={apartment.floorPlanUrl}
                title={apartment.title || apartment.buildingName || 'Apartment'}
              />
            </div>
          </div>

          {/* Middle column - Details */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h1 className="text-xl font-bold text-gray-900 mb-4">
                {apartment.title || apartment.buildingName}
              </h1>

              {/* Price and Key Details */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600">Monthly Rent</p>
                  <p className="text-xl font-bold text-gray-900">¥{apartment.rentMonthly?.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Size</p>
                  <p className="text-xl font-bold text-gray-900">{apartment.size}m² • {apartment.layout}</p>
                </div>
              </div>

              {/* Property Details - Compact */}
              <div className="border-t pt-4 mb-4">
                <h3 className="text-md font-semibold text-gray-900 mb-3">Details</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Building:</span>
                    <span className="text-gray-900">{apartment.buildingName || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Unit:</span>
                    <span className="text-gray-900">{apartment.unitNumber || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type:</span>
                    <span className="text-gray-900">{apartment.buildingType || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Age:</span>
                    <span className="text-gray-900">
                      {apartment.buildingAge ? `${apartment.buildingAge}y` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Floor:</span>
                    <span className="text-gray-900">
                      {apartment.floor ? `${apartment.floor}F` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Mgmt Fee:</span>
                    <span className="text-gray-900">
                      {apartment.managementFee ? `¥${apartment.managementFee.toLocaleString()}` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Key Money:</span>
                    <span className="text-gray-900">
                      {apartment.keyMoney ? `¥${apartment.keyMoney.toLocaleString()}` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Deposit:</span>
                    <span className="text-gray-900">
                      {apartment.deposit ? `¥${apartment.deposit.toLocaleString()}` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Features - Compact */}
              {apartment.features && apartment.features.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="text-md font-semibold text-gray-900 mb-2">Features</h3>
                  <div className="flex flex-wrap gap-1">
                    {JSON.parse(apartment.features).slice(0, 8).map((feature: string, index: number) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                      >
                        {feature}
                      </span>
                    ))}
                    {JSON.parse(apartment.features).length > 8 && (
                      <span className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded">
                        +{JSON.parse(apartment.features).length - 8} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Location - Compact */}
            <div className="bg-white rounded-lg shadow-sm p-4 mt-4">
              <h3 className="text-md font-semibold text-gray-900 mb-3">Location</h3>
              <ApartmentMap 
                address={apartment.address}
                stationName={apartment.station?.name}
                walkingMinutes={apartment.walkingMinutes}
              />
            </div>
          </div>

          {/* Right column - Actions */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-4 sticky top-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>
              
              {/* Action Buttons */}
              <ActionButtons apartment={apartment} />
              
              {/* View on Source */}
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex justify-center items-center px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 mb-3"
                >
                  View on {apartment.sourceSite}
                  <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}

              {/* Google Maps Directions */}
              {apartment.station && (
                <a
                  href={getDirectionsUrl(apartment.station.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex justify-center items-center px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 mb-3"
                >
                  Transit to {apartment.station.name}
                  <svg className="ml-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2c-4.42 0-8 .5-8 4v10c0 1.1.9 2 2 2h1c.55 0 1.05-.22 1.41-.59.36-.36.59-.86.59-1.41v-1h8v1c0 .55.23 1.05.59 1.41.36.37.86.59 1.41.59h1c1.1 0 2-.9 2-2V6c0-3.5-3.58-4-8-4zM7.5 15C6.67 15 6 14.33 6 13.5S6.67 12 7.5 12s1.5.67 1.5 1.5S8.33 15 7.5 15zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM6 10V6h12v4H6z" />
                  </svg>
                </a>
              )}

              {/* Additional Info */}
              <div className="border-t pt-4 mt-4">
                <dl className="space-y-2">
                  <div>
                    <dt className="text-sm text-gray-600">Source</dt>
                    <dd className="text-sm font-medium text-gray-900">{apartment.sourceSite}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-600">Last Updated</dt>
                    <dd className="text-sm font-medium text-gray-900">
                      {new Date(apartment.updatedAt).toLocaleDateString()}
                    </dd>
                  </div>
                  {apartment.availableFrom && (
                    <div>
                      <dt className="text-sm text-gray-600">Available From</dt>
                      <dd className="text-sm font-medium text-gray-900">
                        {new Date(apartment.availableFrom).toLocaleDateString()}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}