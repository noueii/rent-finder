#!/usr/bin/env tsx

/**
 * Test script for coordinate format fix
 * Usage: npx tsx scripts/test-coordinate-fix.ts
 */

import { getOTPService } from '../src/lib/transit/otp-service';
import { getTransitService } from '../src/lib/transit';

async function testCoordinateFix() {
  console.log('Testing Coordinate Format Fix...\n');

  try {
    // Initialize services
    const otpService = await getOTPService();
    const transitService = await getTransitService();

    // Test 1: Check station coordinate formats
    console.log('1. Checking station coordinate formats:');
    const allStations = transitService.getAllStations();
    console.log(`   Total stations: ${allStations.length}`);
    
    let arrayFormat = 0;
    let objectFormat = 0;
    let invalidFormat = 0;
    
    // Sample a few stations to show formats
    const sampleStations = allStations.slice(0, 5);
    
    allStations.forEach(station => {
      if (Array.isArray(station.coordinates)) {
        arrayFormat++;
      } else if (station.coordinates && typeof station.coordinates === 'object' && 'lat' in station.coordinates) {
        objectFormat++;
      } else {
        invalidFormat++;
      }
    });
    
    console.log(`   - Array format [lon, lat]: ${arrayFormat}`);
    console.log(`   - Object format {lat, lon}: ${objectFormat}`);
    console.log(`   - Invalid format: ${invalidFormat}`);
    
    console.log('\n   Sample station coordinates:');
    sampleStations.forEach(station => {
      console.log(`   - ${station.name}: ${JSON.stringify(station.coordinates)}`);
    });

    // Test 2: Test a specific apartment-to-station route
    console.log('\n2. Testing apartment-to-station route calculation:');
    
    // Apartment coordinates from the error log
    const apartmentLat = 35.7021654;
    const apartmentLon = 139.5611195;
    
    // Workplace station coordinates from the error log
    const workplaceLat = 35.6793616;
    const workplaceLon = 139.6153471;
    
    console.log(`   Apartment: (${apartmentLat}, ${apartmentLon})`);
    console.log(`   Workplace: (${workplaceLat}, ${workplaceLon})`);
    
    // Test the route calculation
    console.log('\n3. Calculating route with OTP service:');
    const route = await otpService.getRoute(
      apartmentLat,
      apartmentLon,
      workplaceLat,
      workplaceLon,
      70 // max 70 minutes as in the log
    );
    
    if (route) {
      console.log('   ✅ Route found!');
      console.log(`   - Duration: ${Math.round(route.duration / 60)} minutes`);
      console.log(`   - Transfers: ${route.transfers}`);
      console.log(`   - Legs: ${route.legs.length}`);
    } else {
      console.log('   ❌ No route found');
    }

    // Test 3: Check nearest station finding
    console.log('\n4. Testing nearest station finding:');
    const testPoints = [
      { name: 'Apartment', lat: apartmentLat, lon: apartmentLon },
      { name: 'Workplace', lat: workplaceLat, lon: workplaceLon }
    ];
    
    for (const point of testPoints) {
      console.log(`\n   Finding nearest station to ${point.name}:`);
      
      // Manually find nearest using the transit service
      let nearest = null;
      let minDistance = Infinity;
      
      allStations.forEach(station => {
        let stationLat, stationLon;
        
        if (Array.isArray(station.coordinates) && station.coordinates.length === 2) {
          stationLon = station.coordinates[0];
          stationLat = station.coordinates[1];
        } else if (station.coordinates && typeof station.coordinates === 'object' && 'lat' in station.coordinates && 'lon' in station.coordinates) {
          stationLat = station.coordinates.lat;
          stationLon = station.coordinates.lon;
        } else {
          return;
        }
        
        const distance = calculateDistance(point.lat, point.lon, stationLat, stationLon);
        if (distance < minDistance) {
          minDistance = distance;
          nearest = { ...station, distance, lat: stationLat, lon: stationLon };
        }
      });
      
      if (nearest) {
        console.log(`   - Nearest: ${nearest.name} (${nearest.id})`);
        console.log(`   - Distance: ${Math.round(nearest.distance)}m`);
        console.log(`   - Station coords: (${nearest.lat}, ${nearest.lon})`);
        console.log(`   - Original format: ${JSON.stringify(nearest.coordinates)}`);
      } else {
        console.log('   - No nearest station found');
      }
    }

    console.log('\n✅ Coordinate format test completed!');

  } catch (error) {
    console.error('\n❌ Error testing coordinate fix:', error);
    process.exit(1);
  }
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Run the test
testCoordinateFix().catch(console.error);