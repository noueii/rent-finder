'use client';

import { useState } from 'react';
import { api } from '~/utils/api';

interface ImageScrapeButtonProps {
  filters: {
    targetStation?: string;
    maxCommuteTime?: number;
    minPrice?: number;
    maxPrice?: number;
    minSize?: number;
    maxSize?: number;
    layouts?: string[];
    maxBuildingAge?: number;
    maxWalkingMinutes?: number;
    excludeFromLists?: string[];
  };
  apartmentIds?: string[];
  className?: string;
  onScrapingComplete?: (results: any) => void;
}

export function ImageScrapeButton({ 
  filters, 
  apartmentIds, 
  className = '',
  onScrapingComplete 
}: ImageScrapeButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [scrapingState, setScrapingState] = useState<'idle' | 'checking' | 'scraping' | 'completed' | 'error'>('idle');
  const [results, setResults] = useState<any>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // Query to check how many apartments need images
  const { data: needingImagesData, refetch: checkNeedingImages } = api.scraping.getApartmentsNeedingImages.useQuery(
    {
      targetStation: filters.targetStation,
      maxCommuteTime: filters.maxCommuteTime,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      minSize: filters.minSize,
      maxSize: filters.maxSize,
      layouts: filters.layouts,
      maxBuildingAge: filters.maxBuildingAge,
      maxWalkingMinutes: filters.maxWalkingMinutes,
      excludeFromLists: filters.excludeFromLists,
      // Don't send limit to get exact count
    },
    {
      enabled: false, // Only run when manually triggered
    }
  );

  // Mutation for scraping images by filters
  const scrapeImagesByFilters = api.scraping.scrapeImagesForFilters.useMutation({
    onSuccess: (data) => {
      setResults(data);
      setScrapingState('completed');
      onScrapingComplete?.(data);
    },
    onError: (error) => {
      console.error('Image scraping failed:', error);
      setScrapingState('error');
    },
  });

  // Mutation for scraping specific apartment images
  const scrapeSpecificImages = api.scraping.scrapeImages.useMutation({
    onSuccess: (data) => {
      setResults(data);
      setScrapingState('completed');
      onScrapingComplete?.(data);
    },
    onError: (error) => {
      console.error('Image scraping failed:', error);
      setScrapingState('error');
    },
  });

  const handleCheckImages = async () => {
    setScrapingState('checking');
    await checkNeedingImages();
    setScrapingState('idle');
  };

  const handleStartScraping = () => {
    setScrapingState('scraping');
    
    if (apartmentIds && apartmentIds.length > 0) {
      // Scrape specific apartments
      scrapeSpecificImages.mutate({
        apartmentIds: apartmentIds.slice(0, 20), // Limit to 20 at once
        maxConcurrent: 3,
      });
    } else {
      // Scrape by filters
      scrapeImagesByFilters.mutate({
        targetStation: filters.targetStation,
        maxCommuteTime: filters.maxCommuteTime,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        minSize: filters.minSize,
        maxSize: filters.maxSize,
        layouts: filters.layouts,
        maxBuildingAge: filters.maxBuildingAge,
        maxWalkingMinutes: filters.maxWalkingMinutes,
        excludeFromLists: filters.excludeFromLists,
        // Don't send limit to scrape all apartments
        maxConcurrent: 5, // Increased concurrency for faster processing
      });
    }
  };

  const resetState = () => {
    setScrapingState('idle');
    setResults(null);
    setIsOpen(false);
  };

  const getButtonText = () => {
    switch (scrapingState) {
      case 'checking':
        return 'Checking...';
      case 'scraping':
        return 'Scraping Images...';
      case 'completed':
        return 'Scraping Complete';
      case 'error':
        return 'Scraping Failed';
      default:
        return 'Get Images';
    }
  };

  const getButtonIcon = () => {
    switch (scrapingState) {
      case 'checking':
      case 'scraping':
        return (
          <svg className="animate-spin w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      case 'completed':
        return (
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={scrapingState === 'checking' || scrapingState === 'scraping'}
        className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
          scrapingState === 'completed'
            ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
            : scrapingState === 'error'
            ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
            : scrapingState === 'scraping' || scrapingState === 'checking'
            ? 'bg-blue-50 border-blue-200 text-blue-700 cursor-not-allowed'
            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
        } ${className}`}
      >
        {getButtonIcon()}
        {getButtonText()}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
            <div className="p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Image Scraping
              </h3>

              {scrapingState === 'idle' && (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600">
                    {apartmentIds ? (
                      <p>Scrape images for {apartmentIds.length} selected apartments</p>
                    ) : (
                      <p>Scrape images for apartments matching your current filters</p>
                    )}
                  </div>

                  <button
                    onClick={handleCheckImages}
                    className="w-full px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
                  >
                    Check How Many Need Images
                  </button>

                  {needingImagesData && (
                    <div className="p-3 bg-gray-50 rounded text-sm">
                      <p className="font-medium">{needingImagesData.count} apartments need images</p>
                      {needingImagesData.count > 0 && (
                        <>
                          <p className="text-xs text-gray-600 mt-1">
                            This will process all {needingImagesData.count} apartments in batches.
                            {needingImagesData.count > 100 && ' This may take 10-30 minutes.'}
                          </p>
                          <button
                            onClick={handleStartScraping}
                            className="mt-2 w-full px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                          >
                            Start Scraping All {needingImagesData.count} Apartments
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {scrapingState === 'checking' && (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">Checking apartments...</p>
                </div>
              )}

              {scrapingState === 'scraping' && (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">Scraping images from original listings...</p>
                  <p className="text-xs text-gray-500 mt-1">This may take several minutes for large batches</p>
                  {progress.total > 0 && (
                    <div className="mt-3">
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                          className="bg-green-600 h-2.5 rounded-full transition-all duration-300"
                          style={{ width: `${(progress.current / progress.total) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        {progress.current} / {progress.total} apartments processed
                      </p>
                    </div>
                  )}
                </div>
              )}

              {scrapingState === 'completed' && results && (
                <div className="space-y-3">
                  <div className="p-3 bg-green-50 rounded">
                    <p className="text-sm font-medium text-green-800">Scraping Completed!</p>
                    <div className="text-xs text-green-700 mt-1 space-y-1">
                      <p>• Total processed: {results.total}</p>
                      <p>• Successful: {results.successful}</p>
                      <p>• Failed: {results.failed}</p>
                      {results.summary && (
                        <>
                          <p>• Images found: {results.summary.imagesScraped}</p>
                          <p>• Main images: {results.summary.mainImagesFound}</p>
                          {results.summary.additionalImagesFound > 0 && (
                            <p>• Additional images: {results.summary.additionalImagesFound}</p>
                          )}
                          <p>• Floor plans: {results.summary.floorPlansFound}</p>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={resetState}
                    className="w-full px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                  >
                    Close
                  </button>
                </div>
              )}

              {scrapingState === 'error' && (
                <div className="space-y-3">
                  <div className="p-3 bg-red-50 rounded">
                    <p className="text-sm font-medium text-red-800">Scraping Failed</p>
                    <p className="text-xs text-red-700 mt-1">Please try again later</p>
                  </div>
                  <button
                    onClick={resetState}
                    className="w-full px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}