'use client';

import { useState, useEffect } from 'react';
import { api } from '~/utils/api';

interface MetricCard {
  title: string;
  value: string;
  unit?: string;
  color: 'green' | 'yellow' | 'red';
  description?: string;
}

export function PerformanceDashboard() {
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data: metrics, refetch: refetchMetrics } = api.performance.getMetrics.useQuery(
    undefined,
    {
      refetchInterval: autoRefresh ? refreshInterval : false,
    }
  );

  const { data: health, refetch: refetchHealth } = api.performance.healthCheck.useQuery(
    undefined,
    {
      refetchInterval: autoRefresh ? refreshInterval : false,
    }
  );

  const { data: slowQueries } = api.performance.getSlowQueries.useQuery(
    { threshold: 100 },
    {
      refetchInterval: autoRefresh ? refreshInterval * 2 : false,
    }
  );

  const { data: searchAnalytics } = api.performance.getSearchAnalytics.useQuery(
    { days: 7 },
    {
      refetchInterval: autoRefresh ? refreshInterval * 3 : false,
    }
  );

  const { data: dbStats } = api.performance.getDatabaseStats.useQuery(
    undefined,
    {
      refetchInterval: autoRefresh ? refreshInterval * 2 : false,
    }
  );

  const clearMetrics = api.performance.clearMetrics.useMutation({
    onSuccess: () => {
      refetchMetrics();
    },
  });

  const clearCache = api.performance.clearCache.useMutation();

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'green';
      case 'degraded':
        return 'yellow';
      case 'unhealthy':
        return 'red';
      default:
        return 'gray';
    }
  };

  const getPerformanceColor = (value: number, thresholds: [number, number]): 'green' | 'yellow' | 'red' => {
    if (value <= thresholds[0]) return 'green';
    if (value <= thresholds[1]) return 'yellow';
    return 'red';
  };

  const metricCards: MetricCard[] = [
    {
      title: 'System Health',
      value: health?.status || 'Unknown',
      color: getStatusColor(health?.status || 'unknown'),
      description: health?.timestamp ? `Last checked: ${new Date(health.timestamp).toLocaleTimeString()}` : undefined,
    },
    {
      title: 'Cache Hit Rate',
      value: `${metrics?.cacheStats?.hitRate?.toFixed(1) || 0}`,
      unit: '%',
      color: getPerformanceColor(metrics?.cacheStats?.hitRate || 0, [90, 70]),
      description: `${metrics?.cacheStats?.hits || 0} hits, ${metrics?.cacheStats?.misses || 0} misses`,
    },
    {
      title: 'Memory Usage',
      value: metrics?.memoryUsage?.heapUsed || 'Unknown',
      color: 'green', // Would need actual memory limit to calculate
      description: `RSS: ${metrics?.memoryUsage?.rss || 'Unknown'}`,
    },
    {
      title: 'Database',
      value: `${dbStats?.counts?.apartments || 0}`,
      unit: 'apartments',
      color: 'green',
      description: `${dbStats?.counts?.stations || 0} stations, ${dbStats?.counts?.searches || 0} searches`,
    },
  ];

  if (!metrics && !health) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Performance Dashboard</h1>
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-600">Auto-refresh</span>
          </label>
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="text-sm border-gray-300 rounded-md"
          >
            <option value={1000}>1s</option>
            <option value={5000}>5s</option>
            <option value={10000}>10s</option>
            <option value={30000}>30s</option>
          </select>
          <button
            onClick={() => {
              refetchMetrics();
              refetchHealth();
            }}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((card, index) => (
          <div key={index} className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{card.title}</p>
                <p className="text-2xl font-bold text-gray-900">
                  {card.value}
                  {card.unit && <span className="text-sm text-gray-500 ml-1">{card.unit}</span>}
                </p>
                {card.description && (
                  <p className="text-xs text-gray-500 mt-1">{card.description}</p>
                )}
              </div>
              <div className={`w-3 h-3 rounded-full ${
                card.color === 'green' ? 'bg-green-500' :
                card.color === 'yellow' ? 'bg-yellow-500' :
                card.color === 'red' ? 'bg-red-500' : 'bg-gray-500'
              }`}></div>
            </div>
          </div>
        ))}
      </div>

      {/* API Performance */}
      {metrics?.apiMetrics && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">API Performance</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Endpoint
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Min Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Max Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Count
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.entries(metrics.apiMetrics).map(([endpoint, data]) => (
                  <tr key={endpoint}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {endpoint}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDuration(data?.avg || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDuration(data?.min || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDuration(data?.max || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {data?.count || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Slow Queries */}
      {slowQueries && slowQueries.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Slow Queries (>100ms)</h2>
          <div className="space-y-3">
            {slowQueries.map((query, index) => (
              <div key={index} className="flex justify-between items-center p-3 bg-red-50 rounded">
                <span className="text-sm font-medium text-red-800">{query.query}</span>
                <div className="text-sm text-red-600">
                  {formatDuration(query.avgDuration)} avg ({query.count} calls)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search Analytics */}
      {searchAnalytics && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Search Analytics (7 days)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {formatNumber(searchAnalytics.totalSearches)}
              </div>
              <div className="text-sm text-gray-500">Total Searches</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatDuration(searchAnalytics.avgSearchDuration)}
              </div>
              <div className="text-sm text-gray-500">Avg Search Time</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {searchAnalytics.popularStations?.[0]?.station || 'N/A'}
              </div>
              <div className="text-sm text-gray-500">Top Station</div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-4">Actions</h2>
        <div className="flex space-x-4">
          <button
            onClick={() => clearMetrics.mutate()}
            disabled={clearMetrics.isLoading}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
          >
            {clearMetrics.isLoading ? 'Clearing...' : 'Clear Metrics'}
          </button>
          <button
            onClick={() => clearCache.mutate()}
            disabled={clearCache.isLoading}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
          >
            {clearCache.isLoading ? 'Clearing...' : 'Clear Cache'}
          </button>
        </div>
      </div>
    </div>
  );
}