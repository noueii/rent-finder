'use client';

import { useState } from 'react';
import { cn } from '~/utils/cn';
import { 
  ChevronLeftIcon, 
  ChevronRightIcon, 
  XMarkIcon,
  PhotoIcon
} from '@heroicons/react/24/outline';

interface ApartmentImageGalleryProps {
  images: string[];
  title: string;
  floorPlanUrl?: string;
  className?: string;
}

export function ApartmentImageGallery({ 
  images, 
  title, 
  floorPlanUrl, 
  className 
}: ApartmentImageGalleryProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Combine regular images with floor plan
  const allImages = [...images];
  if (floorPlanUrl) {
    allImages.push(floorPlanUrl);
  }

  const hasImages = allImages.length > 0;

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setIsLightboxOpen(true);
  };

  const closeLightbox = () => {
    setIsLightboxOpen(false);
  };

  const nextLightboxImage = () => {
    setLightboxIndex((prev) => (prev + 1) % allImages.length);
  };

  const prevLightboxImage = () => {
    setLightboxIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
  };

  if (!hasImages) {
    return (
      <div className={cn("bg-gray-100 rounded-lg h-96 flex items-center justify-center", className)}>
        <div className="text-center text-gray-500">
          <PhotoIcon className="h-12 w-12 mx-auto mb-2" />
          <p>No images available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Main image */}
      <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
        <img
          src={allImages[currentImageIndex]}
          alt={`${title} - Image ${currentImageIndex + 1}`}
          className="w-full h-full object-cover cursor-pointer"
          onClick={() => openLightbox(currentImageIndex)}
        />
        
        {/* Navigation arrows */}
        {allImages.length > 1 && (
          <>
            <button
              onClick={prevImage}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-opacity"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <button
              onClick={nextImage}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-opacity"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </>
        )}
        
        {/* Image counter */}
        <div className="absolute bottom-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
          {currentImageIndex + 1} / {allImages.length}
        </div>
        
        {/* Floor plan badge */}
        {floorPlanUrl && currentImageIndex === allImages.length - 1 && (
          <div className="absolute top-4 left-4 bg-blue-500 text-white px-3 py-1 rounded-full text-sm">
            Floor Plan
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {allImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {allImages.map((image, index) => (
            <button
              key={index}
              onClick={() => setCurrentImageIndex(index)}
              className={cn(
                "flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all",
                index === currentImageIndex 
                  ? "border-primary-500 ring-2 ring-primary-200" 
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              <img
                src={image}
                alt={`${title} - Thumbnail ${index + 1}`}
                className="w-full h-full object-cover"
              />
              {/* Floor plan indicator */}
              {floorPlanUrl && index === allImages.length - 1 && (
                <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center">
                  <span className="text-xs text-blue-600 font-medium">Plan</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {isLightboxOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
          <div className="relative max-w-4xl max-h-full p-4">
            <img
              src={allImages[lightboxIndex]}
              alt={`${title} - Image ${lightboxIndex + 1}`}
              className="max-w-full max-h-full object-contain"
            />
            
            {/* Close button */}
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 text-white p-2 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
            
            {/* Navigation */}
            {allImages.length > 1 && (
              <>
                <button
                  onClick={prevLightboxImage}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white p-2 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors"
                >
                  <ChevronLeftIcon className="h-8 w-8" />
                </button>
                <button
                  onClick={nextLightboxImage}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white p-2 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors"
                >
                  <ChevronRightIcon className="h-8 w-8" />
                </button>
              </>
            )}
            
            {/* Counter */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white bg-black bg-opacity-50 px-4 py-2 rounded-full">
              {lightboxIndex + 1} / {allImages.length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}