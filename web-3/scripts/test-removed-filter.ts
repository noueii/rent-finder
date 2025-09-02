#!/usr/bin/env tsx
/**
 * Test script to verify that removed apartments are filtered from lists
 */

import { db } from '~/server/db';

async function testRemovedFilter() {
  console.log('Testing removed apartment filtering...\n');

  try {
    // 1. Get a sample list with apartments
    const sampleList = await db.list.findFirst({
      where: {
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

    if (!sampleList) {
      console.log('No lists found with apartments');
      return;
    }

    console.log(`Testing with list: ${sampleList.name} (${sampleList.id})`);
    console.log(`Total apartments in list: ${sampleList._count.apartments}\n`);

    // 2. Get all apartments in the list (without filtering)
    const allApartments = await db.apartmentList.findMany({
      where: {
        listId: sampleList.id,
      },
      include: {
        apartment: {
          select: {
            id: true,
            externalId: true,
            removed: true,
            title: true,
          }
        }
      }
    });

    const removedCount = allApartments.filter(item => item.apartment?.removed).length;
    const activeCount = allApartments.filter(item => !item.apartment?.removed).length;

    console.log('Without filtering:');
    console.log(`- Total apartments: ${allApartments.length}`);
    console.log(`- Removed apartments: ${removedCount}`);
    console.log(`- Active apartments: ${activeCount}\n`);

    // 3. Test the filtered query (simulating what the API does)
    const filteredApartments = await db.apartmentList.findMany({
      where: {
        listId: sampleList.id,
        apartment: {
          removed: false,
        }
      },
      include: {
        apartment: {
          select: {
            id: true,
            externalId: true,
            removed: true,
            title: true,
          }
        }
      }
    });

    console.log('With removed filter:');
    console.log(`- Total apartments: ${filteredApartments.length}`);
    console.log(`- Should equal active count: ${filteredApartments.length === activeCount ? '✅ YES' : '❌ NO'}\n`);

    // 4. Show some examples of removed apartments
    if (removedCount > 0) {
      console.log('Examples of removed apartments that are now filtered:');
      const removedExamples = allApartments
        .filter(item => item.apartment?.removed)
        .slice(0, 5);
      
      removedExamples.forEach(item => {
        console.log(`- ${item.apartment?.externalId}: ${item.apartment?.title || 'No title'}`);
      });
    }

    // 5. Test specific list types
    console.log('\nTesting specific list types:');
    const listTypes = ['LIKED', 'BOOKMARKED', 'HIDDEN', 'FAVORITED'] as const;
    
    for (const listType of listTypes) {
      const list = await db.list.findFirst({
        where: {
          type: listType,
          apartments: {
            some: {}
          }
        }
      });

      if (list) {
        const [totalCount, activeCount] = await Promise.all([
          db.apartmentList.count({
            where: { listId: list.id }
          }),
          db.apartmentList.count({
            where: {
              listId: list.id,
              apartment: {
                removed: false
              }
            }
          })
        ]);

        console.log(`${listType}: ${activeCount}/${totalCount} active apartments`);
      }
    }

    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await db.$disconnect();
  }
}

// Run the test
testRemovedFilter();