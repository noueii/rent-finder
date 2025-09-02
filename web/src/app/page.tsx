'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { StationSearch } from '~/components/StationSearch';
import { useSearchFilters } from '~/hooks/useSearchFilters';

export default function HomePage() {
  const router = useRouter();
  const { filters, updateFilters, hasFilters, updateUrlWithFilters } = useSearchFilters();
  const [targetStation, setTargetStation] = useState<string>();
  const [commuteTime, setCommuteTime] = useState<number>(30);

  // Initialize with saved filters
  useEffect(() => {
    if (filters.targetStation) {
      setTargetStation(filters.targetStation);
    }
    if (filters.maxCommuteTime) {
      setCommuteTime(filters.maxCommuteTime);
    }
  }, [filters.targetStation, filters.maxCommuteTime]);

  const handleSearch = () => {
    if (!targetStation) {
      alert('Please select a target station');
      return;
    }

    // Save the search criteria to persistent filters
    updateFilters({
      targetStation,
      maxCommuteTime: commuteTime,
    });

    // Navigate to browse page with filters
    const params = new URLSearchParams({
      station: targetStation,
      maxTime: commuteTime.toString(),
    });
    router.push(`/browse?${params.toString()}`);
  };

  const handleGoToSavedSearch = () => {
    updateUrlWithFilters(filters);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="pt-20 pb-16 text-center lg:pt-32">
          <h1 className="mx-auto max-w-4xl font-bold text-5xl sm:text-6xl lg:text-7xl text-gray-900 tracking-tight">
            Find Your Perfect Home in{' '}
            <span className="text-blue-600">Tokyo</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg sm:text-xl text-gray-600">
            Search apartments based on commute time to your workplace or school.
            No more endless scrolling through irrelevant listings.
          </p>
        </div>

        {/* Quick Search Section */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Search</h2>
            
            <div className="space-y-6">
              {/* Station Search */}
              <div>
                <StationSearch
                  onStationSelect={(station) => setTargetStation(station.id)}
                  label="Where do you commute to?"
                  placeholder="Search for your work or school station"
                  showScores={false}
                />
              </div>

              {/* Commute Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum commute time
                </label>
                <select
                  value={commuteTime}
                  onChange={(e) => setCommuteTime(Number(e.target.value))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                </select>
              </div>

              {/* Search Buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleSearch}
                  className="w-full py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                >
                  Search Apartments
                </button>
                
                {hasFilters && (
                  <button
                    onClick={handleGoToSavedSearch}
                    className="w-full py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                  >
                    Continue with Saved Filters
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Advanced Search Link */}
          <div className="text-center mt-6">
            <button
              onClick={() => navigateToSearch()}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Advanced Search →
            </button>
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-24 mb-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Why Tokyo Rent Finder?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 text-blue-600 mb-4">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Commute-Based Search
              </h3>
              <p className="text-gray-600">
                Find apartments within your desired commute time from work or school
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto h-12 w-12 text-blue-600 mb-4">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Real Transit Data
              </h3>
              <p className="text-gray-600">
                Accurate commute times using actual Tokyo train and subway routes
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto h-12 w-12 text-blue-600 mb-4">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Comprehensive Filters
              </h3>
              <p className="text-gray-600">
                Filter by price, size, layout, building age, and more
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}