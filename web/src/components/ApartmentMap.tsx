interface ApartmentMapProps {
  address: string;
  stationName?: string;
  walkingMinutes?: number;
}

export function ApartmentMap({ address, stationName, walkingMinutes }: ApartmentMapProps) {
  return (
    <div className="space-y-3">
      {/* Station Info */}
      {stationName && (
        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center text-gray-700">
            <svg className="w-5 h-5 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2c-4.42 0-8 .5-8 4v10c0 1.1.9 2 2 2h1c.55 0 1.05-.22 1.41-.59.36-.36.59-.86.59-1.41v-1h8v1c0 .55.23 1.05.59 1.41.36.37.86.59 1.41.59h1c1.1 0 2-.9 2-2V6c0-3.5-3.58-4-8-4zM7.5 15C6.67 15 6 14.33 6 13.5S6.67 12 7.5 12s1.5.67 1.5 1.5S8.33 15 7.5 15zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM6 10V6h12v4H6z" />
            </svg>
            <span className="font-medium">{stationName} Station</span>
            {walkingMinutes && (
              <span className="ml-2 text-gray-600">• {walkingMinutes} min walk</span>
            )}
          </div>
        </div>
      )}

      {/* Address */}
      <div className="p-3 bg-gray-50 rounded-lg">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center text-gray-700 mb-2">
              <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="font-medium">Address</span>
            </div>
            <p className="text-sm text-gray-700 mb-3">{address}</p>
            
            <div className="flex gap-2">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                View on Map
                <svg className="ml-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              
              {stationName && (
                <a
                  href={`https://www.google.com/maps/dir/${encodeURIComponent(stationName + ' Station, Tokyo')}/${encodeURIComponent(address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                >
                  Directions
                  <svg className="ml-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}