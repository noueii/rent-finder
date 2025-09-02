#!/usr/bin/env tsx

/**
 * Test script for pruning service
 * Usage: npx tsx scripts/test-pruning-service.ts
 */

import { PrismaClient } from '@prisma/client';
import { getSearchIntegrationService } from '../src/lib/search/search-integration';
import { getJobQueue } from '../src/lib/jobs/queue';

const prisma = new PrismaClient();

async function testPruningService() {
  console.log('Testing Pruning Service...\n');

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
    });

    const apartmentsWithoutRoutes = apartmentsInList.filter(
      item => item.apartment.routes.length === 0
    );
    const apartmentsWithoutCoords = apartmentsInList.filter(
      item => !item.apartment.latitude || !item.apartment.longitude
    );

    console.log(`\nApartment statistics:`);
    console.log(`- Total apartments: ${apartmentsInList.length}`);
    console.log(`- Without routes: ${apartmentsWithoutRoutes.length}`);
    console.log(`- Without coordinates: ${apartmentsWithoutCoords.length}`);

    if (apartmentsWithoutRoutes.length > 0) {
      console.log('\nQueuing pruning job...');
      
      const searchService = getSearchIntegrationService(prisma);
      const queue = getJobQueue();
      
      const jobId = await queue.add('commute_route_prune', {
        listId: testList.id,
        workplaceStationId: searchParams.workplaceStationId,
        maxCommuteMinutes: searchParams.maxCommuteMinutes || 60,
      });

      console.log(`Pruning job queued with ID: ${jobId}`);
      console.log('\nJob will calculate routes and prune apartments that:');
      console.log('1. Have no coordinates');
      console.log('2. Have no route to the workplace');
      console.log(`3. Have commute time > ${searchParams.maxCommuteMinutes || 60} minutes`);
    } else {
      console.log('\nAll apartments already have routes calculated!');
    }

  } catch (error) {
    console.error('Error testing pruning service:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testPruningService().catch(console.error);