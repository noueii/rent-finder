'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useApartmentLists } from '~/hooks/useUserLists';
import { 
  MapPin, 
  Train, 
  Home, 
  DollarSign, 
  Calendar,
  Building,
  Heart,
  Bookmark,
  Star,
  Eye,
  ChevronLeft,
  ChevronRight,
  Clock
} from 'lucide-react';

interface Apartment {
  id: string;
  title: string;
  rentMonthly: number;
  size: number;
  layout?: string;
  address?: string;
  ward?: string;
  city?: string;
  buildingAge?: number;
  floorNumber?: number;
  totalFloors?: number;
  availableFrom?: string;
  mainImageUrl?: string;
  imageUrls?: string | string[];
  stations?: Array<{
    station: {
      id: string;
      name: string;
      name_ja?: string;
    } | null;
    walkingMinutes?: number;
  }>;
  commuteInfo?: {
    totalTime: number;
    transitTime: number;
    walkingTime: number;
    transfers: number;
  };
}

interface SearchResultsProps {
  apartments: Apartment[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export function SearchResults({
  apartments,
  totalCount,
  currentPage,
  pageSize,
  onPageChange,
  isLoading = false,
}: SearchResultsProps) {
  const totalPages = Math.ceil(totalCount / pageSize);
  const apartmentIds = apartments.map(apt => apt.id);
  const { listStatus, toggleSaved, toggleFavorites, toggleLiked } = useApartmentLists(apartmentIds);
  
  if (apartments.length === 0 && !isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center">
        <div className="max-w-sm mx-auto">
          <Home className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No apartments found
          </h3>
          <p className="text-gray-600">
            Try adjusting your filters to see more results.
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-gray-600">
          Showing {apartments.length} of {totalCount} apartments
        </p>
      </div>
      
      {/* Apartment Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {apartments.map((apartment) => {
          const status = listStatus[apartment.id] || { saved: false, favorites: false, liked: false, hidden: false };
          const primaryStation = apartment.stations?.[0];
          
          return (
            <div
              key={apartment.id}
              className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Image */}
              <Link href={`/apartment/${apartment.id}`}>
                <div className="relative h-48 bg-gray-200">
                  {apartment.mainImageUrl ? (
                    <img
                      src={apartment.mainImageUrl}
                      alt={apartment.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder-apartment.jpg';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Home className="w-12 h-12 text-gray-400" />
                    </div>
                  )}
                  
                  {/* Price Badge */}
                  <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-1 rounded-md">
                    <span className="font-bold">¥{apartment.rentMonthly.toLocaleString()}</span>
                    <span className="text-sm">/mo</span>
                  </div>
                  
                  {/* Commute Time Badge */}
                  {apartment.commuteInfo && (
                    <div className="absolute top-4 right-4 bg-blue-600 text-white px-3 py-1 rounded-md flex items-center gap-1">
                      <Clock size={14} />
                      <span className="text-sm font-medium">{apartment.commuteInfo.totalTime}min</span>
                    </div>
                  )}
                </div>
              </Link>
              
              {/* Content */}
              <div className="p-4">
                <Link href={`/apartment/${apartment.id}`}>
                  <h3 className="font-semibold text-gray-900 line-clamp-1 hover:text-blue-600">
                    {apartment.title}
                  </h3>
                </Link>
                
                {/* Basic Info */}
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Home size={14} />
                    <span>{apartment.layout || 'N/A'} • {apartment.size}m²</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Building size={14} />
                    <span>
                      {apartment.floorNumber ? `${apartment.floorNumber}F` : 'N/A'}
                      {apartment.totalFloors && `/${apartment.totalFloors}F`}
                    </span>
                  </div>
                </div>
                
                {/* Station Info */}
                {primaryStation && (
                  <div className="mt-2 flex items-start gap-1 text-sm text-gray-600">
                    <Train size={14} className="mt-0.5 flex-shrink-0" />
                    <div>
                      {primaryStation.station ? (
                        <>
                          <span className="font-medium">{primaryStation.station.name}</span>
                          {primaryStation.station.name_ja && (
                            <span className="text-xs text-gray-500 ml-1">({primaryStation.station.name_ja})</span>
                          )}
                        </>
                      ) : (
                        <span className="font-medium text-gray-500">Station info unavailable</span>
                      )}
                      {primaryStation.walkingMinutes && (
                        <span className="ml-1">• {primaryStation.walkingMinutes} min walk</span>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Commute Details */}
                {apartment.commuteInfo && (
                  <div className="mt-2 p-2 bg-blue-50 rounded-md text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-blue-900 font-medium">
                        Total commute: {apartment.commuteInfo.totalTime} min
                      </span>
                      <span className="text-blue-700 text-xs">
                        {apartment.commuteInfo.transfers} transfers
                      </span>
                    </div>
                  </div>
                )}
                
                {/* Location */}
                <div className="mt-2 flex items-center gap-1 text-sm text-gray-600">
                  <MapPin size={14} />
                  <span className="line-clamp-1">
                    {[apartment.ward, apartment.city].filter(Boolean).join(', ') || 'Tokyo'}
                  </span>
                </div>
                
                {/* Action Buttons */}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => toggleSaved(apartment.id)}
                    className={`p-2 rounded-md transition-colors ${
                      status.saved
                        ? 'bg-gray-800 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    title="Save"
                  >
                    <Bookmark size={16} />
                  </button>
                  
                  <button
                    onClick={() => toggleFavorites(apartment.id)}
                    className={`p-2 rounded-md transition-colors ${
                      status.favorites
                        ? 'bg-yellow-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    title="Add to favorites"
                  >
                    <Star size={16} />
                  </button>
                  
                  <button
                    onClick={() => toggleLiked(apartment.id)}
                    className={`p-2 rounded-md transition-colors ${
                      status.liked
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    title="Like"
                  >
                    <Heart size={16} />
                  </button>
                  
                  <Link
                    href={`/apartment/${apartment.id}`}
                    className="ml-auto px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1"
                  >
                    <Eye size={14} />
                    View
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-6">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-2 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            <ChevronLeft size={20} />
          </button>
          
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              
              if (pageNum < 1 || pageNum > totalPages) return null;
              
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={`px-3 py-1 rounded-md ${
                    pageNum === currentPage
                      ? 'bg-blue-600 text-white'
                      : 'border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-2 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
}