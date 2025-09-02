#!/usr/bin/env ts-node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixRouteDurations() {
  console.log('Starting route duration fix...');
  
  try {
    // Get all routes
    const routes = await prisma.route.findMany({
      select: {
        id: true,
        duration: true,
        walkTime: true,
        trainTime: true,
        routeData: true,
      }
    });
    
    console.log(`Found ${routes.length} routes to check`);
    
    let fixedCount = 0;
    let errorCount = 0;
    
    for (const route of routes) {
      try {
        // Parse the route data
        const routeData = route.routeData as any;
        
        if (!routeData || !routeData.legs) {
          console.warn(`Route ${route.id} has invalid routeData`);
          errorCount++;
          continue;
        }
        
        // Calculate correct durations from the route data
        
        
        // Calculate walk and train times from legs
        const walkLegs = routeData.legs.filter((leg: any) => leg.mode === 'WALK');
        const transitLegs = routeData.legs.filter((leg: any) => ['RAIL', 'SUBWAY', 'BUS', 'TRANSIT'].includes(leg.mode));
        
        const correctWalkSeconds = walkLegs.reduce((sum: number, leg: any) => sum + (leg.duration || 0), 0);
        const correctTrainSeconds = transitLegs.reduce((sum: number, leg: any) => sum + (leg.duration || 0), 0);
        
        const correctWalkMinutes = Math.ceil(correctWalkSeconds / 60);
        const correctTrainMinutes = Math.ceil(correctTrainSeconds / 60);
        const correctTotalMinutes = Math.ceil((correctWalkSeconds + correctTrainSeconds) / 60);
        // Check if update is needed
        const needsUpdate = 
          route.duration !== correctTotalMinutes ||
          route.walkTime !== correctWalkMinutes ||
          route.trainTime !== correctTrainMinutes;
        
        if (needsUpdate) {
          console.log(`Route ${route.id}:`);
          console.log(`  Current: total=${route.duration}min, walk=${route.walkTime}min, train=${route.trainTime}min`);
          console.log(`  Correct: total=${correctTotalMinutes}min, walk=${correctWalkMinutes}min, train=${correctTrainMinutes}min`);
          
          // Update the route
          await prisma.route.update({
            where: { id: route.id },
            data: {
              duration: correctTotalMinutes,
              walkTime: correctWalkMinutes,
              trainTime: correctTrainMinutes,
            }
          });
          
          fixedCount++;
        }
      } catch (error) {
        console.error(`Error processing route ${route.id}:`, error);
        errorCount++;
      }
    }
    
    console.log(`\nSummary:`);
    console.log(`- Total routes: ${routes.length}`);
    console.log(`- Fixed: ${fixedCount}`);
    console.log(`- Errors: ${errorCount}`);
    console.log(`- Already correct: ${routes.length - fixedCount - errorCount}`);
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixRouteDurations().catch(console.error);