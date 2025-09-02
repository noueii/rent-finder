'use client';

import React, { useState, useEffect } from 'react';
import { api } from '~/utils/api';
import { StationSearch } from '~/components/StationSearch';
import Link from 'next/link';

export default function MapStationsPage() {
  const [selectedStationId, setSelectedStationId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [currentStationId, setCurrentStationId] = useState<string | undefined>();
  const [autoMapResults, setAutoMapResults] = useState<any>(null);
  const [showResults, setShowResults] = useState(false);

  const utils = api.useUtils();

  // Get next unmapped station
  const { data: unmappedStation, refetch: refetchUnmapped } = api.admin.getNextUnmappedStation.useQuery({
    skipId: currentStationId,
  });
  
  // Note: Station search is now handled by the StationSearch component
  
  // Update mapping mutation
  const updateMapping = api.admin.updateStationMapping.useMutation({
    onSuccess: (data) => {
      setSuccessMessage('Station mapped successfully!');
      setSelectedStationId('');
      setNotes('');
      setShowResults(false);
      setAutoMapResults(null);
      
      // Invalidate all admin queries to ensure fresh data
      utils.admin.invalidate();
      
      // Automatically advance to next station
      setTimeout(() => {
        if (unmappedStation) {
          setCurrentStationId(unmappedStation.id); // Skip the current station
        }
        setSuccessMessage('');
        refetchUnmapped(); // Refetch to get the next station
      }, 1000); // Show success briefly then move on
    },
  });

  // Auto-map mutation
  const autoMap = api.admin.autoMapStations.useMutation({
    onSuccess: (data) => {
      setAutoMapResults(data);
      setShowResults(true);
      
      // Show immediate feedback
      console.log(`Auto-mapped ${data.mapped} stations, updated ${data.results.reduce((sum, r) => sum + (r.apartmentsUpdated || 0), 0)} apartment relationships`);
      
      // More aggressive cache invalidation
      utils.invalidate(); // Invalidate ALL queries, not just admin
      
      // Multiple refetch attempts with delays to handle database lag
      setTimeout(() => {
        refetchUnmapped();
        utils.admin.getNextUnmappedStation.invalidate();
      }, 500);
      
      setTimeout(() => {
        refetchUnmapped();
      }, 2000);
      
      setTimeout(() => {
        refetchUnmapped();
      }, 5000);
    },
    onError: (error) => {
      alert(`Error auto-mapping stations: ${error.message}`);
    },
  });

  const handleSaveMapping = () => {
    if (!unmappedStation || !selectedStationId) return;
    
    updateMapping.mutate({
      id: unmappedStation.id,
      stationId: selectedStationId,
      notes: notes,
    });
  };

  const handleSkip = () => {
    // Just refetch to get the next one
    refetchUnmapped();
    setSelectedStationId('');
    setNotes('');
  };

  const handleNext = () => {
    // Move to next without saving - skip the current one
    if (unmappedStation) {
      setCurrentStationId(unmappedStation.id);
    }
    setSelectedStationId('');
    setNotes('');
    setShowResults(false);
    setAutoMapResults(null);
  };

  const handleAutoMap = () => {
    autoMap.mutate({ minScore: 80 }); // Auto-map good matches (including fuzzy)
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      handleSaveMapping();
    }
  };

  if (!unmappedStation) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Station Mapping</h1>
            <div className="text-right">
              <div className="text-sm text-gray-600">Apartments remaining</div>
              <div className="text-2xl font-bold text-green-600">0</div>
              <div className="text-xs text-gray-500">0 stations left</div>
            </div>
          </div>
          <div className="text-center py-8">
            <p className="text-lg text-green-600 mb-4">
              🎉 All stations have been mapped!
            </p>
            <p className="text-sm text-gray-600 mb-4">
              All apartments now have their station mappings resolved.
            </p>
            <Link 
              href="/admin" 
              className="text-blue-600 hover:text-blue-800 underline"
            >
              Back to Admin
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6" onKeyDown={handleKeyDown} tabIndex={-1}>
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Map Station Names</h1>
          {unmappedStation && (
            <div className="text-right">
              <div className="text-sm text-gray-600">Apartments remaining</div>
              <div className="text-2xl font-bold text-orange-600">
                {unmappedStation.totalApartmentsRemaining?.toLocaleString() || 0}
              </div>
              <div className="text-xs text-gray-500">
                {unmappedStation.totalUnmappedStations} station{unmappedStation.totalUnmappedStations !== 1 ? 's' : ''} left
              </div>
              <button
                onClick={() => refetchUnmapped()}
                className="mt-1 text-xs text-blue-600 hover:text-blue-800 underline"
                title="Refresh numbers"
              >
                🔄 Refresh
              </button>
            </div>
          )}
        </div>
        
        {/* Success message */}
        {successMessage && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded">
            {successMessage}
          </div>
        )}
        
        {/* Current unmapped station */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Unmapped Station</h2>
          <div className="space-y-2">
            <div>
              <span className="font-medium">Name:</span> {unmappedStation.aliasName}
            </div>
            {unmappedStation.aliasLine && (
              <div>
                <span className="font-medium">Line:</span> {unmappedStation.aliasLine}
              </div>
            )}
            <div className="text-sm text-gray-600">
              Affects {unmappedStation.affectedApartments} apartment{unmappedStation.affectedApartments !== 1 ? 's' : ''}
            </div>
            {unmappedStation.affectedApartments > 10 && (
              <div className="text-sm text-orange-600 font-medium">
                ⚡ High priority station - affects many apartments
              </div>
            )}
            
            {/* Sample affected apartments */}
            {unmappedStation.sampleApartmentIds && unmappedStation.sampleApartmentIds.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-2">Sample affected apartments:</p>
                <div className="space-y-1">
                  {unmappedStation.sampleApartmentIds.map((id) => (
                    <Link
                      key={id}
                      href={`/admin/apartment/${id}`}
                      target="_blank"
                      className="text-sm text-blue-600 hover:text-blue-800 underline block"
                    >
                      View apartment →
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Auto-map button */}
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-medium text-blue-800">Bulk Auto-Mapping</h3>
              <p className="text-xs text-blue-600">Automatically map all stations with exact matches</p>
            </div>
            <button
              onClick={handleAutoMap}
              disabled={autoMap.isLoading}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                autoMap.isLoading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {autoMap.isLoading ? '🔄 Mapping...' : '🤖 Auto-Map All'}
            </button>
          </div>
        </div>

        {/* Refresh notice */}
        {autoMapResults && autoMapResults.mapped > 0 && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="text-sm text-yellow-800">
              <strong>Auto-mapping completed!</strong> The numbers will update automatically in a few moments as the database processes the changes. 
              {autoMap.isLoading && (
                <span className="ml-2 text-blue-600">🔄 Processing...</span>
              )}
            </div>
          </div>
        )}

        {/* Auto-map results */}
        {showResults && autoMapResults && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-green-800">
                Auto-Mapping Results
              </h3>
              <button
                onClick={() => setShowResults(false)}
                className="text-sm text-green-600 hover:text-green-800"
              >
                Hide
              </button>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{autoMapResults.mapped}</div>
                <div className="text-xs text-green-700">Mapped</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{autoMapResults.skipped}</div>
                <div className="text-xs text-yellow-700">Skipped</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">{autoMapResults.processed}</div>
                <div className="text-xs text-gray-700">Total</div>
              </div>
            </div>
            
            {autoMapResults.results.length > 0 && (
              <div className="max-h-64 overflow-y-auto">
                <div className="space-y-2">
                  {autoMapResults.results.slice(0, 20).map((result: any, index: number) => (
                    <div
                      key={index}
                      className={`p-2 rounded text-sm ${
                        result.status === 'mapped'
                          ? 'bg-green-100 text-green-800'
                          : result.status === 'skipped'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      <div className="font-medium">{result.aliasName}</div>
                      {result.status === 'mapped' && (
                        <div className="text-xs">
                          → {result.mappedTo} ({result.matchType}, score: {result.score})
                          {result.apartmentsUpdated > 0 && (
                            <span className="ml-2 text-green-600">
                              • {result.apartmentsUpdated} apartments linked
                            </span>
                          )}
                        </div>
                      )}
                      {result.status === 'skipped' && (
                        <div className="text-xs">{result.reason}</div>
                      )}
                      {result.status === 'error' && (
                        <div className="text-xs">Error: {result.error}</div>
                      )}
                    </div>
                  ))}
                  {autoMapResults.results.length > 20 && (
                    <div className="text-xs text-gray-500 text-center p-2">
                      ... and {autoMapResults.results.length - 20} more
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Station search dropdown */}
        <div className="mb-4">
          <StationSearch
            onStationSelect={(station) => setSelectedStationId(station.id)}
            label="Map to Station"
            placeholder="Search for the correct station..."
            showScores={true}
          />
        </div>

        {/* Notes field */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes (optional)
          </label>
          <textarea
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes about this mapping..."
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-4">
          <button
            onClick={handleSaveMapping}
            disabled={!selectedStationId || updateMapping.isLoading}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              !selectedStationId || updateMapping.isLoading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {updateMapping.isLoading ? 'Saving...' : 'Save Mapping'}
            <span className="ml-2 text-xs opacity-75">(Ctrl+Enter)</span>
          </button>
          
          <button
            onClick={handleNext}
            className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
          >
            Next Station →
          </button>
          
          <button
            onClick={handleSkip}
            className="px-6 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Skip for Now
          </button>
          
          <Link
            href="/admin"
            className="px-6 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Back to Admin
          </Link>
        </div>

        {/* Progress info */}
        <div className="mt-6 text-sm text-gray-600">
          <p>Tip: Search by station name, Japanese name, or line name. The search is case-insensitive.</p>
          <p className="mt-2">Keyboard shortcuts: <span className="font-mono bg-gray-100 px-2 py-1 rounded">Ctrl+Enter</span> to save mapping</p>
        </div>
      </div>
    </div>
  );
}