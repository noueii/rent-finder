'use client';

import React, { useState } from 'react';
import { api } from '~/utils/api';

export function DangerZone() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<{ count: number } | null>(null);
  const [cleanupResult, setCleanupResult] = useState<{ count: number } | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const deleteAllApartments = api.admin.deleteAllApartments.useMutation({
    onSuccess: (data) => {
      setDeleteResult({ count: data.deletedCount });
      setShowConfirm(false);
      setIsDeleting(false);
    },
    onError: (error) => {
      alert(`Error deleting apartments: ${error.message}`);
      setIsDeleting(false);
    },
  });

  const cleanupOrphanedMappings = api.admin.cleanupOrphanedMappings.useMutation({
    onSuccess: (data) => {
      setCleanupResult({ count: data.deletedCount });
      setIsCleaning(false);
    },
    onError: (error) => {
      alert(`Error cleaning up mappings: ${error.message}`);
      setIsCleaning(false);
    },
  });

  const syncStationMappings = api.admin.syncStationMappings.useMutation({
    onSuccess: (data) => {
      setSyncResult(data);
      setIsSyncing(false);
    },
    onError: (error) => {
      alert(`Error syncing station mappings: ${error.message}`);
      setIsSyncing(false);
    },
  });

  const handleDeleteClick = () => {
    setShowConfirm(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    deleteAllApartments.mutate();
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 border-2 border-red-200">
      <h2 className="text-xl font-bold mb-4 text-red-600">Danger Zone</h2>
      
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold text-gray-700 mb-2">Delete All Apartments</h3>
          <p className="text-sm text-gray-600 mb-3">
            This will permanently delete all apartments, their station relationships, search results, and import logs from the database. 
            This action cannot be undone.
          </p>
          
          {!showConfirm && !deleteResult && (
            <button
              onClick={handleDeleteClick}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              Delete All Apartments
            </button>
          )}
          
          {showConfirm && (
            <div className="bg-red-50 border border-red-300 rounded-lg p-4">
              <p className="text-red-800 font-semibold mb-3">
                Are you absolutely sure? This will delete ALL apartment data!
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    isDeleting
                      ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  {isDeleting ? 'Deleting...' : 'Yes, Delete Everything'}
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={isDeleting}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          
          {deleteResult && (
            <div className="bg-green-50 border border-green-300 rounded-lg p-4">
              <p className="text-green-800">
                ✅ Successfully deleted {deleteResult.count} apartments and all related data.
              </p>
              <button
                onClick={() => setDeleteResult(null)}
                className="mt-2 text-sm text-green-600 hover:text-green-800 underline"
              >
                Close
              </button>
            </div>
          )}
        </div>
        
        {/* Cleanup Orphaned Station Mappings */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="font-semibold text-gray-700 mb-2">Cleanup Orphaned Station Mappings</h3>
          <p className="text-sm text-gray-600 mb-3">
            Remove station mappings that have no associated apartments. This helps clean up mappings 
            that were created but no longer have any apartments referencing them.
          </p>
          
          {cleanupResult && (
            <div className="bg-green-50 border border-green-300 rounded-lg p-4 mb-3">
              <p className="text-green-800">
                ✅ Successfully removed {cleanupResult.count} orphaned station mappings.
              </p>
              <button
                onClick={() => setCleanupResult(null)}
                className="mt-2 text-sm text-green-600 hover:text-green-800 underline"
              >
                Close
              </button>
            </div>
          )}
          
          <button
            onClick={() => {
              setIsCleaning(true);
              cleanupOrphanedMappings.mutate();
            }}
            disabled={isCleaning || cleanupOrphanedMappings.isLoading}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isCleaning || cleanupOrphanedMappings.isLoading
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                : 'bg-orange-600 text-white hover:bg-orange-700'
            }`}
          >
            {isCleaning || cleanupOrphanedMappings.isLoading ? 'Cleaning...' : 'Cleanup Orphaned Mappings'}
          </button>
        </div>
        
        {/* Sync Station Mappings */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="font-semibold text-gray-700 mb-2">Sync Station Mappings</h3>
          <p className="text-sm text-gray-600 mb-3">
            Fix any out-of-sync states by linking apartments to stations that have already been mapped. 
            This will find all mapped stations and ensure their apartments are properly linked.
          </p>
          
          {syncResult && (
            <div className="bg-blue-50 border border-blue-300 rounded-lg p-4 mb-3">
              <div className="text-blue-800">
                <div className="font-medium mb-2">✅ Sync Results:</div>
                <div className="text-sm space-y-1">
                  <div>• {syncResult.summary.mappedStationsProcessed} mapped stations processed</div>
                  <div>• {syncResult.summary.apartmentsLinked} apartments newly linked</div>
                  <div>• {syncResult.summary.apartmentsSkipped} apartments already linked</div>
                  {syncResult.summary.errorsEncountered > 0 && (
                    <div className="text-red-600">• {syncResult.summary.errorsEncountered} errors encountered</div>
                  )}
                </div>
                
                {syncResult.results.length > 0 && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-800">
                      Show details ({syncResult.results.length} stations)
                    </summary>
                    <div className="mt-2 max-h-40 overflow-y-auto">
                      {syncResult.results.map((result: any, index: number) => (
                        <div key={index} className="text-xs py-1 border-b border-blue-200">
                          <span className="font-medium">{result.stationName}</span>
                          {result.status === 'processed' && (
                            <span className="text-green-600 ml-2">
                              → {result.mappedTo} ({result.apartmentsLinked} linked, {result.apartmentsSkipped} skipped)
                            </span>
                          )}
                          {result.status === 'error' && (
                            <span className="text-red-600 ml-2">Error: {result.error}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
              <button
                onClick={() => setSyncResult(null)}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Close
              </button>
            </div>
          )}
          
          <button
            onClick={() => {
              setIsSyncing(true);
              syncStationMappings.mutate();
            }}
            disabled={isSyncing}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isSyncing
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isSyncing ? 'Syncing...' : 'Sync Station Mappings'}
          </button>
        </div>
      </div>
    </div>
  );
}