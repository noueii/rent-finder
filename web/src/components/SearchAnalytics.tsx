'use client';

import { api } from '~/utils/api';
import { ChartBarIcon, ArrowTrendingUpIcon as TrendingUpIcon, ClockIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { LoadingSpinner } from './LoadingSpinner';

export function SearchAnalytics() {
  const { data: popularStations, isLoading } = api.station.getPopular.useQuery({ limit: 10 });

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-6">
        <ChartBarIcon className="h-6 w-6 text-primary-600" />
        <h2 className="text-xl font-semibold text-gray-900">Search Analytics</h2>
      </div>

      {/* Popular Stations */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
          <TrendingUpIcon className="h-4 w-4" />
          Popular Stations
        </h3>
        <div className="space-y-2">
          {popularStations?.map((station, index) => (
            <div key={station.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </div>
                <div>
                  <div className="font-medium text-gray-900">{station.name}</div>
                  <div className="text-sm text-gray-500">{station.nameJa}</div>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                {station.searchCount} searches
              </div>
            </div>
          )) || (
            <div className="text-center py-4 text-gray-500">
              No search data available yet
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">--</div>
          <div className="text-sm text-gray-600">Total Searches</div>
        </div>
        <div className="text-center p-4 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">--</div>
          <div className="text-sm text-gray-600">Avg Results</div>
        </div>
        <div className="text-center p-4 bg-purple-50 rounded-lg">
          <div className="text-2xl font-bold text-purple-600">--</div>
          <div className="text-sm text-gray-600">Avg Commute</div>
        </div>
      </div>
    </div>
  );
}