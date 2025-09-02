#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzeAndFixCircularRoutes() {
  console.log('Analyzing routes for circular patterns...\n');
  
  try {
    // Get all routes with their route data
    const routes = await prisma.route.findMany({
      select: {
        id: true,
        apartmentId: true,
        toStationId: true,
        duration: true,
        routeData: true,
        apartment: {
          select: {
            address: true,
            latitude: true,
            longitude: true,
          }
        },
        toStation: {
          select: {
            name: true,
            nameEn: true,
            latitude: true,
            longitude: true,
          }
        }
      }
    });
    
    console.log(`Found ${routes.length} routes to analyze`);
    
    let circularRoutes = 0;
    let invalidRoutes = 0;
    const routesToDelete: string[] = [];
    
    for (const route of routes) {
      try {
        const routeData = route.routeData as any;
        
        if (!routeData || !routeData.legs || !Array.isArray(routeData.legs)) {
          console.warn(`Route ${route.id} has invalid routeData structure`);
          invalidRoutes++;
          routesToDelete.push(route.id);
          continue;
        }
        
        // Check if the route is circular (ends where it started)
        const legs = routeData.legs;
        if (legs.length > 0) {
          const firstLeg = legs[0];
          const lastLeg = legs[legs.length - 1];
          
          // Check if first origin and last destination are the same
          const startLat = firstLeg.from?.lat;
          const startLon = firstLeg.from?.lon;
          const endLat = lastLeg.to?.lat;
          const endLon = lastLeg.to?.lon;
          
          if (startLat && startLon && endLat && endLon) {
            // Check if start and end are within 50 meters of each other (allowing for small GPS variations)
            const distance = calculateDistance(startLat, startLon, endLat, endLon);
            
            if (distance < 50) {
              circularRoutes++;
              console.log(`\nCircular route detected: ${route.id}`);
              console.log(`  Apartment: ${route.apartment.address}`);
              console.log(`  To Station: ${route.toStation.nameEn || route.toStation.name}`);
              console.log(`  Route: ${legs.map((l: any) => `${l.from?.name || 'Unknown'} -> ${l.to?.name || 'Unknown'} (${l.mode})`).join(' -> ')}`);
              console.log(`  Start: ${startLat}, ${startLon}`);
              console.log(`  End: ${endLat}, ${endLon}`);
              console.log(`  Distance between start/end: ${distance.toFixed(2)}m`);
              
              routesToDelete.push(route.id);
            }
          }
          
          // Also check if the destination doesn't match the intended station
          if (route.toStation.latitude && route.toStation.longitude && endLat && endLon) {
            const distanceToStation = calculateDistance(
              endLat, 
              endLon, 
              route.toStation.latitude, 
              route.toStation.longitude
            );
            
            // If the route ends more than 1km from the intended station, it's likely wrong
            if (distanceToStation > 1000) {
              console.log(`\nRoute doesn't reach intended station: ${route.id}`);
              console.log(`  Apartment: ${route.apartment.address}`);
              console.log(`  Intended Station: ${route.toStation.nameEn || route.toStation.name}`);
              console.log(`  Actual End: ${lastLeg.to?.name || 'Unknown'}`);
              console.log(`  Distance to intended station: ${(distanceToStation / 1000).toFixed(2)}km`);
              
              if (!routesToDelete.includes(route.id)) {
                routesToDelete.push(route.id);
                invalidRoutes++;
              }
            }
          }
        }
        
      } catch (error) {
        console.error(`Error analyzing route ${route.id}:`, error);
      }
    }
    
    console.log(`\n=== Summary ===`);
    console.log(`Total routes analyzed: ${routes.length}`);
    console.log(`Circular routes found: ${circularRoutes}`);
    console.log(`Invalid routes found: ${invalidRoutes}`);
    console.log(`Total routes to delete: ${routesToDelete.length}`);
    
    if (routesToDelete.length > 0) {
      console.log(`\nDeleting ${routesToDelete.length} problematic routes...`);
      
      const deleteResult = await prisma.route.deleteMany({
        where: {
          id: { in: routesToDelete }
        }
      });
      
      console.log(`Deleted ${deleteResult.count} routes`);
      
      // Find apartments that now have no routes
      const apartmentsWithoutRoutes = await prisma.apartment.findMany({
        where: {
          id: { in: routes.filter(r => routesToDelete.includes(r.id)).map(r => r.apartmentId) },
          routes: {
            none: {}
          }
        },
        select: {
          id: true,
          address: true,
        }
      });
      
      console.log(`\n${apartmentsWithoutRoutes.length} apartments now have no routes and need recalculation`);
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Calculate distance between two points in meters using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Run the analysis
analyzeAndFixCircularRoutes().catch(console.error);