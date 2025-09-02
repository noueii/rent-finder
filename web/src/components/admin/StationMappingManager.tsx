'use client';

import React, { useState, useEffect } from 'react';
import { api } from '~/utils/api';

interface UnmatchedStation {
  originalName: string;
  normalizedName: string;
  line: string;
  apartmentId: string;
  apartmentUrl: string;
}

interface StationSuggestion {
  id: string;
  name: string;
  nameJa: string;
  lines: string[];
}

export function StationMappingManager() {
  const [unmatchedStations, setUnmatchedStations] = useState<UnmatchedStation[]>([]);
  const [selectedStation, setSelectedStation] = useState<UnmatchedStation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<StationSuggestion[]>([]);

  // Get all stations for suggestions
  const { data: allStations } = api.station.getAll.useQuery();
  
  // Get saved mappings
  const { data: savedMappings, refetch: refetchMappings } = api.admin.getStationMappings.useQuery();
  
  // Save mapping mutation
  const saveMappingMutation = api.admin.saveStationMapping.useMutation({
    onSuccess: () => {
      refetchMappings();
      setSelectedStation(null);
      setSearchQuery('');
      // Remove mapped station from unmatched list
      if (selectedStation) {
        setUnmatchedStations(prev => 
          prev.filter(s => s.originalName !== selectedStation.originalName)
        );
      }
    },
  });

  // Get unmatched stations from last import
  const { data: lastImport } = api.admin.getImportHistory.useQuery();
  
  useEffect(() => {
    if (lastImport && lastImport[0]?.metadata?.stationMatching?.unmatchedDetails) {
      setUnmatchedStations(lastImport[0].metadata.stationMatching.unmatchedDetails);
    }
  }, [lastImport]);

  // Filter stations based on search query
  useEffect(() => {
    if (!allStations || !searchQuery) {
      setSuggestions([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = allStations
      .filter(station => 
        station.name.toLowerCase().includes(query) ||
        station.nameJa.includes(query)
      )
      .slice(0, 10)
      .map(station => ({
        id: station.id,
        name: station.name,
        nameJa: station.nameJa,
        lines: station.lines || [],
      }));

    setSuggestions(filtered);
  }, [searchQuery, allStations]);

  const handleMapping = (stationId: string) => {
    if (!selectedStation) return;

    saveMappingMutation.mutate({
      originalName: selectedStation.originalName,
      originalLine: selectedStation.line,
      stationId: stationId,
      notes: `Mapped from ${selectedStation.originalName} to station ${stationId}`,
    });
  };

  // Group unmatched stations by normalized name
  const groupedUnmatched = unmatchedStations.reduce((acc, station) => {
    if (!acc[station.normalizedName]) {
      acc[station.normalizedName] = [];
    }
    acc[station.normalizedName].push(station);
    return acc;
  }, {} as Record<string, UnmatchedStation[]>);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-4">Station Mapping Manager</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Unmatched Stations List */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Unmatched Stations</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {Object.entries(groupedUnmatched).map(([normalized, stations]) => (
              <div
                key={normalized}
                className={`p-3 border rounded cursor-pointer transition-colors ${
                  selectedStation?.normalizedName === normalized
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
                onClick={() => setSelectedStation(stations[0])}
              >
                <div className="font-medium">{stations[0].originalName}</div>
                <div className="text-sm text-gray-600">
                  Line: {stations[0].line || 'Unknown'}
                </div>
                <div className="text-xs text-gray-500">
                  Appears in {stations.length} apartment{stations.length > 1 ? 's' : ''}
                </div>
              </div>
            ))}
            {Object.keys(groupedUnmatched).length === 0 && (
              <p className="text-gray-500">No unmatched stations found</p>
            )}
          </div>
        </div>

        {/* Mapping Interface */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Map to Station</h3>
          
          {selectedStation ? (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded">
                <div className="font-medium">Selected: {selectedStation.originalName}</div>
                <div className="text-sm text-gray-600">Line: {selectedStation.line}</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search for correct station
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type station name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {suggestions.length > 0 && (
                <div className="border rounded-lg divide-y">
                  {suggestions.map(station => (
                    <div
                      key={station.id}
                      className="p-3 hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleMapping(station.id)}
                    >
                      <div className="font-medium">
                        {station.name} ({station.nameJa})
                      </div>
                      {station.lines.length > 0 && (
                        <div className="text-sm text-gray-600">
                          Lines: {station.lines.slice(0, 3).join(', ')}
                          {station.lines.length > 3 && '...'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500">Select an unmatched station to map</p>
          )}
        </div>
      </div>

      {/* Saved Mappings */}
      {savedMappings && savedMappings.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-3">Saved Mappings</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Original Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Original Line
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mapped To
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {savedMappings.map((mapping) => (
                  <tr key={mapping.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {mapping.originalName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {mapping.originalLine || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {mapping.mappedStationId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(mapping.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}