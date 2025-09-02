'use client';

import React, { useState, useMemo } from 'react';
import { api } from '~/utils/api';
import Link from 'next/link';

export default function LinesPage() {
  const [selectedLineId, setSelectedLineId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Get all stations and lines
  const { data: allStations, isLoading: stationsLoading } = api.admin.getAllStations.useQuery();
  const { data: allLines, isLoading: linesLoading } = api.admin.getAllLines.useQuery();
  
  const isLoading = stationsLoading || linesLoading;
  
  // Filter stations by selected line and search term
  const stationsOnLine = useMemo(() => {
    if (!selectedLineId || !allStations) return [];
    
    let filtered = allStations.filter(station => 
      station.lines && station.lines.includes(selectedLineId)
    );
    
    // Apply search filter if search term exists
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(station => 
        station.name.toLowerCase().includes(searchLower) ||
        station.nameJa.toLowerCase().includes(searchLower) ||
        station.id.toLowerCase().includes(searchLower)
      );
    }
    
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedLineId, allStations, searchTerm]);
  
  // Filter lines by search term
  const filteredLines = useMemo(() => {
    if (!allLines) return [];
    
    if (!searchTerm.trim()) return allLines;
    
    const searchLower = searchTerm.toLowerCase();
    return allLines.filter(line => 
      line.name.toLowerCase().includes(searchLower) ||
      line.operator.toLowerCase().includes(searchLower) ||
      line.id.toLowerCase().includes(searchLower)
    );
  }, [allLines, searchTerm]);
  
  // Get selected line info
  const selectedLine = useMemo(() => {
    if (!selectedLineId || !allLines) return null;
    return allLines.find(line => line.id === selectedLineId);
  }, [selectedLineId, allLines]);
  
  // Search all stations when no line is selected
  const searchedStations = useMemo(() => {
    if (!searchTerm.trim() || selectedLineId || !allStations) return [];
    
    const searchLower = searchTerm.toLowerCase();
    return allStations.filter(station => 
      station.name.toLowerCase().includes(searchLower) ||
      station.nameJa.toLowerCase().includes(searchLower) ||
      station.id.toLowerCase().includes(searchLower)
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [searchTerm, selectedLineId, allStations]);
  
  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center py-8">
            <p className="text-gray-600">Loading stations...</p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Browse Stations by Line</h1>
          <div className="flex gap-3">
            {(searchTerm || selectedLineId) && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedLineId('');
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Reset All
              </button>
            )}
            <Link 
              href="/admin" 
              className="px-4 py-2 text-blue-600 hover:text-blue-800 underline"
            >
              Back to Admin
            </Link>
          </div>
        </div>
        
        {/* Search and Line Selection */}
        <div className="mb-6 space-y-4">
          {/* Search Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Lines and Stations
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by line name, operator, station name, or ID..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="px-3 py-2 text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Clear
                </button>
              )}
            </div>
            {searchTerm && (
              <p className="text-sm text-gray-600 mt-1">
                Found {filteredLines.length} line{filteredLines.length !== 1 ? 's' : ''} matching "{searchTerm}"
                {selectedLineId && stationsOnLine.length > 0 && (
                  <span> • {stationsOnLine.length} station{stationsOnLine.length !== 1 ? 's' : ''} on selected line</span>
                )}
                {!selectedLineId && searchedStations.length > 0 && (
                  <span> • {searchedStations.length} station{searchedStations.length !== 1 ? 's' : ''} found</span>
                )}
              </p>
            )}
          </div>
          
          {/* Line Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Train Line
            </label>
            <select
              value={selectedLineId}
              onChange={(e) => setSelectedLineId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Choose a line...</option>
              {filteredLines.map(line => (
                <option key={line.id} value={line.id}>
                  {line.name} ({line.operator})
                </option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Stats */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Total Lines</p>
            <p className="text-2xl font-bold text-gray-900">{allLines?.length || 0}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Total Stations</p>
            <p className="text-2xl font-bold text-gray-900">{allStations?.length || 0}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Stations on Selected Line</p>
            <p className="text-2xl font-bold text-gray-900">{stationsOnLine.length}</p>
          </div>
        </div>
        
        {/* Stations List */}
        {selectedLine && (
          <div>
            <h2 className="text-xl font-semibold mb-4">
              Stations on {selectedLine.name}
            </h2>
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <span className="font-medium">Line:</span> {selectedLine.name} | 
                <span className="font-medium ml-2">Operator:</span> {selectedLine.operator} | 
                <span className="font-medium ml-2">ID:</span> {selectedLine.id}
              </p>
            </div>
            
            {stationsOnLine.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchTerm ? `No stations found matching "${searchTerm}" on this line` : 'No stations found for this line'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stationsOnLine.map(station => (
                  <div
                    key={station.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">
                          {station.name}
                        </h3>
                        {station.nameJa && station.nameJa !== station.name && (
                          <p className="text-sm text-gray-600 mt-1">
                            {station.nameJa}
                          </p>
                        )}
                        
                        {/* All lines for this station */}
                        <div className="mt-2">
                          <p className="text-xs text-gray-500 mb-1">Lines:</p>
                          <div className="flex flex-wrap gap-1">
                            {station.lines.map(lineId => {
                              const lineInfo = allLines?.find(l => l.id === lineId);
                              return (
                                <button
                                  key={lineId}
                                  onClick={() => setSelectedLineId(lineId)}
                                  className={`inline-block px-2 py-1 text-xs rounded-full transition-colors cursor-pointer ${
                                    lineId === selectedLineId
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-gray-100 text-gray-700 hover:bg-blue-50 hover:text-blue-600'
                                  }`}
                                  title={lineInfo ? `${lineInfo.name} (${lineInfo.operator}) - Click to select this line` : lineId}
                                >
                                  {lineInfo ? lineInfo.name : lineId}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right text-xs text-gray-500">
                        ID: {station.id}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Search Results (when no line is selected) */}
        {!selectedLineId && searchTerm && searchedStations.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">
              Station Search Results
            </h2>
            <div className="mb-4 p-3 bg-green-50 rounded-lg">
              <p className="text-sm text-green-800">
                Found {searchedStations.length} station{searchedStations.length !== 1 ? 's' : ''} matching "{searchTerm}"
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {searchedStations.map(station => (
                <div
                  key={station.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-green-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">
                        {station.name}
                      </h3>
                      {station.nameJa && station.nameJa !== station.name && (
                        <p className="text-sm text-gray-600 mt-1">
                          {station.nameJa}
                        </p>
                      )}
                      
                      {/* All lines for this station */}
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 mb-1">Lines:</p>
                        <div className="flex flex-wrap gap-1">
                          {station.lines.map(lineId => {
                            const lineInfo = allLines?.find(l => l.id === lineId);
                            return (
                              <button
                                key={lineId}
                                onClick={() => setSelectedLineId(lineId)}
                                className="inline-block px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-800 transition-colors cursor-pointer"
                                title={lineInfo ? `${lineInfo.name} (${lineInfo.operator}) - Click to select this line` : lineId}
                              >
                                {lineInfo ? lineInfo.name : lineId}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right text-xs text-gray-500">
                      ID: {station.id}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty search results */}
        {!selectedLineId && searchTerm && searchedStations.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No stations found matching "{searchTerm}"
          </div>
        )}
      </div>
    </div>
  );
}