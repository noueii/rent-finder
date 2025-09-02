/**
 * Admin API endpoint for geocoding apartments
 * 
 * This endpoint allows triggering geocoding for apartments that don't have coordinates.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '~/server/db';
import { ApartmentGeocoder } from '~/lib/geocoding/apartment-geocoder';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      limit = 10, 
      sourceSite,
      apartmentId 
    } = body;

    const geocoder = new ApartmentGeocoder(db);

    // Single apartment geocoding
    if (apartmentId) {
      const result = await geocoder.geocodeApartment(apartmentId);
      return NextResponse.json({
        success: true,
        result,
      });
    }

    // Batch geocoding
    const results = sourceSite
      ? await geocoder.geocodeBySource(sourceSite, limit)
      : await geocoder.geocodeUngeocoded(limit);

    const stats = {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    };

    return NextResponse.json({
      success: true,
      stats,
      results,
    });
  } catch (error) {
    console.error('[Geocoding API] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const geocoder = new ApartmentGeocoder(db);
    const stats = await geocoder.getStats();

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('[Geocoding API] Error getting stats:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}