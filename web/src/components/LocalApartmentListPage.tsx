'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocalUserLists, ApartmentListItem } from '~/hooks/useLocalUserLists';
import { useNavigationWithPreferences } from '~/hooks/useNavigationWithPreferences';

interface LocalApartmentListPageProps {
  listType: 'saved' | 'favorites' | 'liked' | 'hidden';
  title: string;
  emptyIcon: React.ReactNode;
  emptyMessage: string;
}

export function LocalApartmentListPage({ listType, title, emptyIcon, emptyMessage }: LocalApartmentListPageProps) {
  const { lists, removeFromList, isLoading } = useLocalUserLists();
  const { getUrlWithPreferences } = useNavigationWithPreferences();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const apartments = lists[listType] || [];
  const totalPages = Math.ceil(apartments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentApartments = apartments.slice(startIndex, endIndex);

  const handleRemove = (apartmentId: string) => {
    removeFromList(listType, apartmentId);
    
    // If we're on the last page and it becomes empty, go to previous page
    if (currentApartments.length === 1 && currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 mx-auto border-b-2 border-blue-600"></div>
        <p className="mt-2 text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
        <p className="mt-2 text-gray-600">
          {apartments.length} apartment{apartments.length !== 1 ? 's' : ''} in this list
        </p>
      </div>

      {apartments.length === 0 ? (
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
            {currentApartments.map((apartment) => (
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
                          
                          {apartment.stationName && (
                            <div className="flex items-center gap-1">
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span>{apartment.stationName}</span>
                            </div>
                          )}
                          
                          {apartment.walkingMinutes && (
                            <div className="flex items-center gap-1">
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span>{apartment.walkingMinutes} min walk</span>
                            </div>
                          )}
                          
                          {apartment.buildingAge && (
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
                        <p className="text-xs text-gray-400 ml-4">
                          Added {new Date(apartment.addedAt).toLocaleDateString()}
                        </p>
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
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex justify-center">
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Previous</span>
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>

                <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
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