#!/usr/bin/env tsx
/**
 * Fix routes that are TOO_CLOSE but have incorrect trainTime values
 * This handles cases where apartments are very close to the destination
 */

import { PrismaClient } from '@prisma/client';
import { getOTPService } from '../src/lib/transit/otp-service';

const prisma = new PrismaClient();

async function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

async function fixTooCloseRoutes() {
  console.log('🔍 Finding routes with TOO_CLOSE issues...\n');

  try {
    // Get all routes with their apartment and destination station coordinates
    const routes = await prisma.route.findMany({
      include: {
        apartment: {
          select: {
            id: true,
            latitude: true,
            longitude: true,
            address: true,
          }
        },
        toStation: {
          select: {
            id: true,
            name: true,
            nameEn: true,
            latitude: true,
            longitude: true,
          }
        }
      }
    });

    console.log(`Total routes to check: ${routes.length}`);

    const tooCloseRoutes = [];
    const walkingOnlyWithTrainTime = [];
    const needsRecalculation = [];

    for (const route of routes) {
      // Skip if missing coordinates
      if (!route.apartment.latitude || !route.apartment.longitude || 
          !route.toStation.latitude || !route.toStation.longitude) {
        continue;
      }

      // Calculate distance
      const distance = await calculateDistance(
        route.apartment.latitude,
        route.apartment.longitude,
        route.toStation.latitude,
        route.toStation.longitude
      );

      // Check if this is a TOO_CLOSE case (< 500m)
      if (distance < 500) {
        tooCloseRoutes.push({
          routeId: route.id,
          apartmentId: route.apartment.id,
          toStationName: route.toStation.nameEn || route.toStation.name,
          distance: Math.round(distance),
          duration: route.duration,
          walkTime: route.walkTime,
          trainTime: route.trainTime,
          hasIncorrectTrainTime: route.trainTime > 0
        });

        if (route.trainTime > 0) {
          needsRecalculation.push(route);
        }
      }

      // Also check for walking-only routes with train time
      if (route.routeData && typeof route.routeData === 'object') {
        const routeData = route.routeData as any;
        if (routeData.legs && Array.isArray(routeData.legs)) {
          const hasOnlyWalkingLegs = routeData.legs.every((leg: any) => leg.mode === 'WALK');
          if (hasOnlyWalkingLegs && route.trainTime > 0) {
            walkingOnlyWithTrainTime.push({
              routeId: route.id,
              apartmentId: route.apartment.id,
              toStationName: route.toStation.nameEn || route.toStation.name,
              distance: Math.round(distance),
              duration: route.duration,
              walkTime: route.walkTime,
              trainTime: route.trainTime
            });
          }
        }
      }
    }

    // Display findings
    console.log('\n📊 Analysis Results:');
    console.log('===================');
    console.log(`Routes within 500m: ${tooCloseRoutes.length}`);
    console.log(`Routes needing fix (< 500m with trainTime > 0): ${needsRecalculation.length}`);
    console.log(`Walking-only routes with trainTime > 0: ${walkingOnlyWithTrainTime.length}`);

    if (tooCloseRoutes.length > 0) {
      console.log('\n🚶 TOO_CLOSE Routes (< 500m):');
      console.log('================================');
      tooCloseRoutes.slice(0, 10).forEach(route => {
        console.log(`Route ${route.routeId}:`);
        console.log(`  Apartment: ${route.apartmentId}`);
        console.log(`  To: ${route.toStationName}`);
        console.log(`  Distance: ${route.distance}m`);
        console.log(`  Duration: ${route.duration} min`);
        console.log(`  Walk: ${route.walkTime} min, Train: ${route.trainTime} min`);
        if (route.hasIncorrectTrainTime) {
          console.log(`  ⚠️  Has incorrect trainTime!`);
        }
        console.log('');
      });
    }

    // Ask for confirmation before fixing
    if (needsRecalculation.length > 0) {
      console.log(`\n💡 Found ${needsRecalculation.length} routes that need fixing.`);
      console.log('These are walking-only routes (< 500m) but have trainTime > 0.');
      
      // Fix the routes
      console.log('\n🔧 Fixing routes...');
      const otpService = await getOTPService();
      let fixed = 0;
      let failed = 0;

      for (const route of needsRecalculation) {
        try {
          // Recalculate the route
          const newRoute = await otpService.getRoute(
            route.apartment.latitude!,
            route.apartment.longitude!,
            route.toStation.latitude!,
            route.toStation.longitude!,
            180 // 3 hour max
          );

          if (newRoute) {
            // Calculate correct times
            const walkLegs = newRoute.legs.filter(leg => leg.mode === 'WALK');
            const transitLegs = newRoute.legs.filter(leg => 
              ['RAIL', 'SUBWAY', 'BUS', 'TRANSIT'].includes(leg.mode)
            );

            const walkTime = Math.ceil(
              walkLegs.reduce((sum, leg) => sum + leg.duration, 0) / 60
            );
            const trainTime = Math.ceil(
              transitLegs.reduce((sum, leg) => sum + leg.duration, 0) / 60
            );
            const duration = Math.ceil(newRoute.duration / 60);

            // Update the route
            await prisma.route.update({
              where: { id: route.id },
              data: {
                duration,
                walkTime,
                trainTime,
                transfers: newRoute.transfers,
                routeData: newRoute as any,
                calculatedAt: new Date()
              }
            });

            fixed++;
            console.log(`✅ Fixed route ${route.id}: duration=${duration}, walk=${walkTime}, train=${trainTime}`);
          } else {
            // If no route found, it might be genuinely unreachable
            console.log(`❌ No route found for ${route.id}`);
            failed++;
          }
        } catch (error) {
          console.error(`❌ Error fixing route ${route.id}:`, error);
          failed++;
        }
      }

      console.log(`\n✨ Fixing complete!`);
      console.log(`   Fixed: ${fixed}`);
      console.log(`   Failed: ${failed}`);
    }

    // Also check for data integrity issues
    console.log('\n🔍 Checking data integrity...');
    const integrityIssues = await prisma.route.findMany({
      where: {
        OR: [
          // Walking time is greater than total duration
          { walkTime: { gt: prisma.route.fields.duration } },
          // Train time but no transfers (except direct trains)
          { AND: [
            { trainTime: { gt: 0 } },
            { transfers: 0 },
            { walkTime: { equals: prisma.route.fields.duration } }
          ]},
        ]
      },
      take: 10
    });

    if (integrityIssues.length > 0) {
      console.log(`\n⚠️  Found ${integrityIssues.length} routes with data integrity issues`);
      console.log('These routes have inconsistent time calculations.');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixTooCloseRoutes().catch(console.error);