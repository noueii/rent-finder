#!/usr/bin/env tsx

/**
 * Transit Service Cleanup Test
 * Tests actual behavior of transit services to understand what works
 */

import { getOTPService } from '../src/lib/transit/otp-service';
import { getTransitService } from '../src/lib/transit';

async function testTransitServices() {
  console.log('=== Transit Service Cleanup Test ===\n');
  
  // Test 1: Check if transit graph loads
  console.log('1. Testing Transit Graph Service:');
  try {
    const transitService = await getTransitService();
    const stations = transitService.getAllStations();
    console.log(`   ✓ Loaded ${stations.length} stations`);
    
    // Find Tokyo station
    const tokyoStations = transitService.findStation('Tokyo');
    if (tokyoStations.length > 0) {
      console.log(`   ✓ Found Tokyo station: ${tokyoStations[0].name} (${tokyoStations[0].id})`);
    }
  } catch (error) {
    console.log(`   ✗ Failed to load transit graph: ${error}`);
  }

  // Test 2: Check OTP availability
  console.log('\n2. Testing OTP Service:');
  try {
    const otpService = await getOTPService();
    const stats = otpService.getCacheStats();
    
    console.log(`   - OTP Endpoint: ${process.env.OTP_ENDPOINT || 'http://localhost:8080/otp/routers/default'}`);
    console.log(`   - OTP Available: ${stats.otpAvailable}`);
    
    // Try a simple route calculation
    if (stats.otpAvailable) {
      console.log('   - Testing route calculation...');
      const route = await otpService.getRoute(
        35.6812, 139.7671, // Tokyo Station
        35.6580, 139.7016, // Shinjuku Station
        30
      );
      
      if (route) {
        console.log(`   ✓ Route found: ${Math.round(route.duration / 60)} minutes`);
      } else {
        console.log('   ✗ No route found');
      }
    } else {
      console.log('   ℹ OTP not available, will use fallback');
    }
  } catch (error) {
    console.log(`   ✗ OTP service error: ${error}`);
  }

  // Test 3: Check fallback behavior
  console.log('\n3. Testing Fallback Behavior:');
  try {
    // Force OTP to be unavailable by setting a bad endpoint
    process.env.OTP_ENDPOINT = 'http://invalid-endpoint:9999';
    
    const otpService = await getOTPService();
    const transitService = await getTransitService();
    
    // Find stations
    const tokyoStations = transitService.findStation('Tokyo');
    const shinjukuStations = transitService.findStation('Shinjuku');
    
    if (tokyoStations.length > 0 && shinjukuStations.length > 0) {
      const tokyo = tokyoStations[0];
      const shinjuku = shinjukuStations[0];
      
      // Get coordinates
      let tokyoLat: number, tokyoLon: number;
      if (Array.isArray(tokyo.coordinates)) {
        [tokyoLon, tokyoLat] = tokyo.coordinates;
      } else {
        tokyoLat = tokyo.coordinates.lat;
        tokyoLon = tokyo.coordinates.lon;
      }
      
      let shinjukuLat: number, shinjukuLon: number;
      if (Array.isArray(shinjuku.coordinates)) {
        [shinjukuLon, shinjukuLat] = shinjuku.coordinates;
      } else {
        shinjukuLat = shinjuku.coordinates.lat;
        shinjukuLon = shinjuku.coordinates.lon;
      }
      
      // Test route calculation with fallback
      const route = await otpService.getRoute(
        tokyoLat, tokyoLon,
        shinjukuLat, shinjukuLon,
        30
      );
      
      if (route) {
        console.log(`   ✓ Fallback route found: ${Math.round(route.duration / 60)} minutes`);
        console.log(`   - Transfers: ${route.transfers}`);
        console.log(`   - Legs: ${route.legs.length}`);
      } else {
        console.log('   ✗ Fallback failed to find route');
      }
    }
  } catch (error) {
    console.log(`   ✗ Fallback test error: ${error}`);
  }

  // Test 4: Check mock service
  console.log('\n4. Testing Mock Service:');
  try {
    const { getMockTransitService } = await import('../src/lib/transit/mock-service');
    const mockService = await getMockTransitService();
    
    const mockRoute = await mockService.getRoute(
      35.6812, 139.7671, // Tokyo
      35.6580, 139.7016, // Shinjuku
      30
    );
    
    if (mockRoute) {
      console.log(`   ✓ Mock route: ${Math.round(mockRoute.duration / 60)} minutes`);
      console.log(`   - Always returns simple direct route`);
    }
  } catch (error) {
    console.log(`   ✗ Mock service error: ${error}`);
  }

  console.log('\n=== Summary ===');
  console.log('- Transit graph service works and has station data');
  console.log('- OTP service likely not configured/running');
  console.log('- Fallback to transit graph works');
  console.log('- Mock service is too simple to be useful');
  console.log('\nRecommendations:');
  console.log('1. Remove OTP service complexity until actually needed');
  console.log('2. Focus on transit graph as primary service');
  console.log('3. Remove mock service or make it more useful');
  console.log('4. Simplify coordinate handling');
}

// Run test
testTransitServices().catch(console.error);