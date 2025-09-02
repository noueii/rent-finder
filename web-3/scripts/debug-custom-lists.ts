#!/usr/bin/env tsx
/**
 * Debug why apartments aren't showing in custom lists
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugCustomLists() {
  console.log('🔍 Debugging Custom Lists...\n');

  try {
    // Get all users
    const users = await prisma.user.findMany({
      select: { id: true, email: true }
    });

    for (const user of users) {
      console.log(`\n👤 User: ${user.email || user.id}`);
      
      // Get all lists for this user
      const lists = await prisma.list.findMany({
        where: {
          userId: user.id,
          type: { in: ['LIKED', 'HIDDEN', 'BOOKMARKED', 'FAVORITED'] }
        },
        include: {
          _count: {
            select: { apartments: true }
          }
        }
      });

      if (lists.length === 0) {
        console.log('  No custom lists found');
        continue;
      }

      for (const list of lists) {
        console.log(`\n  📋 ${list.type} List (${list.name})`);
        console.log(`     ID: ${list.id}`);
        console.log(`     Status: ${list.status}`);
        console.log(`     Total apartments: ${list._count.apartments}`);
        console.log(`     Search params: ${JSON.stringify(list.searchParams)}`);
        
        // Get first few apartments in this list
        const apartmentListItems = await prisma.apartmentList.findMany({
          where: {
            listId: list.id
          },
          take: 5,
          include: {
            apartment: {
              select: {
                id: true,
                title: true,
                price: true
              }
            }
          }
        });

        if (apartmentListItems.length > 0) {
          console.log('     First few apartments:');
          apartmentListItems.forEach((item, index) => {
            console.log(`       ${index + 1}. ${item.apartment.title || 'No title'} - ¥${item.apartment.price.toLocaleString()}`);
          });
        } else {
          console.log('     ⚠️  No apartments found when querying directly!');
        }

        // Test the exact query that getApartments would use
        console.log('\n     Testing getApartments query...');
        const testQuery = await prisma.apartmentList.findMany({
          where: {
            listId: list.id,
            // This mimics what getApartments does with empty filters
            apartment: {}
          },
          take: 5,
          orderBy: [
            { addedAt: 'desc' },
            { apartmentId: 'asc' }
          ],
          include: {
            apartment: {
              include: {
                images: {
                  orderBy: { order: 'asc' },
                },
                nearestStations: {
                  include: {
                    station: true,
                  },
                  orderBy: { walkingMinutes: 'asc' },
                  take: 3,
                }
              }
            }
          }
        });

        console.log(`     Query returned ${testQuery.length} apartments`);
        
        // Count total with the same where clause
        const totalCount = await prisma.apartmentList.count({
          where: {
            listId: list.id,
            apartment: {}
          }
        });
        console.log(`     Total count with same where clause: ${totalCount}`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
debugCustomLists().catch(console.error);