#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import { getTransitService } from '../src/lib/transit';

const prisma = new PrismaClient();

async function checkStationMapping() {
  console.log('Checking station ID mapping...\n');
  
  try {
    // Get a few stations from the database
    const dbStations = await prisma.station.findMany({
      take: 10,
      orderBy: { name: 'asc' }
    });
    
    console.log('Database stations:');
    console.log('==================');
    dbStations.forEach(station => {
      console.log(`DB ID: ${station.id}`);
      console.log(`  Name: ${station.name} (${station.nameEn})`);
      console.log(`  External ID: ${station.externalId || 'N/A'}`);
      console.log(`  Coordinates: ${station.latitude}, ${station.longitude}`);
      console.log('');
    });
    
    // Initialize transit service
    const transitService = await getTransitService();
    
    // Try to find these stations in the transit service
    console.log('\nChecking transit service:');
    console.log('========================');
    
    // Look for stations by external ID if available
    for (const dbStation of dbStations) {
      if (dbStation.externalId) {
        try {
          const transitStation = transitService.getStation(dbStation.externalId);
          if (transitStation) {
            console.log(`✅ Found station ${dbStation.externalId} in transit service`);
          } else {
            console.log(`❌ Station ${dbStation.externalId} NOT found in transit service`);
          }
        } catch (error) {
          console.log(`❌ Error checking station ${dbStation.externalId}:`, error);
        }
      }
    }
    
    // Get all transit stations and show format
    console.log('\nTransit service station ID format:');
    console.log('=================================');
    const allStations = transitService.getAllStations();
    const sampleStations = Object.entries(allStations).slice(0, 5);
    
    sampleStations.forEach(([id, station]) => {
      console.log(`Transit ID: ${id}`);
      console.log(`  Name: ${station.name} (${station.name_ja})`);
      console.log(`  Lines: ${station.lines.join(', ')}`);
      console.log('');
    });
    
    // Check the specific failing station
    const failingId = 'cmd94fyaf018xg5geftd3t1un';
    console.log(`\nChecking failing station ID: ${failingId}`);
    console.log('=====================================');
    
    const failingStation = await prisma.station.findUnique({
      where: { id: failingId }
    });
    
    if (failingStation) {
      console.log('Found in database:');
      console.log(`  Name: ${failingStation.name} (${failingStation.nameEn})`);
      console.log(`  External ID: ${failingStation.externalId || 'N/A'}`);
      console.log(`  Coordinates: ${failingStation.latitude}, ${failingStation.longitude}`);
      
      // Try to find it in transit service
      if (failingStation.externalId) {
        const transitStation = transitService.getStation(failingStation.externalId);
        if (transitStation) {
          console.log('✅ Found in transit service with external ID');
        } else {
          console.log('❌ NOT found in transit service');
          
          // Try to find by name
          const possibleMatches = Object.entries(allStations).filter(([id, station]) => 
            station.name === failingStation.nameEn || 
            station.name_ja === failingStation.name
          );
          
          if (possibleMatches.length > 0) {
            console.log('\nPossible matches by name:');
            possibleMatches.forEach(([id, station]) => {
              console.log(`  ${id}: ${station.name} / ${station.name_ja}`);
            });
          }
        }
      } else {
        console.log('⚠️  No external ID in database - cannot map to transit service');
      }
    } else {
      console.log('❌ Station not found in database');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkStationMapping().catch(console.error);