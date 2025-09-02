#!/usr/bin/env tsx

/**
 * Simple test script for pruning service
 * Usage: npx tsx scripts/test-pruning-simple.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testPruning() {
  console.log('Testing Pruning Service (Simple)...\n');

  try {
    // Get a test list with apartments
    const testList = await prisma.list.findFirst({
      where: {
        type: 'SEARCH_RESULT',
        apartments: {
          some: {}
        }
      },
      include: {
        _count: {
          select: { apartments: true }
        }
      }
    });

    if (!testList) {
      console.error('No test list with apartments found');
      return;
    }

    console.log(`Found test list: ${testList.name}`);
    console.log(`List ID: ${testList.id}`);
    console.log(`Current apartments: ${testList._count.apartments}`);

    // Extract search params
    const searchParams = testList.searchParams as any;
    if (!searchParams?.workplaceStationId) {
      console.error('List does not have workplace station information');
      return;
    }

    console.log(`Workplace station: ${searchParams.workplaceStationId}`);
    console.log(`Max commute: ${searchParams.maxCommuteMinutes || 60} minutes`);

    // Check apartments without routes
    const apartmentsInList = await prisma.apartmentList.findMany({
      where: { listId: testList.id },
      include: {
        apartment: {
          include: {
            routes: {
              where: {
                toStationId: searchParams.workplaceStationId,
              },
            },
          },
        },
      },
      take: 10 // Just check first 10 for testing
    });

    console.log(`\nChecking first ${apartmentsInList.length} apartments:`);
    
    for (const item of apartmentsInList) {
      const apt = item.apartment;
      const hasCoords = apt.latitude !== null && apt.longitude !== null;
      const hasRoute = apt.routes.length > 0;
      
      console.log(`\nApartment ${apt.id}:`);
      console.log(`  - Title: ${apt.title}`);
      console.log(`  - Has coordinates: ${hasCoords ? `Yes (${apt.latitude}, ${apt.longitude})` : 'No'}`);
      console.log(`  - Has route: ${hasRoute ? `Yes (${apt.routes[0].duration} min)` : 'No'}`);
      
      if (hasRoute) {
        const route = apt.routes[0];
        console.log(`  - Commute time: ${route.duration} minutes`);
        console.log(`  - Transfers: ${route.transfers}`);
        console.log(`  - Walk time: ${route.walkTime} minutes`);
      }
    }

    // Summary statistics
    const allApartmentsInList = await prisma.apartmentList.findMany({
      where: { listId: testList.id },
      include: {
        apartment: {
          include: {
            routes: {
              where: {
                toStationId: searchParams.workplaceStationId,
              },
            },
          },
        },
      },
    });

    const apartmentsWithoutRoutes = allApartmentsInList.filter(
      item => item.apartment.routes.length === 0
    );
    const apartmentsWithoutCoords = allApartmentsInList.filter(
      item => !item.apartment.latitude || !item.apartment.longitude
    );

    console.log(`\n=== Summary Statistics ===`);
    console.log(`Total apartments in list: ${allApartmentsInList.length}`);
    console.log(`Without routes: ${apartmentsWithoutRoutes.length}`);
    console.log(`Without coordinates: ${apartmentsWithoutCoords.length}`);
    
    // Check routes that exceed max commute time
    const maxCommute = searchParams.maxCommuteMinutes || 60;
    const apartmentsExceedingMaxCommute = allApartmentsInList.filter(
      item => item.apartment.routes.length > 0 && item.apartment.routes[0].duration > maxCommute
    );
    
    console.log(`Exceeding max commute (${maxCommute} min): ${apartmentsExceedingMaxCommute.length}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testPruning().catch(console.error);