'use client';

import { useState } from 'react';
import { api } from '~/utils/api';

export function TestYoloScrape() {
  const [isOpen, setIsOpen] = useState(false);
  const [testState, setTestState] = useState<'idle' | 'testing' | 'completed' | 'error'>('idle');
  const [testResults, setTestResults] = useState<any>(null);
  const [customUrl, setCustomUrl] = useState('');
  const [propertyId, setPropertyId] = useState('');

  // Get one apartment from home.yolo-japan.com
  const { data: testApartment } = api.testScraping.getYoloTestApartment.useQuery(undefined, {
    enabled: isOpen,
  });

  // Test yolo scraper mutation
  const testYoloScraper = api.testScraping.testYoloScraper.useMutation({
    onSuccess: (data) => {
      setTestResults(data);
      setTestState('completed');
    },
    onError: (error) => {
      console.error('Yolo scraper test failed:', error);
      setTestResults({ error: error.message });
      setTestState('error');
    },
  });

  const runTest = (url: string) => {
    setTestState('testing');
    setTestResults(null);
    testYoloScraper.mutate({ url });
  };

  const buildYoloUrl = (id: string) => {
    return `https://home.yolo-japan.com/en/property/${id}`;
  };

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-yellow-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-yellow-700 transition-colors"
      >
        Test Yolo Scraper
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-96 bg-white border border-gray-200 rounded-lg shadow-xl p-4">
          <h3 className="text-lg font-semibold mb-3">Yolo Japan Scraper Test</h3>

          {testState === 'idle' && (
            <div className="space-y-3">
              {testApartment?.apartment && (
                <div className="text-sm border-b pb-3">
                  <p className="font-medium">Found Yolo Apartment:</p>
                  <p className="text-gray-600 text-xs">{testApartment.apartment.title}</p>
                  <p className="text-xs text-gray-500 truncate">{testApartment.apartment.sourceUrl}</p>
                  <button
                    onClick={() => runTest(testApartment.apartment.sourceUrl!)}
                    className="mt-2 w-full px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                  >
                    Test This Apartment
                  </button>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium">Test with property ID:</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={propertyId}
                    onChange={(e) => setPropertyId(e.target.value)}
                    placeholder="e.g., 1298166"
                    className="flex-1 px-2 py-1 text-sm border rounded"
                  />
                  <button
                    onClick={() => {
                      if (propertyId) {
                        runTest(buildYoloUrl(propertyId));
                      }
                    }}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    disabled={!propertyId}
                  >
                    Test ID
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Or test with full URL:</p>
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://home.yolo-japan.com/en/property/..."
                  className="w-full px-2 py-1 text-sm border rounded"
                />
                <button
                  onClick={() => {
                    if (customUrl && customUrl.includes('home.yolo-japan.com')) {
                      runTest(customUrl);
                    } else {
                      alert('Please enter a valid home.yolo-japan.com URL');
                    }
                  }}
                  className="w-full px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                  disabled={!customUrl}
                >
                  Test Custom URL
                </button>
              </div>

              <div className="text-xs text-gray-500 pt-2 border-t">
                <p>Example property IDs to try:</p>
                <div className="space-y-1">
                  <button onClick={() => { setPropertyId('1298166'); runTest(buildYoloUrl('1298166')); }} className="text-blue-600 hover:underline">1298166</button>
                  <button onClick={() => { setPropertyId('1298165'); runTest(buildYoloUrl('1298165')); }} className="text-blue-600 hover:underline ml-2">1298165</button>
                  <button onClick={() => { setPropertyId('1298167'); runTest(buildYoloUrl('1298167')); }} className="text-blue-600 hover:underline ml-2">1298167</button>
                </div>
              </div>
            </div>
          )}

          {testState === 'testing' && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Testing Yolo scraper...</p>
            </div>
          )}

          {testState === 'completed' && testResults && (
            <div className="space-y-3">
              {testResults.success ? (
                <>
                  <div className="p-3 bg-green-50 rounded">
                    <p className="text-sm font-medium text-green-800">Success!</p>
                    <p className="text-xs text-green-700 mt-1">
                      Found {testResults.imageCount} images
                    </p>
                  </div>

                  {testResults.scrapedImages && testResults.scrapedImages.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Sample Images:</p>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {testResults.scrapedImages.slice(0, 5).map((url: string, idx: number) => (
                          <div key={idx} className="text-xs bg-gray-50 p-1 rounded truncate">
                            {url}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {testResults.floorPlanUrl && (
                    <div className="text-sm">
                      <p className="font-medium">Floor Plan:</p>
                      <p className="text-xs text-gray-600 truncate">{testResults.floorPlanUrl}</p>
                    </div>
                  )}

                  <div className="text-sm">
                    <p className="font-medium">Pattern Test on Sample HTML:</p>
                    <p className="text-xs">
                      {testResults.samplePatternTest.worked ? (
                        <span className="text-green-600">✓ Pattern works on sample</span>
                      ) : (
                        <span className="text-red-600">✗ Pattern failed on sample</span>
                      )}
                    </p>
                  </div>

                  {testResults.debugInfo?.actualHtml && (
                    <div className="text-sm mt-2 p-2 bg-gray-50 rounded">
                      <p className="font-medium text-xs">Actual HTML Debug:</p>
                      <div className="text-xs text-gray-600 mt-1">
                        <p>Gallery items found: {testResults.debugInfo.actualHtml.galleryItemCount || 0}</p>
                        <p>Swiper slides found: {testResults.debugInfo.actualHtml.swiperSlideCount || 0}</p>
                        {testResults.debugInfo.actualHtml.sampleHtml && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-blue-600">View HTML sample</summary>
                            <pre className="text-xs bg-white p-1 mt-1 rounded overflow-x-auto">
                              {testResults.debugInfo.actualHtml.sampleHtml}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-3 bg-red-50 rounded">
                  <p className="text-sm font-medium text-red-800">Test Failed</p>
                  <p className="text-xs text-red-700 mt-1">{testResults.error}</p>
                </div>
              )}

              <button
                onClick={() => {
                  setTestState('idle');
                  setTestResults(null);
                }}
                className="w-full px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
              >
                Reset Test
              </button>
            </div>
          )}

          {testState === 'error' && testResults && (
            <div className="p-3 bg-red-50 rounded">
              <p className="text-sm font-medium text-red-800">Error:</p>
              <p className="text-xs text-red-700 mt-1">{testResults.error}</p>
              <button
                onClick={() => {
                  setTestState('idle');
                  setTestResults(null);
                }}
                className="mt-2 w-full px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}