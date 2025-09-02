#!/usr/bin/env tsx

/**
 * Check list statuses in the database
 * Usage: npx tsx scripts/check-list-status.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkListStatus() {
  console.log('Checking list statuses...\n');

  try {
    // Get all lists
    const lists = await prisma.list.findMany({
      include: {
        _count: {
          select: { apartments: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    console.log(`Found ${lists.length} recent lists:\n`);

    for (const list of lists) {
      console.log(`List: ${list.name}`);
      console.log(`  ID: ${list.id}`);
      console.log(`  Type: ${list.type}`);
      console.log(`  Status: ${list.status}`);
      console.log(`  Progress: ${list.progress}%`);
      console.log(`  Apartments: ${list._count.apartments}`);
      console.log(`  Created: ${list.createdAt.toISOString()}`);
      console.log(`  Updated: ${list.updatedAt.toISOString()}`);
      
      if (list.searchParams) {
        const params = list.searchParams as any;
        console.log(`  Search params:`);
        console.log(`    - Workplace: ${params.workplaceStationId}`);
        console.log(`    - Max commute: ${params.maxCommuteMinutes} min`);
      }
      
      console.log('---');
    }

    // Check if there are any failed lists
    const failedLists = await prisma.list.findMany({
      where: { status: 'failed' },
      orderBy: { createdAt: 'desc' }
    });

    if (failedLists.length > 0) {
      console.log(`\n⚠️  Found ${failedLists.length} failed lists`);
      
      // Check job queue for errors
      console.log('\nChecking job queue for related errors...');
      
      // Get recent search sessions for failed lists
      for (const list of failedLists.slice(0, 3)) {
        console.log(`\nFailed list: ${list.name} (${list.id})`);
        
        const session = await prisma.searchSession.findFirst({
          where: { listId: list.id },
          orderBy: { createdAt: 'desc' }
        });
        
        if (session) {
          console.log(`  Session created: ${session.createdAt.toISOString()}`);
          console.log(`  User: ${session.userId}`);
        }
      }
    }

  } catch (error) {
    console.error('Error checking list status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkListStatus().catch(console.error);