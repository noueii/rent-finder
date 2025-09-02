'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '~/utils/cn';
import { ChevronDownIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface Option {
  value: string;
  label: string;
  count?: number;
}

interface MultiSelectProps {
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  maxDisplayItems?: number;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Select options...',
  label,
  disabled = false,
  className,
  maxDisplayItems = 3
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedOptions = options.filter(option => value.includes(option.value));

  const handleToggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter(v => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const handleRemoveOption = (optionValue: string) => {
    onChange(value.filter(v => v !== optionValue));
  };

  const displayText = () => {
    if (value.length === 0) return placeholder;
    if (value.length <= maxDisplayItems) {
      return selectedOptions.map(opt => opt.label).join(', ');
    }
    return `${selectedOptions.slice(0, maxDisplayItems).map(opt => opt.label).join(', ')} +${value.length - maxDisplayItems}`;
  };

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      
      <div
        className={cn(
          "relative w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm cursor-pointer",
          "focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500",
          disabled && "opacity-50 cursor-not-allowed",
          isOpen && "ring-2 ring-primary-500 border-primary-500"
        )}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between">
          <span className={cn(
            "block truncate",
            value.length === 0 && "text-gray-400"
          )}>
            {displayText()}
          </span>
          <ChevronDownIcon 
            className={cn(
              "h-4 w-4 text-gray-400 transition-transform",
              isOpen && "rotate-180"
            )} 
          />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white shadow-lg rounded-md border border-gray-200 max-h-60 overflow-y-auto">
          {/* Search input */}
          <div className="p-2 border-b border-gray-200">
            <input
              type="text"
              placeholder="Search options..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          {/* Options */}
          <div className="py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">
                No options found
              </div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className={cn(
                    "px-3 py-2 text-sm cursor-pointer hover:bg-gray-100",
                    "flex items-center justify-between",
                    value.includes(option.value) && "bg-primary-50 text-primary-900"
                  )}
                  onClick={() => handleToggleOption(option.value)}
                >
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={value.includes(option.value)}
                      onChange={() => {}} // Handled by parent onClick
                      className="mr-2 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <span>{option.label}</span>
                  </div>
                  {option.count && (
                    <span className="text-xs text-gray-500">({option.count})</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Selected items as tags */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedOptions.slice(0, maxDisplayItems).map((option) => (
            <span
              key={option.value}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800"
            >
              {option.label}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveOption(option.value);
                }}
                className="ml-1 h-3 w-3 text-primary-600 hover:text-primary-800"
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
          {value.length > maxDisplayItems && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
              +{value.length - maxDisplayItems} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}