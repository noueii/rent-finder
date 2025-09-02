'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { api } from '~/utils/api';
import Link from 'next/link';

export default function AdminApartmentDetailPage() {
  const params = useParams();
  const apartmentId = params.id as string;

  const { data: apartment, isLoading, error } = api.admin.getApartment.useQuery({
    id: apartmentId,
  });

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !apartment) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-4">Apartment Not Found</h1>
          <p className="text-gray-600 mb-4">The apartment you're looking for doesn't exist.</p>
          <Link href="/admin" className="text-blue-600 hover:text-blue-800 underline">
            Back to Admin
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">
            {apartment.buildingName} {apartment.unitNumber && `- ${apartment.unitNumber}`}
          </h1>
          <p className="text-gray-600">{apartment.title}</p>
        </div>

        {/* Main Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Basic Information */}
          <div className="space-y-4">
            <section>
              <h2 className="text-lg font-semibold mb-2">Basic Information</h2>
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">Layout:</span> {apartment.layout}</div>
                <div><span className="font-medium">Size:</span> {apartment.size}m² ({apartment.sizeJo?.toFixed(1)}畳)</div>
                <div><span className="font-medium">Floor:</span> {apartment.floor || 'N/A'}</div>
                <div><span className="font-medium">Building Type:</span> {apartment.buildingType || 'N/A'}</div>
                <div><span className="font-medium">Built Year:</span> {apartment.buildYear || 'N/A'}</div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">Pricing</h2>
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">Monthly Rent:</span> ¥{apartment.rentMonthly.toLocaleString()}</div>
                {apartment.managementFee !== null && (
                  <div><span className="font-medium">Management Fee:</span> ¥{apartment.managementFee.toLocaleString()}</div>
                )}
                {apartment.deposit !== null && (
                  <div><span className="font-medium">Deposit:</span> {apartment.deposit} months</div>
                )}
                {apartment.keyMoney !== null && (
                  <div><span className="font-medium">Key Money:</span> {apartment.keyMoney} months</div>
                )}
              </div>
            </section>
          </div>

          {/* Location & Stations */}
          <div className="space-y-4">
            <section>
              <h2 className="text-lg font-semibold mb-2">Location</h2>
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">Address:</span> {apartment.address}</div>
                <div><span className="font-medium">Area:</span> {apartment.area || 'N/A'}</div>
                <div><span className="font-medium">Ward:</span> {apartment.ward || 'N/A'}</div>
                <div><span className="font-medium">City:</span> {apartment.city}</div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">Station Access</h2>
              {apartment.stations && apartment.stations.length > 0 ? (
                <div className="space-y-2">
                  {apartment.stations.map((as) => (
                    <div key={as.id} className="text-sm">
                      <span className="font-medium">
                        {as.station ? as.station.name : as.originalStationName}
                      </span>
                      <span className="text-gray-600"> - {as.walkingMinutes} min walk</span>
                      {as.isPrimary && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Primary</span>}
                      {!as.station && <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-1 rounded">Unmapped</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-red-600">
                  ⚠️ No stations mapped - this apartment needs station mapping
                </div>
              )}
            </section>
          </div>
        </div>

        {/* Features */}
        {apartment.features && apartment.features.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Features & Amenities</h2>
            <div className="flex flex-wrap gap-2">
              {apartment.features.map((feature: string, index: number) => (
                <span key={index} className="px-3 py-1 bg-gray-100 text-sm rounded-full">
                  {feature}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Images */}
        {apartment.imageUrls && apartment.imageUrls.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Images</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {apartment.imageUrls.slice(0, 6).map((url: string, index: number) => (
                <div key={index} className="aspect-w-4 aspect-h-3">
                  <img
                    src={url}
                    alt={`Apartment image ${index + 1}`}
                    className="object-cover rounded-lg w-full h-48"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'https://via.placeholder.com/400x300?text=Image+Not+Available';
                    }}
                  />
                </div>
              ))}
            </div>
            {apartment.floorPlanUrl && (
              <div className="mt-4">
                <h3 className="font-medium mb-2">Floor Plan</h3>
                <img
                  src={apartment.floorPlanUrl}
                  alt="Floor plan"
                  className="max-w-md rounded-lg"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'https://via.placeholder.com/400x300?text=Floor+Plan+Not+Available';
                  }}
                />
              </div>
            )}
          </section>
        )}

        {/* Source Information */}
        <section className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Source Information</h2>
          <div className="space-y-2 text-sm">
            <div><span className="font-medium">Source:</span> {apartment.source || 'N/A'}</div>
            <div><span className="font-medium">Source ID:</span> {apartment.sourceId || 'N/A'}</div>
            <div><span className="font-medium">External ID:</span> {apartment.externalId || 'N/A'}</div>
            <div>
              <span className="font-medium">Original Listing:</span>{' '}
              <a href={apartment.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">
                View on {apartment.sourceSite}
              </a>
            </div>
            <div><span className="font-medium">Scraped At:</span> {new Date(apartment.scrapedAt).toLocaleString()}</div>
          </div>
        </section>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Link
            href="/admin"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Back to Admin
          </Link>
          {(!apartment.stations || apartment.stations.length === 0 || apartment.stations.some(s => !s.station)) && (
            <Link
              href="/admin/map-stations"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Map Stations for This Building
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}