'use client';

import { useState, useEffect, useRef } from 'react';
import { Heart, Star, Bookmark, X, ChevronLeft, ChevronRight, Info, MapPin, Building2, Calendar, Train, Home, Ruler, DollarSign, Key, Car, Clock, Eye, Maximize } from 'lucide-react';
import { cn } from '~/utils/cn';
import { useApartmentLists } from '~/hooks/useUserLists';
import Link from 'next/link';

interface Apartment {
  id: string;
  title: string;
  rentMonthly: number;
  layout?: string;
  size: number;
  description?: string;
  address?: string;
  prefecture?: string;
  city?: string;
  ward?: string;
  imageUrls?: string | string[] | null;
  mainImageUrl?: string;
  images?: Array<{
    url: string;
    displayOrder?: number;
  }>;
  stations?: Array<{
    station: {
      name: string;
      name_ja: string;
    };
    walkingMinutes?: number;
  }>;
  stationName?: string;
  walkingMinutes?: number;
  commuteInfo?: {
    totalTime: number;
    transitTime: number;
    walkingTime: number;
    transfers: number;
    route?: string[];
  };
  features?: string[];
  buildingType?: string;
  floor?: number;
  floorNumber?: number;
  totalFloors?: number;
  buildingAge?: number;
  availableFrom?: string;
  deposit?: number;
  keyMoney?: number;
  depositMonths?: number;
  keyMoneyMonths?: number;
  managementFee?: number;
  maintenanceFee?: number;
  parkingFee?: number;
  sourceUrl?: string;
  sourceSite?: string;
}

interface TinderApartmentViewProps {
  apartments: Apartment[];
  filters: {
    targetStation: string;
    maxCommuteTime: number;
    maxRent?: number;
    minRooms?: number;
    area?: string;
    sortBy?: string;
  };
  onSwipeLeft: (apartmentId: string) => void;
  onSwipeRight: (apartmentId: string) => void;
}

export function TinderApartmentView({
  apartments,
  filters,
  onSwipeLeft,
  onSwipeRight
}: TinderApartmentViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const currentApartment = apartments[currentIndex];
  const apartmentIds = apartments.map(apt => apt.id);
  const { listStatus, toggleSaved, toggleFavorites, toggleLiked, toggleHidden } = useApartmentLists(apartmentIds);

  // Reset image index when apartment changes
  useEffect(() => {
    setCurrentImageIndex(0);
    setShowDetails(false);
  }, [currentIndex]);

  // Get apartment images in a simple, readable way
  const getImages = (): string[] => {
    if (!currentApartment) return [];

    // Debug log to understand the apartment data structure
    console.log('=== APARTMENT IMAGE DEBUG ===');
    console.log('Apartment ID:', currentApartment.id);
    console.log('Apartment Title:', currentApartment.title);
    console.log('mainImageUrl:', currentApartment.mainImageUrl);
    console.log('images array:', currentApartment.images);
    console.log('imageUrls:', currentApartment.imageUrls);
    console.log('imageUrls type:', typeof currentApartment.imageUrls);
    console.log('imageUrls is Array:', Array.isArray(currentApartment.imageUrls));

    const allImages: string[] = [];

    // Add main image first if it exists
    if (currentApartment.mainImageUrl) {
      console.log('Adding mainImageUrl:', currentApartment.mainImageUrl);
      allImages.push(currentApartment.mainImageUrl);
    }

    // Add images from images array
    if (currentApartment.images?.length) {
      console.log('Processing images array:', currentApartment.images);
      allImages.push(...currentApartment?.images?.map((im) => im.url))
    }


    // Add images from imageUrls array (legacy support)
    return Array.from(new Set(allImages))
  };

  const handleSwipe = (direction: 'left' | 'right') => {
    if (isAnimating || !currentApartment) return;

    setIsAnimating(true);

    if (direction === 'left') {
      toggleHidden(currentApartment.id);
      onSwipeLeft(currentApartment.id);
    } else {
      onSwipeRight(currentApartment.id);
    }

    // Use a ref to avoid multiple rapid state updates
    setTimeout(() => {
      setCurrentIndex(prev => {
        const nextIndex = prev + 1;
        if (nextIndex >= apartments.length) return prev;
        return nextIndex;
      });
      setIsAnimating(false);
    }, 300);
  };

  const images = getImages();

  const nextImage = () => {
    if (currentImageIndex < images.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1);
    }
  };

  const prevImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setIsDragging(true);
    setDragOffset(0);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStart || !isDragging) return;
    e.preventDefault();

    const currentX = e.targetTouches[0].clientX;
    const diff = currentX - touchStart;

    setTouchEnd(currentX);
    setDragOffset(diff);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd || isAnimating) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    setIsDragging(false);
    setDragOffset(0);

    if (isLeftSwipe) {
      handleSwipe('left'); // Block apartment
    } else if (isRightSwipe) {
      handleSwipe('right'); // Like apartment
    }
  };


  if (!currentApartment) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        <div className="text-center">
          <h3 className="text-xl font-semibold mb-2">No more apartments</h3>
          <p>Try adjusting your filters to see more results</p>
        </div>
      </div>
    );
  }

  const currentStatus = listStatus[currentApartment.id] || { saved: false, favorites: false, liked: false, hidden: false };

  return (
    <>
      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
          <div className="relative w-full h-full flex items-center justify-center">
            <img
              src={images[currentImageIndex]}
              alt={`${currentApartment.title} - Image ${currentImageIndex + 1}`}
              className="max-w-full max-h-full object-contain"
              onError={(e) => {
                e.currentTarget.src = '/placeholder-image.svg';
              }}
            />

            {/* Fullscreen navigation */}
            {images.length > 1 && (
              <>
                {/* Left click zone */}
                {currentImageIndex > 0 && (
                  <div
                    onClick={prevImage}
                    className="absolute left-0 top-0 w-1/3 h-full cursor-pointer"
                    title="Previous image"
                  />
                )}

                {/* Right click zone */}
                {currentImageIndex < images.length - 1 && (
                  <div
                    onClick={nextImage}
                    className="absolute right-0 top-0 w-1/3 h-full cursor-pointer"
                    title="Next image"
                  />
                )}
              </>
            )}

            {/* Close button */}
            <button
              onClick={toggleFullscreen}
              className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-colors"
            >
              <X size={20} />
            </button>

            {/* Image counter in fullscreen */}
            {images.length > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-3 py-2 rounded text-sm">
                {currentImageIndex + 1} / {images.length}
              </div>
            )}

            {/* Image dots in fullscreen */}
            {images.length > 1 && (
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex gap-2">
                {images?.map((_, index) => (
                  <div
                    key={index}
                    className={`w-3 h-3 rounded-full transition-colors cursor-pointer ${index === currentImageIndex ? 'bg-white' : 'bg-white/50'
                      }`}
                    onClick={() => setCurrentImageIndex(index)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto relative h-full flex flex-col">
        {/* Card Stack Background */}
        {apartments[currentIndex + 1] && (
          <div className="absolute inset-0 bg-white rounded-2xl shadow-lg transform scale-95 -z-10 opacity-50" />
        )}

        {/* Main Card */}
        <div
          ref={cardRef}
          className={cn(
            "relative bg-white rounded-2xl shadow-2xl overflow-hidden flex-1 flex flex-col",
            isAnimating && "transform scale-95 opacity-0",
            !isDragging && "transition-transform duration-300"
          )}
          style={{
            transform: isDragging ? `translateX(${dragOffset}px) rotate(${dragOffset * 0.05}deg)` : 'none',
            opacity: isDragging ? Math.max(0.7, 1 - Math.abs(dragOffset) / 400) : 1,
            willChange: isDragging ? 'transform, opacity' : 'auto'
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Swipe Overlays */}
          {isDragging && (
            <>
              {/* Like Overlay (Right Swipe) */}
              {dragOffset > 20 && (
                <div
                  className="absolute inset-0 bg-green-500/10 flex items-center justify-center z-20 pointer-events-none"
                  style={{ opacity: Math.min(dragOffset / 80, 0.8) }}
                >
                  <div className="bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-lg">
                    LIKE
                  </div>
                </div>
              )}

              {/* Dislike Overlay (Left Swipe) */}
              {dragOffset < -20 && (
                <div
                  className="absolute inset-0 bg-red-500/10 flex items-center justify-center z-20 pointer-events-none"
                  style={{ opacity: Math.min(Math.abs(dragOffset) / 80, 0.8) }}
                >
                  <div className="bg-red-500 text-white px-4 py-2 rounded-lg font-bold text-lg">
                    NOPE
                  </div>
                </div>
              )}
            </>
          )}

          {/* Image Section */}
          <div className="relative flex-1 min-h-[300px] bg-gray-200 overflow-hidden">
            {images.length > 0 ? (
              <>
                <img
                  src={images[currentImageIndex]}
                  alt={`${currentApartment.title} - Image ${currentImageIndex + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = '/placeholder-image.svg';
                  }}
                />

                {/* Invisible click zones for left/right navigation */}
                {images.length > 1 && (
                  <>
                    {/* Left click zone */}
                    {currentImageIndex > 0 && (
                      <div
                        onClick={prevImage}
                        className="absolute left-0 top-0 w-1/3 h-full cursor-pointer z-10"
                        title="Previous image"
                      />
                    )}

                    {/* Right click zone */}
                    {currentImageIndex < images.length - 1 && (
                      <div
                        onClick={nextImage}
                        className="absolute right-0 top-0 w-1/3 h-full cursor-pointer z-10"
                        title="Next image"
                      />
                    )}
                  </>
                )}

                {/* Image dots indicator */}
                {images.length > 1 && (
                  <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex gap-1">
                    {images?.map((_, index) => (
                      <div
                        key={index}
                        className={`w-2 h-2 rounded-full transition-colors ${index === currentImageIndex ? 'bg-white' : 'bg-white/50'
                          }`}
                      />
                    ))}
                  </div>
                )}


                {/* Fullscreen button */}
                <button
                  onClick={toggleFullscreen}
                  className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                >
                  <Maximize size={16} />
                </button>

                {/* Image counter */}
                {images.length > 1 && (
                  <div className="absolute bottom-4 right-4 bg-black/50 text-white px-2 py-1 rounded text-sm">
                    {currentImageIndex + 1} / {images.length}
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100">
                <div className="text-center p-4">
                  <div className="w-16 h-16 bg-gray-300 rounded-lg mb-3 mx-auto flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-500 font-medium">No Images Available</p>
                </div>
              </div>
            )}
          </div>

          {/* Info Section - Very Compact */}
          <div className="p-3 overflow-y-auto flex-shrink-0" style={{ maxHeight: '50vh' }}>
            {/* Title and Price */}
            <div className="mb-2">
              <h2 className="text-base font-bold text-gray-900 line-clamp-1">
                {currentApartment.title}
              </h2>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-lg font-bold text-primary-600">
                  ¥{currentApartment.rentMonthly?.toLocaleString() || 'N/A'}
                  <span className="text-xs font-normal text-gray-500">/mo</span>
                </span>
                <div className="flex items-center gap-2 text-xs">
                  <span className="flex items-center gap-0.5">
                    <Home size={12} className="text-gray-400" />
                    {currentApartment.layout || 'N/A'}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <Ruler size={12} className="text-gray-400" />
                    {currentApartment.size || 0}m²
                  </span>
                </div>
              </div>
            </div>

            {/* Station & Commute Info - Primary Feature */}
            {(currentApartment.stationName || (currentApartment.stations && currentApartment.stations.length > 0)) && (
              <div className="bg-blue-50 rounded-lg p-2 mb-2">
                <div className="flex items-start gap-2">
                  <Train size={14} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    {/* Primary Station */}
                    <div className="font-medium text-xs text-blue-900">
                      {currentApartment.stationName || (currentApartment.stations?.[0]?.station?.name || 'Unknown Station')}
                    </div>
                    <div className="text-xs text-blue-700">
                      {currentApartment.stations?.[0]?.station?.name_ja || ''}
                      {(currentApartment.walkingMinutes || currentApartment.stations?.[0]?.walkingMinutes) &&
                        ` • ${currentApartment.walkingMinutes || currentApartment.stations?.[0]?.walkingMinutes} min walk`
                      }
                    </div>

                    {/* Commute Info */}
                    {currentApartment.commuteInfo && (
                      <div className="mt-2 pt-2 border-t border-blue-200">
                        <div className="text-xs font-medium text-blue-900 mb-1">
                          Total commute: {currentApartment.commuteInfo.totalTime} min
                        </div>
                        <div className="flex items-center gap-3 text-xs text-blue-700">
                          <span>🚶 {currentApartment.commuteInfo.walkingTime}m</span>
                          <span>🚃 {currentApartment.commuteInfo.transitTime}m</span>
                          <span>🔄 {currentApartment.commuteInfo.transfers} transfers</span>
                        </div>
                      </div>
                    )}

                    {/* Additional Stations */}
                    {currentApartment.stations && currentApartment.stations.length > 1 && (
                      <div className="mt-2 space-y-1">
                        {currentApartment?.stations?.slice(1, 3).map((station, idx) => (
                          <div key={idx} className="text-xs text-blue-600">
                            • {station.station.name} - {station.walkingMinutes}m walk
                          </div>
                        ))}
                        {currentApartment.stations.length > 3 && (
                          <div className="text-xs text-blue-500">
                            +{currentApartment.stations.length - 3} more stations
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Location and Building Info Grid */}
            <div className="grid grid-cols-2 gap-1.5 mb-2 text-xs">
              {/* Location */}
              <div className="flex items-center gap-1.5 text-gray-600">
                <MapPin size={12} className="text-gray-400" />
                <span className="truncate">
                  {[currentApartment.ward, currentApartment.city]
                    .filter(Boolean)
                    .join(', ') || 'Tokyo'}
                </span>
              </div>

              {/* Building Type */}
              {currentApartment.buildingType && (
                <div className="flex items-center gap-1.5 text-gray-600">
                  <Building2 size={12} className="text-gray-400" />
                  <span className="truncate">{currentApartment.buildingType}</span>
                </div>
              )}

              {/* Floor */}
              {(currentApartment.floor || currentApartment.floorNumber) && (
                <div className="flex items-center gap-1.5 text-gray-600">
                  <Building2 size={12} className="text-gray-400" />
                  <span>
                    {currentApartment.floor || currentApartment.floorNumber}F
                    {currentApartment.totalFloors && `/${currentApartment.totalFloors}F`}
                  </span>
                </div>
              )}

              {/* Building Age */}
              {currentApartment.buildingAge !== undefined && (
                <div className="flex items-center gap-1.5 text-gray-600">
                  <Clock size={12} className="text-gray-400" />
                  <span>{currentApartment.buildingAge}yr old</span>
                </div>
              )}

              {/* Available From */}
              {currentApartment.availableFrom && (
                <div className="flex items-center gap-1.5 text-gray-600">
                  <Calendar size={12} className="text-gray-400" />
                  <span>{new Date(currentApartment.availableFrom).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
              )}
            </div>

            {/* Cost Details - Compact */}
            <div className="border-t pt-2 mb-2 space-y-1">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {/* Maintenance Fee */}
                {(currentApartment.maintenanceFee !== undefined || currentApartment.managementFee !== undefined) && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Maintenance:</span>
                    <span className="font-medium">¥{(currentApartment.maintenanceFee || currentApartment.managementFee || 0).toLocaleString()}</span>
                  </div>
                )}

                {/* Deposit */}
                {(currentApartment.deposit !== undefined || currentApartment.depositMonths !== undefined) && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Deposit:</span>
                    <span className="font-medium">
                      {currentApartment.depositMonths !== undefined
                        ? `${currentApartment.depositMonths} months`
                        : `¥${(currentApartment.deposit || 0).toLocaleString()}`
                      }
                    </span>
                  </div>
                )}

                {/* Key Money */}
                {(currentApartment.keyMoney !== undefined || currentApartment.keyMoneyMonths !== undefined) && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Key Money:</span>
                    <span className="font-medium">
                      {currentApartment.keyMoneyMonths !== undefined
                        ? `${currentApartment.keyMoneyMonths} months`
                        : `¥${(currentApartment.keyMoney || 0).toLocaleString()}`
                      }
                    </span>
                  </div>
                )}

                {/* Parking */}
                {currentApartment.parkingFee !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Parking:</span>
                    <span className="font-medium">¥{currentApartment.parkingFee.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Total Initial Cost */}
              {(currentApartment.deposit !== undefined || currentApartment.keyMoney !== undefined ||
                currentApartment.depositMonths !== undefined || currentApartment.keyMoneyMonths !== undefined) && (
                  <div className="flex items-center justify-between pt-1 border-t text-xs">
                    <span className="text-gray-600 font-medium">Initial Cost:</span>
                    <span className="font-bold text-sm">
                      ¥{(() => {
                        let total = currentApartment.rentMonthly; // First month's rent

                        if (currentApartment.depositMonths !== undefined) {
                          total += currentApartment.rentMonthly * currentApartment.depositMonths;
                        } else if (currentApartment.deposit !== undefined) {
                          total += currentApartment.deposit;
                        }

                        if (currentApartment.keyMoneyMonths !== undefined) {
                          total += currentApartment.rentMonthly * currentApartment.keyMoneyMonths;
                        } else if (currentApartment.keyMoney !== undefined) {
                          total += currentApartment.keyMoney;
                        }

                        return total.toLocaleString();
                      })()}
                    </span>
                  </div>
                )}
            </div>

            {/* Description */}
            {currentApartment.description && (
              <div className="mb-2 p-1.5 bg-gray-50 rounded text-xs text-gray-600 line-clamp-1">
                {currentApartment.description}
              </div>
            )}


            {/* Features - Compact Tags */}
            {currentApartment.features && currentApartment.features.length > 0 && (
              <div className="flex flex-wrap gap-0.5 mb-2">
                {[currentApartment.features.slice(0, 6)].map((feature, index) => (
                  <span
                    key={index}
                    className="px-1 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                  >
                    {feature}
                  </span>
                ))}
                {currentApartment.features.length > 6 && (
                  <span className="px-1 py-0.5 text-gray-500 text-xs">
                    +{currentApartment.features.length - 6}
                  </span>
                )}
              </div>
            )}

            {/* View Details Link */}
            <div className="mb-2">
              <Link
                href={`/apartment/${currentApartment.id}`}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Eye size={16} />
                View Details
              </Link>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between items-center pt-2 border-t">
              {/* Swipe Left (Block) */}
              <button
                onClick={() => handleSwipe('left')}
                className="w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors shadow-md"
                disabled={isAnimating}
              >
                <X size={18} />
              </button>

              {/* Action Buttons */}
              <div className="flex space-x-2">
                <button
                  onClick={() => toggleSaved(currentApartment.id)}
                  className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center transition-colors shadow",
                    currentStatus.saved
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  <Bookmark size={14} />
                </button>

                <button
                  onClick={() => toggleFavorites(currentApartment.id)}
                  className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center transition-colors shadow",
                    currentStatus.favorites
                      ? "bg-yellow-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  <Star size={14} />
                </button>

                <button
                  onClick={() => toggleLiked(currentApartment.id)}
                  className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center transition-colors shadow",
                    currentStatus.liked
                      ? "bg-red-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  <Heart size={14} />
                </button>
              </div>

              {/* Swipe Right (Continue) */}
              <button
                onClick={() => handleSwipe('right')}
                className="w-10 h-10 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center transition-colors shadow-md"
                disabled={isAnimating}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

        </div>

        {/* Progress Indicator */}
        <div className="mt-2 text-center text-xs text-gray-400">
          {currentIndex + 1} of {apartments.length}
        </div>
      </div>
    </>
  );
}
