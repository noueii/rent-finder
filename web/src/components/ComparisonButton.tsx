'use client';

import { useState } from 'react';
import { useApartmentComparison, ComparisonApartment } from '~/hooks/useApartmentComparison';
import { cn } from '~/utils/cn';
import { 
  ScaleIcon, 
  CheckIcon, 
  XMarkIcon 
} from '@heroicons/react/24/outline';

interface ComparisonButtonProps {
  apartment: ComparisonApartment;
  variant?: 'icon' | 'button';
  className?: string;
}

export function ComparisonButton({ 
  apartment, 
  variant = 'button', 
  className 
}: ComparisonButtonProps) {
  const {
    isInComparison,
    addToComparison,
    removeFromComparison,
    canAddMore,
  } = useApartmentComparison();

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const inComparison = isInComparison(apartment.id);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (inComparison) {
      removeFromComparison(apartment.id);
      showToastMessage('Removed from comparison');
    } else {
      const result = addToComparison(apartment);
      showToastMessage(result.message);
    }
  };

  const showToastMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  if (variant === 'icon') {
    return (
      <div className="relative">
        <button
          onClick={handleClick}
          disabled={!inComparison && !canAddMore}
          className={cn(
            "p-2 rounded-full transition-all duration-200",
            inComparison
              ? "bg-primary-100 text-primary-700 hover:bg-primary-200"
              : canAddMore
              ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
              : "bg-gray-50 text-gray-400 cursor-not-allowed",
            className
          )}
          title={
            inComparison 
              ? "Remove from comparison" 
              : canAddMore 
              ? "Add to comparison" 
              : "Maximum apartments reached"
          }
        >
          {inComparison ? (
            <CheckIcon className="h-4 w-4" />
          ) : (
            <ScaleIcon className="h-4 w-4" />
          )}
        </button>

        {/* Toast notification */}
        {showToast && (
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-2 bg-black bg-opacity-80 text-white text-xs rounded-md whitespace-nowrap z-50">
            {toastMessage}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={!inComparison && !canAddMore}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
          inComparison
            ? "bg-primary-100 text-primary-700 hover:bg-primary-200"
            : canAddMore
            ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
            : "bg-gray-50 text-gray-400 cursor-not-allowed",
          className
        )}
      >
        {inComparison ? (
          <>
            <CheckIcon className="h-4 w-4" />
            In Comparison
          </>
        ) : (
          <>
            <ScaleIcon className="h-4 w-4" />
            Compare
          </>
        )}
      </button>

      {/* Toast notification */}
      {showToast && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-2 bg-black bg-opacity-80 text-white text-xs rounded-md whitespace-nowrap z-50">
          {toastMessage}
        </div>
      )}
    </div>
  );
}