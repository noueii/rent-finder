
"use client";

import { type FC, useState, useRef, useEffect } from 'react';
import { api } from '~/utils/api';


interface StationSearchProps {
  onSelect: (stationId: string, stationName?: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id: string;
}

interface StationOption {
  id: string;
  name: string;
  nameJa: string;
  lines: string[];
}

export const StationSearch: FC<StationSearchProps> = ({
  onSelect,
  placeholder = "Search for a station...",
  disabled = false,
  className = "",
  id = ""
}) => {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // tRPC query for station search
  const { data, isLoading, error } = api.station.search.useQuery(
    { query: query.trim(), limit: 10 },
    {
      enabled: query.trim().length > 0,
      placeholderData: (previousData) => previousData,
      retry: (failureCount, error) => {
        // Retry on server errors but not on validation errors
        if (error?.data?.code === 'BAD_REQUEST') return false;
        return failureCount < 2;
      },
    }
  );

  const stations = data?.stations ?? [];

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && stations.length > 0 && e.key === 'ArrowDown') {
      setIsOpen(true);
      setSelectedIndex(0);
      return;
    }

    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < stations.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && stations[selectedIndex]) {
          handleSelect(stations[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleSelect = (station: StationOption) => {
    setQuery(station.name);
    setIsOpen(false);
    setSelectedIndex(-1);
    onSelect(station.id, station.name);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setIsOpen(value.trim().length > 0);
    setSelectedIndex(-1);
  };

  const handleInputFocus = () => {
    if (query.trim().length > 0 && stations.length > 0) {
      setIsOpen(true);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full px-4 py-3 pr-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed ${className}`}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="station-search-results"
          aria-autocomplete="list"
        />

        {/* Loading indicator */}
        {isLoading && query.length > 0 && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <svg
              className="animate-spin h-5 w-5 text-gray-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        )}

        {/* Search icon when not loading */}
        {!isLoading && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <svg
              className="h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Dropdown results */}
      {isOpen && (
        <div
          id="station-search-results"
          className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto"
          role="listbox"
        >
          {error && (
            <div className="px-4 py-3 text-sm text-red-600">
              Error loading stations. Please try again.
            </div>
          )}

          {!error && stations.length === 0 && !isLoading && (
            <div className="px-4 py-3 text-sm text-gray-500">
              No stations found for &quot;{query}&quot;
            </div>
          )}

          {stations.map((station, index) => (
            <button
              key={station.id}
              onClick={() => handleSelect(station)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors ${index === selectedIndex ? 'bg-gray-50' : ''
                }`}
              role="option"
              aria-selected={index === selectedIndex}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">
                    {station.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {station.nameJa}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 ml-2">
                  {station.lines.slice(0, 3).map((line, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded"
                    >
                      {line}
                    </span>
                  ))}
                  {station.lines.length > 3 && (
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-500">
                      +{station.lines.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

