'use client';

import React, { useState } from 'react';
import { api } from '~/utils/api';

interface UploadStats {
  totalApartments: number;
  imported: number;
  updated: number;
  failed: number;
  unmatchedStations: number;
  bySource?: Record<string, number>;
  failureReasons?: Record<string, number>;
}

export function ApartmentDataUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStats, setUploadStats] = useState<UploadStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [cumulativeStats, setCumulativeStats] = useState<UploadStats>({
    totalApartments: 0,
    imported: 0,
    updated: 0,
    failed: 0,
    unmatchedStations: 0,
    bySource: {},
    failureReasons: {},
  });

  const uploadMutation = api.admin.uploadApartmentData.useMutation({
    onSuccess: (data) => {
      // Don't overwrite, accumulate instead
      setError(null);
    },
    onError: (error) => {
      setError(error.message);
      setUploadStats(null);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Some browsers don't set the correct MIME type for JSON files
      // So we'll accept any file with .json extension
      if (selectedFile.type === 'application/json' || selectedFile.name.endsWith('.json')) {
        setFile(selectedFile);
        setError(null);
        setUploadStats(null);
        setCumulativeStats({
          totalApartments: 0,
          imported: 0,
          updated: 0,
          failed: 0,
          unmatchedStations: 0,
          bySource: {},
          failureReasons: {},
        });
        console.log('File selected:', selectedFile.name, selectedFile.type);
      } else {
        setFile(null);
        setError(`Please select a valid JSON file. Selected file type: ${selectedFile.type}`);
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setIsUploading(true);
    setProgress(0);
    
    // Reset cumulative stats
    const newCumulativeStats: UploadStats = {
      totalApartments: 0,
      imported: 0,
      updated: 0,
      failed: 0,
      unmatchedStations: 0,
      bySource: {},
      failureReasons: {},
    };

    try {
      // Read file content
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate data structure
      if (!data.apartments || !Array.isArray(data.apartments)) {
        throw new Error('Invalid JSON structure. Expected unified apartment data.');
      }

      // Set total apartments count
      newCumulativeStats.totalApartments = data.apartments.length;

      // Process in batches to show progress
      const batchSize = 50;
      const totalBatches = Math.ceil(data.apartments.length / batchSize);
      let importBatchId: string | undefined;
      
      for (let i = 0; i < totalBatches; i++) {
        const start = i * batchSize;
        const end = Math.min(start + batchSize, data.apartments.length);
        const batch = data.apartments.slice(start, end);

        const result = await uploadMutation.mutateAsync({
          apartments: batch,
          metadata: i === 0 ? data.metadata : { ...data.metadata, importBatchId },
          isFirstBatch: i === 0,
          isLastBatch: i === totalBatches - 1,
        });
        
        // Store importBatchId from first batch
        if (i === 0) {
          importBatchId = result.importBatchId;
        }

        // Accumulate stats from each batch
        newCumulativeStats.imported += result.stats.imported;
        newCumulativeStats.updated += result.stats.updated;
        newCumulativeStats.failed += result.stats.failed;
        newCumulativeStats.unmatchedStations += result.stats.unmatchedStations;
        
        console.log(`Batch ${i + 1}/${totalBatches} complete:`, {
          batchStats: result.stats,
          cumulativeStats: newCumulativeStats
        });
        
        // Merge bySource stats
        if (result.stats.bySource) {
          Object.entries(result.stats.bySource).forEach(([source, count]) => {
            newCumulativeStats.bySource![source] = (newCumulativeStats.bySource![source] || 0) + count;
          });
        }
        
        // Merge failureReasons
        if (result.stats.failureReasons) {
          Object.entries(result.stats.failureReasons).forEach(([reason, count]) => {
            newCumulativeStats.failureReasons![reason] = (newCumulativeStats.failureReasons![reason] || 0) + count;
          });
        }

        setCumulativeStats({ ...newCumulativeStats });
        setProgress(((i + 1) / totalBatches) * 100);
      }
      
      // Set final stats
      setUploadStats(newCumulativeStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-4">Import Apartment Data</h2>
      
      <div className="space-y-4">
        {/* File Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Unified Apartment JSON File
          </label>
          <input
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
            disabled={isUploading}
          />
          {file && (
            <p className="mt-2 text-sm text-gray-600">
              Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={!file || isUploading}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            !file || isUploading
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isUploading ? 'Uploading...' : 'Upload Data'}
        </button>
        
        {/* Debug info */}
        {!file && (
          <p className="text-sm text-gray-500">
            Please select a JSON file to enable the upload button
          </p>
        )}

        {/* Progress Bar */}
        {isUploading && (
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Progress Stats During Upload */}
        {isUploading && cumulativeStats.totalApartments > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-800 mb-2">Processing...</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Total to Process: {cumulativeStats.totalApartments}</div>
              <div>Imported: {cumulativeStats.imported}</div>
              <div>Updated: {cumulativeStats.updated}</div>
              <div>Failed: {cumulativeStats.failed}</div>
            </div>
          </div>
        )}

        {/* Success Stats */}
        {uploadStats && !isUploading && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-800 mb-2">Upload Complete!</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Total Apartments: {uploadStats.totalApartments}</div>
              <div>Imported: {uploadStats.imported}</div>
              <div>Updated: {uploadStats.updated}</div>
              <div>Failed: {uploadStats.failed}</div>
              {uploadStats.unmatchedStations > 0 && (
                <div className="col-span-2 text-amber-600">
                  ⚠️ {uploadStats.unmatchedStations} apartments have unmatched stations
                </div>
              )}
            </div>
            
            {/* Source breakdown */}
            {uploadStats.bySource && Object.keys(uploadStats.bySource).length > 0 && (
              <div className="mt-3 pt-3 border-t border-green-200">
                <h4 className="font-semibold text-green-800 mb-1">By Source:</h4>
                <div className="text-sm space-y-1">
                  {Object.entries(uploadStats.bySource).map(([source, count]) => (
                    <div key={source}>{source}: {count}</div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Failure reasons */}
            {uploadStats.failureReasons && Object.keys(uploadStats.failureReasons).length > 0 && (
              <div className="mt-3 pt-3 border-t border-green-200">
                <h4 className="font-semibold text-red-800 mb-1">Failure Reasons:</h4>
                <div className="text-sm space-y-1 text-red-700">
                  {Object.entries(uploadStats.failureReasons).map(([reason, count]) => (
                    <div key={reason}>{reason}: {count}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 text-sm text-gray-600">
          <h4 className="font-semibold mb-2">Instructions:</h4>
          <ol className="list-decimal list-inside space-y-1">
            <li>Run the apartment dictionary builder to generate unified JSON</li>
            <li>Select the generated <code>unified_apartments_[timestamp].json</code> file</li>
            <li>Click "Upload Data" to import apartments into the database</li>
            <li>The system will update existing apartments and add new ones</li>
          </ol>
        </div>
      </div>
    </div>
  );
}