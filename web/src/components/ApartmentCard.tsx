'use client';

import { cn } from "~/utils/cn";
import { ComparisonButton } from "./ComparisonButton";

interface ApartmentCardProps {
  apartment: {
    id: string;
    title: string;
    rentMonthly: number;
    size: number;
    layout: string;
    buildingName?: string;
    unitNumber?: string;
    buildingAge?: number;
    walkingMinutes: number;
    imageUrls?: string[];
    features?: string[];
    station: {
      id: string;
      name: string;
      nameJa: string;
    };
    commute: {
      totalMinutes: number;
      transitMinutes: number;
      walkingMinutes: number;
      transferCount: number;
    };
  };
}

export function ApartmentCard({ apartment }: ApartmentCardProps) {
  const formatRent = (rent: number) => {
    return new Intl.NumberFormat('ja-JP', { 
      style: 'currency', 
      currency: 'JPY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(rent);
  };

  const hasImages = apartment.imageUrls && apartment.imageUrls.length > 0;
  const firstImage = hasImages ? apartment.imageUrls![0] : null;
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* Image */}
      <div className="aspect-video bg-gray-100 flex items-center justify-center relative">
        {firstImage ? (
          <img
            src={firstImage}
            alt={apartment.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-gray-400 text-sm">
            No image available
          </div>
        )}
        
        {/* Image count badge */}
        {hasImages && apartment.imageUrls!.length > 1 && (
          <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
            +{apartment.imageUrls!.length - 1} more
          </div>
        )}
        
        {/* Comparison button */}
        <div className="absolute top-2 left-2">
          <ComparisonButton apartment={apartment} variant="icon" />
        </div>
      </div>
      
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
          {apartment.title}
        </h3>
        
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center justify-between">
            <span className="font-medium text-lg text-gray-900">
              {formatRent(apartment.rentMonthly)}
            </span>
            <span className="text-xs bg-gray-100 px-2 py-1 rounded">
              {apartment.size}㎡ • {apartment.layout}
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {apartment.station.name}
            </span>
            
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {apartment.commute.totalMinutes} min total
            </span>
          </div>
          
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Walk: {apartment.walkingMinutes} min</span>
            <span>Transit: {apartment.commute.transitMinutes} min</span>
            {apartment.commute.transferCount > 0 && (
              <span>{apartment.commute.transferCount} transfer{apartment.commute.transferCount > 1 ? 's' : ''}</span>
            )}
          </div>
          
          {/* Features */}
          {apartment.features && apartment.features.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {apartment.features.slice(0, 3).map((feature, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                >
                  {feature}
                </span>
              ))}
              {apartment.features.length > 3 && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
                  +{apartment.features.length - 3} more
                </span>
              )}
            </div>
          )}
          
          {/* Building age */}
          {apartment.buildingAge && (
            <div className="text-xs text-gray-500">
              Building age: {apartment.buildingAge} years
            </div>
          )}
        </div>
        
        <a
          href={`/apartment/${apartment.id}`}
          className="block w-full mt-4 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors text-sm font-medium text-center"
        >
          View Details
        </a>
      </div>
    </div>
  );
}