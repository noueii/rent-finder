'use client';

import { 
  HomeIcon, 
  CalendarIcon, 
  BuildingOfficeIcon,
  MapPinIcon,
  CurrencyYenIcon,
  SparklesIcon,
  MapPinIcon as TrainIcon
} from '@heroicons/react/24/outline';

interface ApartmentDetailsProps {
  apartment: {
    id: string;
    title: string;
    buildingName?: string;
    unitNumber?: string;
    rentMonthly: number;
    managementFee?: number;
    keyMoney?: number;
    deposit?: number;
    size: number;
    sizeJo?: number;
    layout: string;
    layoutDetails?: string;
    address: string;
    buildingType?: string;
    buildingAge?: number;
    buildYear?: number;
    totalFloors?: number;
    floor?: string;
    features?: string[];
    nearbyFacilities?: string[];
    walkingMinutes: number;
    availableFrom?: string;
    station: {
      id: string;
      name: string;
      nameJa: string;
    };
    commute?: {
      totalMinutes: number;
      transitMinutes: number;
      walkingMinutes: number;
      transferCount: number;
      route?: any[];
    };
  };
}

export function ApartmentDetails({ apartment }: ApartmentDetailsProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Available now';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const parseFeatures = (features?: string[]) => {
    if (!features || !Array.isArray(features)) return [];
    return features;
  };

  const parseNearbyFacilities = (facilities?: string[]) => {
    if (!facilities || !Array.isArray(facilities)) return [];
    return facilities;
  };

  return (
    <div className="space-y-6">
      {/* Property Overview */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <HomeIcon className="h-5 w-5" />
          Property Overview
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Size</span>
              <span className="font-medium">
                {apartment.size}㎡
                {apartment.sizeJo && ` (${apartment.sizeJo} jo)`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Layout</span>
              <span className="font-medium">{apartment.layout}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Building Type</span>
              <span className="font-medium">{apartment.buildingType || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Floor</span>
              <span className="font-medium">
                {apartment.floor || 'N/A'}
                {apartment.totalFloors && ` / ${apartment.totalFloors}F`}
              </span>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Building Age</span>
              <span className="font-medium">
                {apartment.buildingAge ? `${apartment.buildingAge} years` : 'N/A'}
                {apartment.buildYear && ` (Built ${apartment.buildYear})`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Available From</span>
              <span className="font-medium">{formatDate(apartment.availableFrom)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Walking to Station</span>
              <span className="font-medium">{apartment.walkingMinutes} min</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Nearest Station</span>
              <span className="font-medium">{apartment.station.name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Details */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <CurrencyYenIcon className="h-5 w-5" />
          Pricing Details
        </h2>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Monthly Rent</span>
            <span className="text-2xl font-bold text-primary-600">
              {formatPrice(apartment.rentMonthly)}
            </span>
          </div>
          
          {apartment.managementFee && (
            <div className="flex justify-between">
              <span className="text-gray-600">Management Fee</span>
              <span className="font-medium">{formatPrice(apartment.managementFee)}</span>
            </div>
          )}
          
          {apartment.keyMoney && (
            <div className="flex justify-between">
              <span className="text-gray-600">Key Money</span>
              <span className="font-medium">{apartment.keyMoney} months</span>
            </div>
          )}
          
          {apartment.deposit && (
            <div className="flex justify-between">
              <span className="text-gray-600">Deposit</span>
              <span className="font-medium">{apartment.deposit} months</span>
            </div>
          )}
          
          <div className="border-t pt-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Monthly Cost</span>
              <span className="text-lg font-semibold">
                {formatPrice(apartment.rentMonthly + (apartment.managementFee || 0))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Location & Transport */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <MapPinIcon className="h-5 w-5" />
          Location & Transport
        </h2>
        
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Address</h3>
            <p className="text-gray-600">{apartment.address}</p>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Station Access</h3>
            <div className="flex items-center gap-2 text-gray-600">
              <TrainIcon className="h-4 w-4" />
              <span>{apartment.walkingMinutes} min walk to {apartment.station.name}</span>
            </div>
          </div>
          
          {apartment.commute && (
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Commute Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-lg font-semibold text-primary-600">
                    {apartment.commute.totalMinutes} min
                  </div>
                  <div className="text-gray-600">Total Commute</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-lg font-semibold text-green-600">
                    {apartment.commute.transitMinutes} min
                  </div>
                  <div className="text-gray-600">Transit Time</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-lg font-semibold text-blue-600">
                    {apartment.commute.transferCount}
                  </div>
                  <div className="text-gray-600">Transfer{apartment.commute.transferCount !== 1 ? 's' : ''}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Features & Amenities */}
      {parseFeatures(apartment.features).length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <SparklesIcon className="h-5 w-5" />
            Features & Amenities
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {parseFeatures(apartment.features).map((feature, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg"
              >
                <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
                <span className="text-gray-700">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nearby Facilities */}
      {parseNearbyFacilities(apartment.nearbyFacilities).length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BuildingOfficeIcon className="h-5 w-5" />
            Nearby Facilities
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {parseNearbyFacilities(apartment.nearbyFacilities).map((facility, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg"
              >
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-gray-700">{facility}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}