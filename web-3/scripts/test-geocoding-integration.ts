#!/usr/bin/env tsx
/**
 * Test script for geocoding integration
 * 
 * This script tests the geocoding functionality with the database.
 * Run with: npm run tsx scripts/test-geocoding-integration.ts
 */

import { PrismaClient } from '@prisma/client';
import { ApartmentGeocoder } from '../src/lib/geocoding/apartment-geocoder';
import { geocodingService } from '../src/lib/geocoding';

const prisma = new PrismaClient();

async function testGeocodingIntegration() {
  console.log('🗾 Testing Geocoding Integration\n');

  try {
    // 1. Test direct geocoding service
    console.log('1️⃣ Testing Direct Geocoding Service');
    const testAddress = '東京都渋谷区道玄坂1-12-1';
    const result = await geocodingService.geocode(testAddress);
    
    if (result) {
      console.log(`✅ Successfully geocoded: ${testAddress}`);
      console.log(`   Coordinates: ${result.latitude}, ${result.longitude}`);
      console.log(`   Provider: ${result.provider}\n`);
    } else {
      console.log(`❌ Failed to geocode: ${testAddress}\n`);
    }

    // 2. Get geocoding statistics
    console.log('2️⃣ Checking Current Geocoding Status');
    const geocoder = new ApartmentGeocoder(prisma);
    const stats = await geocoder.getStats();
    
    console.log(`Total apartments: ${stats.total}`);
    console.log(`Geocoded: ${stats.geocoded} (${stats.percentage.toFixed(1)}%)`);
    console.log(`Not geocoded: ${stats.notGeocoded}`);
    
    if (stats.bySource && Object.keys(stats.bySource).length > 0) {
      console.log('\nBy source:');
      for (const [source, sourceStats] of Object.entries(stats.bySource)) {
        const percentage = sourceStats.total > 0 
          ? (sourceStats.geocoded / sourceStats.total * 100).toFixed(1)
          : '0.0';
        console.log(`  ${source}: ${sourceStats.geocoded}/${sourceStats.total} (${percentage}%)`);
      }
    }

    // 3. Test geocoding apartments without coordinates
    console.log('\n3️⃣ Testing Apartment Geocoding');
    
    // Check if there are any apartments to geocode
    const ungeocoded = await prisma.apartment.count({
      where: {
        OR: [
          { latitude: null },
          { longitude: null },
        ],
      },
    });

    if (ungeocoded > 0) {
      console.log(`Found ${ungeocoded} apartments without coordinates`);
      console.log('Geocoding first 3 apartments...\n');

      const results = await geocoder.geocodeUngeocoded(3, (completed, total, current) => {
        if (current) {
          const status = current.success ? '✅' : '❌';
          console.log(`${status} [${completed}/${total}] ${current.address}`);
          if (current.result) {
            console.log(`   -> ${current.result.latitude}, ${current.result.longitude}`);
          }
          if (current.error) {
            console.log(`   -> Error: ${current.error}`);
          }
        }
      });

      console.log(`\nGeocoding complete: ${results.filter(r => r.success).length}/${results.length} successful`);
    } else {
      console.log('All apartments already have coordinates!');
    }

    // 4. Test cache stats
    console.log('\n4️⃣ Cache Statistics');
    const cacheStats = geocodingService.getCacheStats();
    console.log(`Cache entries: ${cacheStats.size}/${cacheStats.maxSize}`);

  } catch (error) {
    console.error('❌ Error during testing:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testGeocodingIntegration().catch(console.error);