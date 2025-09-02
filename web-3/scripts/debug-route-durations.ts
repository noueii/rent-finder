#!/usr/bin/env ts-node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugRouteDurations() {
  console.log('Checking route durations...\n');
  
  try {
    // Get a sample of routes to check
    const routes = await prisma.route.findMany({
      take: 20,
      orderBy: { calculatedAt: 'desc' },
      include: {
        apartment: {
          select: {
            id: true,
            title: true,
          }
        },
        toStation: {
          select: {
            name: true,
          }
        }
      }
    });
    
    console.log(`Checking ${routes.length} most recent routes:\n`);
    
    for (const route of routes) {
      const routeData = route.routeData as any;
      
      console.log(`Route ID: ${route.id}`);
      console.log(`Apartment: ${route.apartment.title} (${route.apartment.id})`);
      console.log(`To Station: ${route.toStation.name}`);
      console.log(`Stored values: duration=${route.duration}min, walk=${route.walkTime}min, train=${route.trainTime}min`);
      
      if (routeData && routeData.legs) {
        // Calculate from route data
        const totalSeconds = routeData.duration || 0;
        const totalMinutes = Math.ceil(totalSeconds / 60);
        
        const walkSeconds = routeData.legs
          .filter((leg: any) => leg.mode === 'WALK')
          .reduce((sum: number, leg: any) => sum + (leg.duration || 0), 0);
        const trainSeconds = routeData.legs
          .filter((leg: any) => leg.mode !== 'WALK')
          .reduce((sum: number, leg: any) => sum + (leg.duration || 0), 0);
        
        const walkMinutes = Math.ceil(walkSeconds / 60);
        const trainMinutes = Math.ceil(trainSeconds / 60);
        
        console.log(`From routeData: duration=${totalMinutes}min (${totalSeconds}s), walk=${walkMinutes}min, train=${trainMinutes}min`);
        
        // Show if there's a mismatch
        if (route.duration !== totalMinutes) {
          console.log(`⚠️  MISMATCH: Stored ${route.duration}min but should be ${totalMinutes}min`);
        }
        
        // Show the legs
        console.log('Route legs:');
        routeData.legs.forEach((leg: any, index: number) => {
          const legMinutes = Math.ceil((leg.duration || 0) / 60);
          console.log(`  ${index + 1}. ${leg.mode}: ${leg.from.name} → ${leg.to.name} (${legMinutes}min)`);
        });
      } else {
        console.log('⚠️  No valid routeData found');
      }
      
      console.log('---\n');
    }
    
    // Check for routes with suspiciously low durations
    const suspiciousRoutes = await prisma.route.count({
      where: {
        OR: [
          { duration: { lt: 5 } }, // Less than 5 minutes total
          { 
            AND: [
              { walkTime: { gt: 0 } },
              { trainTime: { gt: 0 } },
              { duration: { lte: prisma.route.fields.trainTime } } // Total <= train time alone
            ]
          }
        ]
      }
    });
    
    console.log(`\nFound ${suspiciousRoutes} routes with suspiciously low durations`);
    
    if (suspiciousRoutes > 0) {
      console.log('\nTo fix these routes, run: npm run fix:routes');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the debug
debugRouteDurations().catch(console.error);