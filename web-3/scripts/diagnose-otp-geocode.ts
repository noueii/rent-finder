#!/usr/bin/env tsx
/**
 * Diagnose OTP geocode errors
 * Usage: npm run diagnose-otp -- --lat 35.6812 --lon 139.7671
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const params: { lat?: string; lon?: string; endpoint?: string } = {};
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace('--', '');
    const value = args[i + 1];
    if (key && value) {
      params[key as keyof typeof params] = value;
    }
  }
  
  return params;
}

async function diagnoseOTP() {
  const args = parseArgs();
  
  if (!args.lat || !args.lon) {
    console.error('❌ Missing required arguments');
    console.log('\nUsage:');
    console.log('  npm run diagnose-otp -- --lat 35.6812 --lon 139.7671');
    console.log('\nThis will help diagnose why OTP returns "geocode not found" errors');
    process.exit(1);
  }
  
  const lat = parseFloat(args.lat);
  const lon = parseFloat(args.lon);
  const endpoint = args.endpoint || process.env.OTP_ENDPOINT || 'http://localhost:8080/otp/routers/default';
  
  console.log('\n🔍 OTP Geocode Diagnostic');
  console.log('========================');
  console.log(`Coordinates: ${lat}, ${lon}`);
  console.log(`Endpoint: ${endpoint}\n`);
  
  const results: any = {
    coordinates: { lat, lon },
    endpoint,
    timestamp: new Date().toISOString(),
    tests: []
  };
  
  // Test 1: Check if OTP is running
  console.log('1. Checking OTP service health...');
  try {
    const healthResponse = await fetch(`${endpoint}/index/routes`, {
      signal: AbortSignal.timeout(5000)
    });
    
    results.tests.push({
      test: 'OTP Health Check',
      success: healthResponse.ok,
      status: healthResponse.status,
      message: healthResponse.ok ? 'OTP service is running' : 'OTP service may be down'
    });
    
    console.log(healthResponse.ok ? '   ✅ OTP is running' : '   ❌ OTP is not responding');
  } catch (error) {
    results.tests.push({
      test: 'OTP Health Check',
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
    console.log('   ❌ Cannot connect to OTP');
  }
  
  // Test 2: Try a simple route plan
  console.log('\n2. Testing route planning...');
  const testDestination = { lat: lat + 0.01, lon: lon + 0.01 }; // ~1km away
  
  try {
    const params = new URLSearchParams({
      fromPlace: `${lat},${lon}`,
      toPlace: `${testDestination.lat},${testDestination.lon}`,
      mode: 'TRANSIT,WALK',
      maxWalkDistance: '2000',
      arriveBy: 'false',
      numItineraries: '1'
    });
    
    const url = `${endpoint}/plan?${params}`;
    console.log(`   Request URL: ${url}`);
    
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000)
    });
    
    const data = await response.json();
    
    if (data.error) {
      results.tests.push({
        test: 'Route Planning',
        success: false,
        error: data.error,
        possibleCauses: analyzeError(data.error)
      });
      
      console.log(`   ❌ Route planning failed: ${data.error.msg || data.error.message}`);
      console.log(`   Error ID: ${data.error.id}`);
    } else if (data.plan?.itineraries?.length > 0) {
      results.tests.push({
        test: 'Route Planning',
        success: true,
        message: 'Route planning works'
      });
      console.log('   ✅ Route planning works');
    } else {
      results.tests.push({
        test: 'Route Planning',
        success: false,
        message: 'No routes found but no error returned'
      });
      console.log('   ⚠️  No routes found');
    }
  } catch (error) {
    results.tests.push({
      test: 'Route Planning',
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
    console.log(`   ❌ Request failed: ${error}`);
  }
  
  // Test 3: Check coordinate bounds
  console.log('\n3. Checking coordinate validity...');
  const coordinateChecks = {
    isValidLatitude: lat >= -90 && lat <= 90,
    isValidLongitude: lon >= -180 && lon <= 180,
    isInTokyoArea: lat >= 35.3 && lat <= 36.0 && lon >= 139.3 && lon <= 140.1,
    isInJapan: lat >= 24 && lat <= 46 && lon >= 122 && lon <= 146
  };
  
  results.tests.push({
    test: 'Coordinate Validation',
    checks: coordinateChecks,
    message: coordinateChecks.isInTokyoArea ? 'Coordinates are in Tokyo area' : 
             coordinateChecks.isInJapan ? 'Coordinates are in Japan but not Tokyo' :
             'Coordinates are outside Japan'
  });
  
  console.log(`   Valid latitude: ${coordinateChecks.isValidLatitude ? '✅' : '❌'}`);
  console.log(`   Valid longitude: ${coordinateChecks.isValidLongitude ? '✅' : '❌'}`);
  console.log(`   In Tokyo area: ${coordinateChecks.isInTokyoArea ? '✅' : '❌'}`);
  console.log(`   In Japan: ${coordinateChecks.isInJapan ? '✅' : '❌'}`);
  
  // Test 4: Try with increasing walk distances
  console.log('\n4. Testing with different walk distances...');
  const walkDistances = [500, 1000, 2000, 5000];
  
  for (const distance of walkDistances) {
    try {
      const params = new URLSearchParams({
        fromPlace: `${lat},${lon}`,
        toPlace: `${testDestination.lat},${testDestination.lon}`,
        mode: 'TRANSIT,WALK',
        maxWalkDistance: distance.toString(),
        arriveBy: 'false',
        numItineraries: '1'
      });
      
      const response = await fetch(`${endpoint}/plan?${params}`, {
        signal: AbortSignal.timeout(5000)
      });
      
      const data = await response.json();
      const success = !data.error && data.plan?.itineraries?.length > 0;
      
      results.tests.push({
        test: `Walk Distance ${distance}m`,
        success,
        error: data.error
      });
      
      console.log(`   ${distance}m: ${success ? '✅ Routes found' : '❌ No routes'}`);
      
      if (success) break; // Stop if we found a working distance
    } catch (error) {
      console.log(`   ${distance}m: ❌ Request failed`);
    }
  }
  
  // Diagnosis summary
  console.log('\n📊 Diagnosis Summary:');
  console.log('====================');
  
  if (results.tests.some((t: any) => t.test === 'OTP Health Check' && !t.success)) {
    console.log('\n❌ PRIMARY ISSUE: OTP service is not accessible');
    console.log('   Solutions:');
    console.log('   - Check if OTP is running: docker ps | grep opentripplanner');
    console.log('   - Verify the endpoint URL is correct');
    console.log('   - Check network/firewall settings');
  } else if (!coordinateChecks.isInTokyoArea) {
    console.log('\n❌ PRIMARY ISSUE: Coordinates are outside Tokyo area');
    console.log('   Solutions:');
    console.log('   - OTP may only have Tokyo transit data loaded');
    console.log('   - Verify coordinates are correct');
    console.log('   - Check if OTP has data for your region');
  } else if (results.tests.some((t: any) => t.error?.id === '404' || t.error?.msg?.includes('LOCATION'))) {
    console.log('\n❌ PRIMARY ISSUE: Location not accessible by transit');
    console.log('   Common causes:');
    console.log('   - Location is too far from any transit stop');
    console.log('   - OTP graph data doesn\'t cover this area');
    console.log('   - Walk distance limit is too restrictive');
    console.log('   Solutions:');
    console.log('   - Increase maxWalkDistance parameter');
    console.log('   - Check if transit exists near these coordinates');
    console.log('   - Verify OTP has complete Tokyo GTFS data');
  }
  
  // Save results
  const outputPath = join(process.cwd(), 'otp-diagnostic-results.json');
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Detailed results saved to: ${outputPath}`);
}

function analyzeError(error: any): string[] {
  const causes = [];
  
  if (error.id === '404' || error.msg?.includes('404')) {
    causes.push('No route exists between the two points');
    causes.push('One or both locations are not accessible by transit');
  }
  
  if (error.msg?.includes('LOCATION') || error.msg?.includes('GEOCODE')) {
    causes.push('OTP cannot find a valid location for the given coordinates');
    causes.push('The coordinates may be in an area without transit coverage');
    causes.push('The location may be too far from any transit stop');
  }
  
  if (error.msg?.includes('OUTSIDE_BOUNDS')) {
    causes.push('Coordinates are outside the OTP graph coverage area');
  }
  
  if (error.msg?.includes('TOO_CLOSE')) {
    causes.push('Origin and destination are too close together');
  }
  
  if (error.msg?.includes('SYSTEM_ERROR')) {
    causes.push('OTP internal error - check server logs');
  }
  
  return causes;
}

// Run diagnostic
diagnoseOTP();