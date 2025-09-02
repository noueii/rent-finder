'use client';

import React, { useState, useRef, useEffect } from 'react';

interface Station {
  id: string;
  name: string;
  nameJa: string;
  lines: string[];
}

interface StationSearchDropdownProps {
  stations: Station[];
  value: string | null;
  onChange: (stationId: string) => void;
  placeholder?: string;
}

export function StationSearchDropdown({
  stations,
  value,
  onChange,
  placeholder = "Search for a station..."
}: StationSearchDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Find selected station
  const selectedStation = stations.find(s => s.id === value);

  // Normalize station names for better matching - remove all spaces and dashes
  const normalizeStationName = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/\s+station$/i, '') // Remove "Station" suffix
      .replace(/\s+駅$/i, '')      // Remove Japanese "eki" suffix
      .replace(/^jr\s+/i, '')      // Remove "JR" prefix
      .replace(/[\s-・－−‐]/g, '') // Remove all spaces, dashes, and Japanese separators
      .trim();
  };

  // Calculate similarity between two strings with Japanese romanization awareness
  const calculateSimilarity = (str1: string, str2: string): number => {
    if (str1 === str2) return 100;
    if (str1.length === 0 || str2.length === 0) return 0;
    
    // Pre-process strings for Japanese romanization variations
    const normalizeForJapanese = (str: string): string => {
      return str
        .replace(/ou/g, 'o')    // "ou" -> "o" (Tokyo vs Toukyou)
        .replace(/uu/g, 'u')    // "uu" -> "u" (Kyushu vs Kyuushuu)
        .replace(/oo/g, 'o')    // "oo" -> "o" (Osaka vs Oosaka)
        .replace(/aa/g, 'a')    // "aa" -> "a" (Sapporo vs Saapporo)
        .replace(/ei/g, 'e')    // "ei" -> "e" (Kei vs Kee)
        .replace(/nn/g, 'n')    // Double n normalization
        .replace(/mm/g, 'm')    // Double m normalization
        .replace(/pp/g, 'p')    // Double p normalization
        .replace(/tt/g, 't')    // Double t normalization
        .replace(/kk/g, 'k')    // Double k normalization
        .replace(/ss/g, 's');   // Double s normalization
    };
    
    const norm1 = normalizeForJapanese(str1);
    const norm2 = normalizeForJapanese(str2);
    
    // Levenshtein distance calculation with reduced cost for vowel variations
    const matrix = [];
    const len1 = norm1.length;
    const len2 = norm2.length;
    
    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }
    
    // Helper function to get substitution cost
    const getSubstitutionCost = (char1: string, char2: string): number => {
      if (char1 === char2) return 0;
      
      // Reduced cost for similar vowels
      const vowelGroups = [
        ['a', 'aa'],
        ['e', 'ee', 'ei'],
        ['i', 'ii'],
        ['o', 'oo', 'ou'],
        ['u', 'uu']
      ];
      
      for (const group of vowelGroups) {
        if (group.includes(char1) && group.includes(char2)) {
          return 0.3; // Much lower cost for vowel variations
        }
      }
      
      // Reduced cost for similar consonants
      const consonantGroups = [
        ['n', 'nn'],
        ['m', 'mm'],
        ['p', 'pp'],
        ['t', 'tt'],
        ['k', 'kk'],
        ['s', 'ss']
      ];
      
      for (const group of consonantGroups) {
        if (group.includes(char1) && group.includes(char2)) {
          return 0.5; // Lower cost for consonant doubling
        }
      }
      
      return 1; // Standard substitution cost
    };
    
    // Fill matrix with weighted costs
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = getSubstitutionCost(norm1[i - 1], norm2[j - 1]);
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,           // deletion
          matrix[i][j - 1] + 1,           // insertion
          matrix[i - 1][j - 1] + cost     // substitution
        );
      }
    }
    
    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);
    
    // Convert to similarity percentage
    return Math.round(((maxLen - distance) / maxLen) * 100);
  };

  // Filter and rank stations based on search
  const filteredStations = stations
    .map(station => {
      const query = normalizeStationName(searchQuery);
      const queryLower = searchQuery.toLowerCase();
      const nameLower = station.name.toLowerCase();
      const nameJaLower = station.nameJa.toLowerCase();
      const nameNormalized = normalizeStationName(station.name);
      const nameJaNormalized = normalizeStationName(station.nameJa);
      
      // Calculate relevance score
      let score = 0;
      let matches = false;
      let matchType = '';
      
      // Skip if query is empty
      if (!query && !queryLower) {
        return { ...station, score, matches, matchType };
      }
      
      // Normalized exact matches get highest score (spaces and dashes removed)
      if (nameNormalized === query || nameJaNormalized === query) {
        score = 120;
        matches = true;
        matchType = 'exact (normalized)';
      }
      // Original exact matches get very high score 
      else if (nameLower === queryLower || nameJaLower === queryLower) {
        score = 100;
        matches = true;
        matchType = 'exact';
      }
      // Normalized starts with query gets high score
      else if (nameNormalized.startsWith(query) || nameJaNormalized.startsWith(query)) {
        score = 90;
        matches = true;
        matchType = 'starts with (normalized)';
      }
      // Original starts with query gets high score
      else if (nameLower.startsWith(queryLower) || nameJaLower.startsWith(queryLower)) {
        score = 80;
        matches = true;
        matchType = 'starts with';
      }
      // Normalized contains query gets medium score
      else if (nameNormalized.includes(query) || nameJaNormalized.includes(query)) {
        score = 60;
        matches = true;
        matchType = 'contains (normalized)';
      }
      // Original contains query gets medium score
      else if (nameLower.includes(queryLower) || nameJaLower.includes(queryLower)) {
        score = 40;
        matches = true;
        matchType = 'contains';
      }
      // Line matches get lower score
      else if (station.lines.some(line => line.toLowerCase().includes(queryLower))) {
        score = 20;
        matches = true;
        matchType = 'line match';
      }
      // Fuzzy matching for typos (only if no other matches found)
      else {
        const nameSimilarity = calculateSimilarity(nameNormalized, query);
        const nameJaSimilarity = calculateSimilarity(nameJaNormalized, query);
        const originalSimilarity = Math.max(
          calculateSimilarity(nameLower, queryLower),
          calculateSimilarity(nameJaLower, queryLower)
        );
        
        const bestSimilarity = Math.max(nameSimilarity, nameJaSimilarity, originalSimilarity);
        
        // Only show fuzzy matches with reasonable similarity (70%+ for short queries, 80%+ for longer)
        const minSimilarity = queryLower.length <= 3 ? 70 : 80;
        
        if (bestSimilarity >= minSimilarity) {
          score = Math.round(bestSimilarity * 0.5); // Scale down fuzzy scores (max 50)
          matches = true;
          matchType = `fuzzy (${bestSimilarity}% similar)`;
        }
      }
      
      // Bonus points for major stations (those with multiple lines)
      if (matches && station.lines.length > 2) {
        score += 10;
      }
      
      // Bonus for stations without parentheses (main stations vs sub-stations)
      if (matches && !station.name.includes('(')) {
        score += 5;
      }
      
      return { ...station, score, matches, matchType };
    })
    .filter(item => item.matches)
    .sort((a, b) => {
      // Sort by score first
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      // Then by number of lines (major stations first)
      if (b.lines.length !== a.lines.length) {
        return b.lines.length - a.lines.length;
      }
      // Finally alphabetically
      return a.name.localeCompare(b.name);
    });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (stationId: string) => {
    onChange(stationId);
    setIsOpen(false);
    setSearchQuery('');
    setSelectedIndex(-1);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setIsOpen(true);
        setSelectedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => {
          const newIndex = prev < filteredStations.length - 1 ? prev + 1 : 0;
          return newIndex;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => {
          const newIndex = prev > 0 ? prev - 1 : filteredStations.length - 1;
          return newIndex;
        });
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredStations.length > 0) {
          // Always select the currently highlighted item (which defaults to first)
          const indexToSelect = selectedIndex >= 0 ? selectedIndex : 0;
          handleSelect(filteredStations[indexToSelect].id);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSelectedIndex(-1);
        setSearchQuery('');
        break;
    }
  };

  // Auto-focus on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Always select the first item when results are available
  useEffect(() => {
    if (filteredStations.length > 0 && isOpen) {
      setSelectedIndex(0);
    } else {
      setSelectedIndex(-1);
    }
  }, [filteredStations.length, isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Input field */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder={selectedStation ? `${selectedStation.name} (${selectedStation.nameJa})` : placeholder}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {/* Clear button */}
        {(value || searchQuery) && (
          <button
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            onClick={() => {
              setSearchQuery('');
              onChange('');
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {filteredStations.length === 0 ? (
            <div className="px-4 py-3 text-gray-500">No stations found</div>
          ) : (
            filteredStations.slice(0, 50).map((station, index) => {
              // Highlight matching parts
              const query = searchQuery.toLowerCase();
              const nameMatch = station.name.toLowerCase().includes(query);
              const nameJaMatch = station.nameJa.toLowerCase().includes(query);
              const isMajorStation = station.lines.length > 2;
              
              // Get score color based on score value and match type
              const getScoreColor = (score: number, matchType: string) => {
                if (matchType.startsWith('fuzzy')) {
                  return 'text-purple-600 bg-purple-50 border border-purple-200';
                }
                if (score >= 100) return 'text-green-600 bg-green-50';
                if (score >= 80) return 'text-blue-600 bg-blue-50';
                if (score >= 60) return 'text-yellow-600 bg-yellow-50';
                return 'text-gray-600 bg-gray-50';
              };
              
              return (
                <button
                  key={station.id}
                  className={`w-full px-4 py-3 text-left focus:outline-none ${
                    index === selectedIndex 
                      ? 'bg-blue-100 border-blue-300' 
                      : 'hover:bg-gray-50'
                  } ${
                    station.id === value ? 'bg-blue-50' : ''
                  } ${index === 0 ? 'border-t-2 border-green-400' : ''}`}
                  onClick={() => handleSelect(station.id)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onMouseLeave={() => {
                    // Reset to first item when mouse leaves, not to -1
                    if (filteredStations.length > 0) {
                      setSelectedIndex(0);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium">
                        {station.name} <span className="text-gray-500">({station.nameJa})</span>
                        {isMajorStation && (
                          <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                            Major Station
                          </span>
                        )}
                        {index === selectedIndex && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                            Selected
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 flex items-center gap-2">
                        <span>
                          {station.lines.length > 3 
                            ? `${station.lines.slice(0, 3).join(', ')} +${station.lines.length - 3} more`
                            : station.lines.join(', ')
                          }
                        </span>
                        {searchQuery && (
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${getScoreColor(station.score, station.matchType)}`}>
                            {station.score} - {station.matchType}
                          </span>
                        )}
                      </div>
                    </div>
                    {index < 3 && (
                      <div className="ml-2 text-xs text-gray-500">
                        #{index + 1}
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
          {filteredStations.length > 50 && (
            <div className="px-4 py-2 text-sm text-gray-500 border-t">
              Showing first 50 results. Type more to narrow down.
            </div>
          )}
        </div>
      )}
    </div>
  );
}