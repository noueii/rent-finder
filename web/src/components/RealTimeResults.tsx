'use client';

import { useState } from 'react';
import { 
  HomeIcon, 
  MapPinIcon, 
  BanknotesIcon as CurrencyYenIcon, 
  ClockIcon,
  SparklesIcon,
  BuildingOfficeIcon,
  ArrowTopRightOnSquareIcon as ExternalLinkIcon 
} from '@heroicons/react/24/outline';

interface ApartmentResult {
  id: string;
  title: string;
  rentMonthly: number;
  size: number;
  layout: string;
  address: string;
  stationId?: string;
  stationName?: string;
  walkingMinutes?: number;
  deposit?: number;
  keyMoney?: number;
  floor?: string;
  yearBuilt?: number;
  imageUrls?: string[];
  sourceUrl: string;
  commuteInfo?: {
    travelTime: number;
    transfers: number;
    totalTime: number;
    route: any[];
  };
}

interface SearchResult {
  apartments: ApartmentResult[];
  totalFound: number;
  searchTime: number;
  searchParams: any;
  reachableStations: number;
  source: string;
}

interface RealTimeResultsProps {
  results: SearchResult | null;
  isLoading: boolean;
  error: string | null;
}

export function RealTimeResults({ results, isLoading, error }: RealTimeResultsProps) {
  const [expandedApartment, setExpandedApartment] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Scraping Real Estate Data...
          </h3>
          <p className="text-gray-600">
            Please wait while we search for apartments on realestate.co.jp
          </p>
          <div className="mt-4 text-sm text-gray-500">
            <p>🔍 Searching rental listings...</p>
            <p>🚇 Calculating commute times...</p>
            <p>📊 Filtering results...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <ExternalLinkIcon className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Search Failed
          </h3>
          <p className="text-red-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">
            Please try again with different search criteria
          </p>
        </div>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8">
        <div className="text-center text-gray-500">
          <HomeIcon className="h-12 w-12 mx-auto mb-4" />
          <p>Use the search form above to find apartments</p>
        </div>
      </div>
    );
  }

  const { apartments, totalFound, searchTime, source, reachableStations } = results;

  return (
    <div className="space-y-6">
      {/* Search Summary */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            Search Results
          </h2>
          <span className="text-sm text-gray-500">
            Source: {source}
          </span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center">
            <HomeIcon className="h-5 w-5 text-blue-500 mr-2" />
            <span className="font-medium">{totalFound}</span>
            <span className="text-gray-600 ml-1">apartments found</span>
          </div>
          <div className="flex items-center">
            <ClockIcon className="h-5 w-5 text-green-500 mr-2" />
            <span className="font-medium">{searchTime}ms</span>
            <span className="text-gray-600 ml-1">search time</span>
          </div>
          {reachableStations > 0 && (
            <div className="flex items-center">
              <MapPinIcon className="h-5 w-5 text-purple-500 mr-2" />
              <span className="font-medium">{reachableStations}</span>
              <span className="text-gray-600 ml-1">reachable stations</span>
            </div>
          )}
          <div className="flex items-center">
            <SparklesIcon className="h-5 w-5 text-yellow-500 mr-2" />
            <span className="text-gray-600">Real-time data</span>
          </div>
        </div>
      </div>

      {/* Results List */}
      {apartments.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <HomeIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No apartments found
          </h3>
          <p className="text-gray-600">
            Try adjusting your search criteria or expanding your commute time
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {apartments.map((apartment) => (
            <div 
              key={apartment.id} 
              className="bg-white rounded-lg shadow-sm border border-gray-200 hover:border-blue-300 transition-colors"
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {apartment.title}
                    </h3>
                    
                    <div className="flex items-center text-sm text-gray-600 mb-3">
                      <MapPinIcon className="h-4 w-4 mr-1" />
                      <span>{apartment.address}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center">
                        <CurrencyYenIcon className="h-4 w-4 text-green-500 mr-1" />
                        <span className="font-medium text-green-600">
                          ¥{apartment.rentMonthly.toLocaleString()}
                        </span>
                      </div>
                      
                      <div className="flex items-center">
                        <BuildingOfficeIcon className="h-4 w-4 text-blue-500 mr-1" />
                        <span>{apartment.size}m² • {apartment.layout}</span>
                      </div>
                      
                      {apartment.stationName && (
                        <div className="flex items-center">
                          <MapPinIcon className="h-4 w-4 text-purple-500 mr-1" />
                          <span>{apartment.stationName}</span>
                          {apartment.walkingMinutes && (
                            <span className="text-gray-500 ml-1">
                              ({apartment.walkingMinutes}min)
                            </span>
                          )}
                        </div>
                      )}
                      
                      {apartment.commuteInfo && (
                        <div className="flex items-center">
                          <ClockIcon className="h-4 w-4 text-orange-500 mr-1" />
                          <span className="font-medium text-orange-600">
                            {apartment.commuteInfo.totalTime}min commute
                          </span>
                          <span className="text-gray-500 ml-1">
                            ({apartment.commuteInfo.transfers} transfers)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => setExpandedApartment(
                        expandedApartment === apartment.id ? null : apartment.id
                      )}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      {expandedApartment === apartment.id ? 'Less' : 'More'}
                    </button>
                    
                    <a
                      href={apartment.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 flex items-center"
                    >
                      View
                      <ExternalLinkIcon className="h-4 w-4 ml-1" />
                    </a>
                  </div>
                </div>
                
                {/* Expanded Details */}
                {expandedApartment === apartment.id && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      {apartment.deposit && (
                        <div>
                          <span className="font-medium text-gray-700">Deposit:</span>
                          <span className="ml-2">¥{apartment.deposit.toLocaleString()}</span>
                        </div>
                      )}
                      
                      {apartment.keyMoney && (
                        <div>
                          <span className="font-medium text-gray-700">Key Money:</span>
                          <span className="ml-2">¥{apartment.keyMoney.toLocaleString()}</span>
                        </div>
                      )}
                      
                      {apartment.floor && (
                        <div>
                          <span className="font-medium text-gray-700">Floor:</span>
                          <span className="ml-2">{apartment.floor}</span>
                        </div>
                      )}
                      
                      {apartment.yearBuilt && (
                        <div>
                          <span className="font-medium text-gray-700">Year Built:</span>
                          <span className="ml-2">{apartment.yearBuilt}</span>
                        </div>
                      )}
                    </div>
                    
                    {apartment.commuteInfo && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-md">
                        <h4 className="font-medium text-gray-900 mb-2">Commute Details</h4>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Travel Time:</span>
                            <span className="ml-2 font-medium">{apartment.commuteInfo.travelTime}min</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Transfers:</span>
                            <span className="ml-2 font-medium">{apartment.commuteInfo.transfers}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Total Time:</span>
                            <span className="ml-2 font-medium">{apartment.commuteInfo.totalTime}min</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}