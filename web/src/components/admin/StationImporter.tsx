'use client';

import { useState } from 'react';
import { api } from '~/utils/api';

export function StationImporter() {
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const importStations = api.admin.importStationsFromGraph.useMutation({
    onMutate: () => {
      setIsImporting(true);
      setError(null);
      setImportResult(null);
    },
    onSuccess: (data) => {
      setIsImporting(false);
      setImportResult(data);
    },
    onError: (error) => {
      setIsImporting(false);
      setError(error.message);
    },
  });

  const handleImport = () => {
    importStations.mutate();
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Station Import</h2>
      
      <div className="mb-6">
        <p className="text-gray-600 mb-4">
          Import all stations from the Tokyo transit graph into the database.
          This will update existing stations and add any new ones.
        </p>
        
        <button
          onClick={handleImport}
          disabled={isImporting}
          className={`px-4 py-2 rounded font-medium transition-colors ${
            isImporting
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isImporting ? 'Importing...' : 'Import Stations from Transit Graph'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded mb-4">
          <p className="font-semibold">Import failed:</p>
          <p>{error}</p>
        </div>
      )}

      {importResult && (
        <div className="bg-green-50 border border-green-300 text-green-700 px-4 py-3 rounded">
          <p className="font-semibold mb-2">Import completed successfully!</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Imported: {importResult.imported} new stations</li>
            <li>Updated: {importResult.updated} existing stations</li>
            <li>Failed: {importResult.failed} stations</li>
            <li>Total stations in database: {importResult.totalStations}</li>
          </ul>
          
          {importResult.errors && importResult.errors.length > 0 && (
            <div className="mt-4">
              <p className="font-semibold">Errors (first 10):</p>
              <ul className="mt-2 space-y-1 text-sm">
                {importResult.errors.map((err: any, idx: number) => (
                  <li key={idx} className="text-red-600">
                    Station {err.stationId}: {err.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}