'use client';

import { useState, useEffect } from 'react';
import { cn } from '~/utils/cn';

interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  formatValue?: (value: number) => string;
  className?: string;
  label?: string;
  disabled?: boolean;
}

export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  formatValue = (v) => v.toString(),
  className,
  label,
  disabled = false
}: RangeSliderProps) {
  const [isDragging, setIsDragging] = useState<'min' | 'max' | null>(null);
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleMouseDown = (thumb: 'min' | 'max') => {
    if (disabled) return;
    setIsDragging(thumb);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || disabled) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newValue = Math.round((min + percentage * (max - min)) / step) * step;
    
    let newRange: [number, number];
    if (isDragging === 'min') {
      newRange = [Math.min(newValue, localValue[1]), localValue[1]];
    } else {
      newRange = [localValue[0], Math.max(newValue, localValue[0])];
    }
    
    setLocalValue(newRange);
    onChange(newRange);
  };

  const handleMouseUp = () => {
    setIsDragging(null);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mouseup', handleMouseUp);
      return () => document.removeEventListener('mouseup', handleMouseUp);
    }
  }, [isDragging]);

  const minPercentage = ((localValue[0] - min) / (max - min)) * 100;
  const maxPercentage = ((localValue[1] - min) / (max - min)) * 100;

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      
      <div className="relative px-2">
        <div
          className="relative h-2 bg-gray-200 rounded-full cursor-pointer"
          onMouseMove={handleMouseMove}
          onClick={(e) => {
            if (disabled) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const percentage = (e.clientX - rect.left) / rect.width;
            const newValue = Math.round((min + percentage * (max - min)) / step) * step;
            
            // Determine which thumb is closer
            const distanceToMin = Math.abs(newValue - localValue[0]);
            const distanceToMax = Math.abs(newValue - localValue[1]);
            
            if (distanceToMin < distanceToMax) {
              onChange([Math.min(newValue, localValue[1]), localValue[1]]);
            } else {
              onChange([localValue[0], Math.max(newValue, localValue[0])]);
            }
          }}
        >
          {/* Active range */}
          <div
            className="absolute h-2 bg-primary-500 rounded-full"
            style={{
              left: `${minPercentage}%`,
              width: `${maxPercentage - minPercentage}%`,
            }}
          />
          
          {/* Min thumb */}
          <div
            className={cn(
              "absolute w-4 h-4 bg-white border-2 border-primary-500 rounded-full cursor-pointer shadow-sm",
              "transform -translate-x-1/2 -translate-y-1/2 top-1/2",
              isDragging === 'min' && "scale-110",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            style={{ left: `${minPercentage}%` }}
            onMouseDown={() => handleMouseDown('min')}
          />
          
          {/* Max thumb */}
          <div
            className={cn(
              "absolute w-4 h-4 bg-white border-2 border-primary-500 rounded-full cursor-pointer shadow-sm",
              "transform -translate-x-1/2 -translate-y-1/2 top-1/2",
              isDragging === 'max' && "scale-110",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            style={{ left: `${maxPercentage}%` }}
            onMouseDown={() => handleMouseDown('max')}
          />
        </div>
        
        {/* Value display */}
        <div className="flex justify-between mt-2 text-sm text-gray-600">
          <span>{formatValue(localValue[0])}</span>
          <span>{formatValue(localValue[1])}</span>
        </div>
      </div>
    </div>
  );
}