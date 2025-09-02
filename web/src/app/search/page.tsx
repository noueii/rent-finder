'use client';

import { useState } from 'react';
import { SearchFilters } from '~/components/SearchFilters';
import { SearchResults } from '~/components/SearchResults';
import { api } from '~/utils/api';
import { LoadingSpinner } from '~/components/LoadingSpinner';
import { ErrorMessage } from '~/components/ErrorMessage';

export interface SearchFilterValues {
  // Basic filters
  maxRent?: number;
  minRent?: number;
  minSize?: number;
  maxSize?: number;
  layouts?: string[];
  
  // Commute filter
  targetStation?: string;
  maxCommuteTime?: number;
  
  // Location filters
  wards?: string[];
  
  // Building filters
  maxBuildingAge?: number;
  minBuildingAge?: number;
  
  // List filters - which lists to include/exclude
  includeFromLists?: ('saved' | 'liked' | 'favorites' | 'hidden')[];
  excludeFromLists?: ('saved' | 'liked' | 'favorites' | 'hidden')[];
  
  // Sorting
  sortBy?: 'price_asc' | 'price_desc' | 'size_asc' | 'size_desc' | 'newest' | 'commute_asc';
}

export default function SearchPage() {
  const [filters, setFilters] = useState<SearchFilterValues>({
    sortBy: 'price_asc',
    excludeFromLists: ['hidden'], // By default, exclude hidden apartments
  });
  
  const [appliedFilters, setAppliedFilters] = useState<SearchFilterValues>({
    sortBy: 'price_asc',
    excludeFromLists: ['hidden'],
  });
  
  const [page, setPage] = useState(1);
  const limit = 20;
  
  // Search apartments with applied filters
  const { data: searchResult, isLoading, error, refetch } = api.search.searchApartments.useQuery({
    filters: {
      ...appliedFilters,
      // Ensure commute filter params are passed correctly
      targetStation: appliedFilters.targetStation,
      maxCommuteTime: appliedFilters.maxCommuteTime,
    },
    pagination: {
      page,
      limit,
    },
    sorting: {
      sortBy: appliedFilters.sortBy || 'price_asc',
    },
  });
  
  const handleApplyFilters = () => {
    setAppliedFilters(filters);
    setPage(1); // Reset to first page when applying new filters
  };
  
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Search Apartments</h1>
          <p className="mt-2 text-gray-600">
            Find your perfect apartment with advanced filtering options
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-4">
              <SearchFilters
                filters={filters}
                onFiltersChange={setFilters}
                onApplyFilters={handleApplyFilters}
                isLoading={isLoading}
              />
            </div>
          </div>
          
          {/* Results */}
          <div className="lg:col-span-3">
            {isLoading && page === 1 ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner />
              </div>
            ) : error ? (
              <ErrorMessage
                message="Failed to load apartments. Please try again."
                onRetry={() => refetch()}
              />
            ) : (
              <SearchResults
                apartments={searchResult?.apartments || []}
                totalCount={searchResult?.pagination.total || 0}
                currentPage={page}
                pageSize={limit}
                onPageChange={handlePageChange}
                isLoading={isLoading}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}