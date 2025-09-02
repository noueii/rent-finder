'use client';

import { useState } from 'react';

interface ImageCarouselProps {
  images: Array<{
    id: string;
    imageUrl: string;
    imageType: string;
    displayOrder: number;
  }>;
  mainImageUrl?: string | null;
  floorPlanUrl?: string | null;
  title: string;
}

export function ImageCarousel({ images, mainImageUrl, floorPlanUrl, title }: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageLoadErrors, setImageLoadErrors] = useState<Set<string>>(new Set());

  // Combine all images into a single array
  const allImages: string[] = [];
  
  // Add main image first if it exists
  if (mainImageUrl) {
    allImages.push(mainImageUrl);
  }
  
  // Add all other images
  images.forEach(img => {
    if (!allImages.includes(img.imageUrl)) {
      allImages.push(img.imageUrl);
    }
  });
  
  // Add floor plan at the end if it exists and isn't already included
  if (floorPlanUrl && !allImages.includes(floorPlanUrl)) {
    allImages.push(floorPlanUrl);
  }

  // Filter out images that failed to load
  const validImages = allImages.filter(url => !imageLoadErrors.has(url));
  
  if (validImages.length === 0) {
    return (
      <div className="w-full h-96 bg-gray-200 flex items-center justify-center rounded-lg">
        <div className="text-center">
          <svg className="w-24 h-24 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-gray-500">No images available</p>
        </div>
      </div>
    );
  }

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? validImages.length - 1 : prevIndex - 1
    );
  };

  const goToNext = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === validImages.length - 1 ? 0 : prevIndex + 1
    );
  };

  const handleImageError = (url: string) => {
    setImageLoadErrors(prev => new Set(prev).add(url));
    // If current image failed, move to next
    if (validImages[currentIndex] === url && validImages.length > 1) {
      goToNext();
    }
  };

  return (
    <div className="relative w-full">
      {/* Main Image Display */}
      <div className="relative h-48 sm:h-64 bg-gray-100 rounded-lg overflow-hidden">
        <img
          src={validImages[currentIndex]}
          alt={`${title} - Image ${currentIndex + 1}`}
          className="w-full h-full object-cover"
          onError={() => handleImageError(validImages[currentIndex])}
        />
        
        {/* Navigation Arrows */}
        {validImages.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full transition-all"
              aria-label="Previous image"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <button
              onClick={goToNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full transition-all"
              aria-label="Next image"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
        
        {/* Image Counter */}
        {validImages.length > 1 && (
          <div className="absolute bottom-4 right-4 bg-black bg-opacity-60 text-white px-3 py-1 rounded-full text-sm">
            {currentIndex + 1} / {validImages.length}
          </div>
        )}
        
        {/* Floor Plan Indicator */}
        {validImages[currentIndex] === floorPlanUrl && (
          <div className="absolute top-4 left-4 bg-blue-600 text-white px-3 py-1 rounded-full text-sm">
            Floor Plan
          </div>
        )}
      </div>
      
      {/* Thumbnail Strip */}
      {validImages.length > 1 && (
        <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
          {validImages.map((url, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`flex-shrink-0 w-12 h-12 rounded overflow-hidden border transition-all ${
                index === currentIndex 
                  ? 'border-blue-600 shadow-sm' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <img
                src={url}
                alt={`Thumbnail ${index + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjRTVFN0VCIi8+CjxwYXRoIGQ9Ik0yOCA0NEwyOS43NTc0IDQyLjI0MjZDMzAuNTM4IDQxLjQ2MiAzMS44MDQxIDQxLjQ2MiAzMi41ODQ3IDQyLjI0MjZMNDAgNTBMNDYuNDY0NSA0My41MzU1QzQ3LjI0NTEgNDIuNzU0OSA0OC41MTEyIDQyLjc1NDkgNDkuMjkxOCA0My41MzU1TDU0IDQ4LjI0MjYiIHN0cm9rZT0iIzlDQTNCNSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPGNpcmNsZSBjeD0iMzQiIGN5PSIzNCIgcj0iMiIgc3Ryb2tlPSIjOUNBM0I1IiBzdHJva2Utd2lkdGg9IjIiLz4KPC9zdmc+';
                }}
              />
              {url === floorPlanUrl && (
                <div className="absolute inset-0 bg-blue-600 bg-opacity-20 flex items-center justify-center">
                  <span className="text-xs text-blue-600 font-semibold">FP</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}