'use client';

import { useState } from 'react';
import { api } from '~/utils/api';

export function TestImageScrape() {
  const [isOpen, setIsOpen] = useState(false);
  const [testState, setTestState] = useState<'idle' | 'testing' | 'completed' | 'error'>('idle');
  const [testResults, setTestResults] = useState<any>(null);

  // Get one apartment with sourceUrl but no mainImageUrl
  const { data: testApartment } = api.testScraping.getTestApartment.useQuery(undefined, {
    enabled: isOpen,
  });

  // Test scraping mutation
  const testScrape = api.testScraping.testScrapeOne.useMutation({
    onSuccess: (data) => {
      setTestResults(data);
      setTestState('completed');
    },
    onError: (error) => {
      console.error('Test scraping failed:', error);
      setTestResults({ error: error.message });
      setTestState('error');
    },
  });

  // Test direct extraction
  const testExtraction = api.testScraping.testImageExtraction.useMutation({
    onSuccess: (data) => {
      setTestResults(data);
      setTestState('completed');
    },
    onError: (error) => {
      console.error('Test extraction failed:', error);
      setTestResults({ error: error.message });
      setTestState('error');
    },
  });

  const runTest = () => {
    if (!testApartment?.apartment) {
      alert('No test apartment found');
      return;
    }

    setTestState('testing');
    testScrape.mutate({
      apartmentId: testApartment.apartment.id,
    });
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-purple-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-purple-700 transition-colors"
      >
        Test Scraping
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-96 bg-white border border-gray-200 rounded-lg shadow-xl p-4">
          <h3 className="text-lg font-semibold mb-3">Image Scraping Test</h3>

          {testState === 'idle' && testApartment && (
            <div className="space-y-3">
              <div className="text-sm">
                <p className="font-medium">Test Apartment:</p>
                <p className="text-gray-600">{testApartment.apartment.title}</p>
                <p className="text-xs text-gray-500">{testApartment.apartment.sourceUrl}</p>
                <p className="text-xs text-gray-500">Source: {testApartment.apartment.sourceSite}</p>
              </div>
              <div className="space-y-2">
                <button
                  onClick={runTest}
                  className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Run Full Scrape Test
                </button>
                <button
                  onClick={() => {
                    if (testApartment?.apartment?.sourceUrl) {
                      setTestState('testing');
                      testExtraction.mutate({
                        url: testApartment.apartment.sourceUrl,
                        sourceSite: testApartment.apartment.sourceSite || 'unknown',
                      });
                    }
                  }}
                  className="w-full px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Test Direct Extraction
                </button>
              </div>
            </div>
          )}

          {testState === 'testing' && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Testing image scraping...</p>
            </div>
          )}

          {testState === 'completed' && testResults && (
            <div className="space-y-3">
              <div className="p-3 bg-green-50 rounded">
                <p className="text-sm font-medium text-green-800">Test Results:</p>
                <pre className="text-xs text-gray-700 mt-2 whitespace-pre-wrap">
                  {JSON.stringify(testResults, null, 2)}
                </pre>
              </div>
              <div className="text-sm">
                <p className="font-medium">Database Check:</p>
                {testResults.dbCheck && (
                  <div className="text-xs text-gray-600 mt-1">
                    <p>Main Image: {testResults.dbCheck.mainImageUrl || 'null'}</p>
                    <p>Floor Plan: {testResults.dbCheck.floorPlanUrl || 'null'}</p>
                    <p>Images in DB: {testResults.dbCheck.imageCount}</p>
                  </div>
                )}
              </div>
              {testResults.debugInfo && (
                <div className="text-sm mt-3">
                  <p className="font-medium">Debug Info:</p>
                  <div className="text-xs text-gray-600 mt-1 space-y-1">
                    <p>HTML Length: {testResults.debugInfo.htmlLength}</p>
                    <p>Response Status: {testResults.debugInfo.responseStatus}</p>
                    <p>Swiper Slides: {testResults.debugInfo.swiperSlideCount}</p>
                    <p>Total Images in HTML: {testResults.debugInfo.totalImagesInHtml}</p>
                    <p>Images in &lt;a&gt; tags: {testResults.debugInfo.imagesInLinks}</p>
                    <p>Images in Scripts: {testResults.debugInfo.imagesInScripts}</p>
                    {testResults.debugInfo.swiperSample && (
                      <div className="mt-2">
                        <p className="font-medium">Swiper Sample:</p>
                        <pre className="text-xs bg-gray-100 p-1 rounded overflow-x-auto">
                          {testResults.debugInfo.swiperSample}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {testState === 'error' && testResults && (
            <div className="p-3 bg-red-50 rounded">
              <p className="text-sm font-medium text-red-800">Test Failed:</p>
              <p className="text-xs text-red-700 mt-1">{testResults.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}