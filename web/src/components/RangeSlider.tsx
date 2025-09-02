'use client';

import { useEffect, useState } from 'react';

interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  formatValue?: (value: number) => string;
  inputType?: 'number' | 'text';
}

export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  formatValue = (v) => v.toString(),
  inputType = 'number',
}: RangeSliderProps) {
  const [localValue, setLocalValue] = useState(value);
  const [inputValues, setInputValues] = useState<[string, string]>([
    value[0].toString(),
    value[1].toString(),
  ]);

  useEffect(() => {
    setLocalValue(value);
    setInputValues([value[0].toString(), value[1].toString()]);
  }, [value]);

  const getPercent = (value: number) => {
    return ((value - min) / (max - min)) * 100;
  };

  const handleMinSliderChange = (newMin: number) => {
    const clampedMin = Math.max(min, Math.min(newMin, localValue[1] - step));
    const newValue: [number, number] = [clampedMin, localValue[1]];
    setLocalValue(newValue);
    setInputValues([clampedMin.toString(), localValue[1].toString()]);
    onChange(newValue);
  };

  const handleMaxSliderChange = (newMax: number) => {
    const clampedMax = Math.min(max, Math.max(newMax, localValue[0] + step));
    const newValue: [number, number] = [localValue[0], clampedMax];
    setLocalValue(newValue);
    setInputValues([localValue[0].toString(), clampedMax.toString()]);
    onChange(newValue);
  };

  const handleMinInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValues([e.target.value, inputValues[1]]);
  };

  const handleMaxInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValues([inputValues[0], e.target.value]);
  };

  const handleMinInputBlur = () => {
    const newMin = Number(inputValues[0]);
    if (!isNaN(newMin)) {
      const clampedMin = Math.max(min, Math.min(newMin, localValue[1] - step));
      const newValue: [number, number] = [clampedMin, localValue[1]];
      setLocalValue(newValue);
      setInputValues([clampedMin.toString(), localValue[1].toString()]);
      onChange(newValue);
    } else {
      setInputValues([localValue[0].toString(), inputValues[1]]);
    }
  };

  const handleMaxInputBlur = () => {
    const newMax = Number(inputValues[1]);
    if (!isNaN(newMax)) {
      const clampedMax = Math.min(max, Math.max(newMax, localValue[0] + step));
      const newValue: [number, number] = [localValue[0], clampedMax];
      setLocalValue(newValue);
      setInputValues([localValue[0].toString(), clampedMax.toString()]);
      onChange(newValue);
    } else {
      setInputValues([inputValues[0], localValue[1].toString()]);
    }
  };

  const minPercent = getPercent(localValue[0]);
  const maxPercent = getPercent(localValue[1]);

  return (
    <div className="space-y-4">
      {/* Input fields */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <input
            type="number"
            value={inputValues[0]}
            onChange={handleMinInputChange}
            onBlur={handleMinInputBlur}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <input
            type="number"
            value={inputValues[1]}
            onChange={handleMaxInputChange}
            onBlur={handleMaxInputBlur}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Slider */}
      <div className="relative px-2 py-2">
        <div className="h-2 bg-gray-200 rounded-full">
          <div
            className="absolute h-2 bg-blue-500 rounded-full"
            style={{
              left: `${minPercent}%`,
              width: `${maxPercent - minPercent}%`,
            }}
          />
        </div>
        
        {/* Min slider */}
        <div
          className="absolute top-0 h-4 cursor-pointer"
          style={{
            left: '0%',
            width: `${maxPercent}%`,
          }}
        >
          <input
            type="range"
            min={min}
            max={localValue[1] - step}
            step={step}
            value={localValue[0]}
            onChange={(e) => handleMinSliderChange(Number(e.target.value))}
            className="absolute w-full h-full opacity-0 cursor-pointer"
            style={{ pointerEvents: 'auto' }}
          />
          <div
            className="absolute top-0 w-4 h-4 bg-blue-600 rounded-full shadow-md border-2 border-white pointer-events-none"
            style={{
              left: `${(minPercent / maxPercent) * 100}%`,
              transform: 'translateX(-50%)',
            }}
          />
        </div>
        
        {/* Max slider */}
        <div
          className="absolute top-0 h-4 cursor-pointer"
          style={{
            left: `${minPercent}%`,
            width: `${100 - minPercent}%`,
          }}
        >
          <input
            type="range"
            min={localValue[0] + step}
            max={max}
            step={step}
            value={localValue[1]}
            onChange={(e) => handleMaxSliderChange(Number(e.target.value))}
            className="absolute w-full h-full opacity-0 cursor-pointer"
            style={{ pointerEvents: 'auto' }}
          />
          <div
            className="absolute top-0 w-4 h-4 bg-blue-600 rounded-full shadow-md border-2 border-white pointer-events-none"
            style={{
              left: `${((maxPercent - minPercent) / (100 - minPercent)) * 100}%`,
              transform: 'translateX(-50%)',
            }}
          />
        </div>
      </div>

      {/* Labels */}
      <div className="flex justify-between text-xs text-gray-500">
        <span>{formatValue(min)}</span>
        <span>{formatValue(max)}</span>
      </div>
    </div>
  );
}