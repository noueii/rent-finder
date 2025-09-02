'use client';

import { useApartmentComparison } from '~/hooks/useApartmentComparison';
import { cn } from '~/utils/cn';
import { ScaleIcon } from '@heroicons/react/24/outline';

interface ComparisonBadgeProps {
  onClick: () => void;
  className?: string;
}

export function ComparisonBadge({ onClick, className }: ComparisonBadgeProps) {
  const { comparisonApartments } = useApartmentComparison();

  if (comparisonApartments.length === 0) return null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "fixed bottom-4 right-4 lg:bottom-6 lg:right-6 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 transition-colors z-40",
        "flex items-center gap-2 p-3 lg:p-4",
        className
      )}
    >
      <ScaleIcon className="h-5 w-5 lg:h-6 lg:w-6" />
      <span className="font-medium text-sm lg:text-base">
        <span className="hidden sm:inline">Compare </span>({comparisonApartments.length})
      </span>
      <div className="w-5 h-5 lg:w-6 lg:h-6 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
        <span className="text-xs lg:text-sm font-bold">{comparisonApartments.length}</span>
      </div>
    </button>
  );
}