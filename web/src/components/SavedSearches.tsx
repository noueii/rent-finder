'use client';

import { useState } from 'react';
import { useSavedSearches, SavedSearch } from '~/hooks/useSavedSearches';
import { cn } from '~/utils/cn';
import { 
  BookmarkIcon, 
  MagnifyingGlassIcon, 
  TrashIcon, 
  PencilIcon,
  ClockIcon,
  StarIcon,
  PlusIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkIconSolid } from '@heroicons/react/24/solid';

interface SavedSearchesProps {
  onSearchSelect?: (search: SavedSearch) => void;
  onSaveCurrentSearch?: (name: string) => void;
  currentSearch?: {
    targetStation: string;
    targetStationName: string;
    maxCommuteTime: number;
    filters: any;
  };
  className?: string;
}

export function SavedSearches({ 
  onSearchSelect, 
  onSaveCurrentSearch, 
  currentSearch, 
  className 
}: SavedSearchesProps) {
  const {
    savedSearches,
    isLoading,
    removeSearch,
    updateSearch,
    markAsSearched,
    isSearchSaved,
    getRecentSearches,
  } = useSavedSearches();

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleSaveSearch = () => {
    if (!saveName.trim() || !currentSearch || !onSaveCurrentSearch) return;
    
    onSaveCurrentSearch(saveName.trim());
    setSaveName('');
    setShowSaveDialog(false);
  };

  const handleSearchClick = (search: SavedSearch) => {
    markAsSearched(search.id);
    onSearchSelect?.(search);
  };

  const handleEditStart = (search: SavedSearch) => {
    setEditingId(search.id);
    setEditName(search.name);
  };

  const handleEditSave = (id: string) => {
    if (editName.trim()) {
      updateSearch(id, { name: editName.trim() });
    }
    setEditingId(null);
    setEditName('');
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditName('');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatFilters = (filters: SavedSearch['filters']) => {
    const parts: string[] = [];
    
    if (filters.priceRange) {
      parts.push(`¥${filters.priceRange[0].toLocaleString()}-${filters.priceRange[1].toLocaleString()}`);
    }
    
    if (filters.sizeRange) {
      parts.push(`${filters.sizeRange[0]}-${filters.sizeRange[1]}㎡`);
    }
    
    if (filters.layouts?.length) {
      parts.push(filters.layouts.join(', '));
    }
    
    if (filters.features?.length) {
      parts.push(`${filters.features.length} feature${filters.features.length > 1 ? 's' : ''}`);
    }
    
    return parts.length > 0 ? parts.join(' • ') : 'No filters';
  };

  const canSaveCurrentSearch = currentSearch && 
    !isSearchSaved(currentSearch.targetStation, currentSearch.maxCommuteTime, currentSearch.filters);

  const recentSearches = getRecentSearches(3);

  if (isLoading) {
    return (
      <div className={cn("bg-white rounded-lg shadow-sm border border-gray-200 p-6", className)}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-2">
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-white rounded-lg shadow-sm border border-gray-200 p-6", className)}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <BookmarkIconSolid className="h-5 w-5 text-primary-500" />
          Saved Searches
        </h2>
        
        {canSaveCurrentSearch && (
          <button
            onClick={() => setShowSaveDialog(true)}
            className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            Save Current
          </button>
        )}
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-900">Save Current Search</h3>
            <button
              onClick={() => setShowSaveDialog(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Enter search name..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
              onKeyPress={(e) => e.key === 'Enter' && handleSaveSearch()}
            />
            <button
              onClick={handleSaveSearch}
              disabled={!saveName.trim()}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
            <ClockIcon className="h-4 w-4" />
            Recent Searches
          </h3>
          <div className="space-y-2">
            {recentSearches.map((search) => (
              <div
                key={search.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                onClick={() => handleSearchClick(search)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 truncate">{search.name}</span>
                    <span className="text-xs text-gray-500">
                      {formatDate(search.lastSearched!)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {search.targetStationName} • {search.maxCommuteTime} min
                  </div>
                </div>
                <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Saved Searches */}
      {savedSearches.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700 mb-2">All Saved Searches</h3>
          {savedSearches.map((search) => (
            <div
              key={search.id}
              className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  {editingId === search.id ? (
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                        onKeyPress={(e) => e.key === 'Enter' && handleEditSave(search.id)}
                      />
                      <button
                        onClick={() => handleEditSave(search.id)}
                        className="text-green-600 hover:text-green-700"
                      >
                        ✓
                      </button>
                      <button
                        onClick={handleEditCancel}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium text-gray-900 truncate">{search.name}</h4>
                      <button
                        onClick={() => handleEditStart(search)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <PencilIcon className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  
                  <div className="text-sm text-gray-600 mb-2">
                    <div className="flex items-center gap-4 mb-1">
                      <span className="font-medium">{search.targetStationName}</span>
                      <span>Max: {search.maxCommuteTime} min</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatFilters(search.filters)}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      Created: {formatDate(search.createdAt)}
                      {search.lastSearched && (
                        <span className="ml-2">
                          Last used: {formatDate(search.lastSearched)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSearchClick(search)}
                        className="flex items-center gap-1 px-3 py-1 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors text-xs"
                      >
                        <MagnifyingGlassIcon className="h-3 w-3" />
                        Search
                      </button>
                      <button
                        onClick={() => removeSearch(search.id)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <BookmarkIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No saved searches yet</p>
          <p className="text-xs">Save your searches to quickly access them later</p>
        </div>
      )}
    </div>
  );
}