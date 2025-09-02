'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '~/utils/api';
import { useNavigationWithPreferences } from '~/hooks/useNavigationWithPreferences';

interface ApartmentListPageProps {
  listType: 'saved' | 'favorites' | 'liked' | 'hidden';
  title: string;
  emptyIcon: React.ReactNode;
  emptyMessage: string;
}

export function ApartmentListPage({ listType, title, emptyIcon, emptyMessage }: ApartmentListPageProps) {
  const { getUrlWithPreferences } = useNavigationWithPreferences();
  const [page, setPage] = useState(1);
  const limit = 20;
  const utils = api.useUtils();

  // Get apartments in the list
  const { data: listData, isLoading } = api.apartmentList.getApartments.useQuery(
    {
      listType,
      limit,
      offset: (page - 1) * limit,
    }
  );

  const apartments = listData?.apartments || [];
  const pagination = listData?.pagination;
  const totalPages = pagination ? Math.ceil(pagination.total / limit) : 0;

  // Toggle mutations with optimistic updates
  const toggleMutation = api.apartmentList.toggleApartmentInList.useMutation({
    onMutate: async ({ apartmentId }) => {
      // Cancel outgoing refetches
      await utils.apartmentList.getApartments.cancel();
      
      // Snapshot previous value
      const previousData = utils.apartmentList.getApartments.getData({
        listType,
        limit,
        offset: (page - 1) * limit,
      });
      
      // Optimistically remove from list
      if (previousData) {
        const newApartments = previousData.apartments.filter(apt => apt.id !== apartmentId);
        const newData = {
          ...previousData,
          apartments: newApartments,
          pagination: {
            ...previousData.pagination,
            total: previousData.pagination.total - 1,
          },
        };
        utils.apartmentList.getApartments.setData({
          listType,
          limit,
          offset: (page - 1) * limit,
        }, newData);
      }
      
      return { previousData };
    },
    onError: (err, variables, context) => {
      // Revert optimistic update on error
      if (context?.previousData) {
        utils.apartmentList.getApartments.setData({
          listType,
          limit,
          offset: (page - 1) * limit,
        }, context.previousData);
      }
    },
    onSettled: () => {
      // Invalidate to ensure we have the latest data
      utils.apartmentList.getApartments.invalidate();
      utils.apartmentList.getApartmentListStatus.invalidate();
    },
  });

  const handleRemove = (apartmentId: string) => {
    toggleMutation.mutate({
      apartmentId,
      listType,
    });
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
        <p className="mt-2 text-gray-600">
          {pagination?.total || 0} apartments in this list
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <svg className="animate-spin h-8 w-8 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      ) : apartments.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto h-12 w-12 text-gray-400">
            {emptyIcon}
          </div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No apartments {listType}</h3>
          <p className="mt-1 text-sm text-gray-500">{emptyMessage}</p>
          <div className="mt-6">
            <Link
              href={getUrlWithPreferences('search')}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Search for apartments
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {apartments.map((apartment) => {
              const primaryStation = apartment.stations?.find(s => s.isPrimary);
              
              return (
                <div key={apartment.id} className="relative">
                  <Link 
                    href={`/apartment/${apartment.id}`}
                    className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-all block"
                  >
                    <div className="flex h-40">
                      {/* Image Section */}
                      <div className="w-48 bg-gray-200 flex-shrink-0 flex items-center justify-center">
                        <svg className="h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      
                      {/* Content Section */}
                      <div className="flex-1 p-4 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-semibold text-gray-900 text-base line-clamp-1 flex-1">{apartment.title}</h4>
                            <p className="text-xl font-bold text-gray-900 ml-4">
                              ¥{apartment.rentMonthly.toLocaleString()}
                              <span className="text-xs font-normal text-gray-500">/month</span>
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                            <div className="flex items-center gap-1">
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                              </svg>
                              <span>{apartment.size}m² • {apartment.layout}</span>
                            </div>
                            
                            {primaryStation && (
                              <>
                                <div className="flex items-center gap-1">
                                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span>{primaryStation.station?.name || primaryStation.originalStationName}</span>
                                </div>
                                
                                <div className="flex items-center gap-1">
                                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                  <span>{primaryStation.walkingMinutes} min walk</span>
                                </div>
                              </>
                            )}
                            
                            {apartment.buildingAge !== undefined && apartment.buildingAge !== null && (
                              <div className="flex items-center gap-1">
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                <span>{apartment.buildingAge} years old</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-500 truncate flex-1">{apartment.address}</p>
                          {apartment.addedAt && (
                            <p className="text-xs text-gray-400 ml-4">
                              Added {new Date(apartment.addedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                  
                  {/* Remove button */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleRemove(apartment.id);
                    }}
                    className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-sm hover:shadow-md transition-shadow"
                    title={`Remove from ${listType}`}
                  >
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex justify-center">
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Previous</span>
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>

                <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                  Page {page} of {totalPages}
                </span>

                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Next</span>
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </nav>
            </div>
          )}
        </>
      )}
    </div>
  );
}