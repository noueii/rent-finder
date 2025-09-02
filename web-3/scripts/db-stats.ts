#!/usr/bin/env tsx
/**
 * Database statistics without loading all data
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function stats() {
  try {
    const [
      apartmentCount,
      userCount,
      listCount,
      routeCount,
      imageCount,
      avgApartmentsPerList,
      recentApartments,
    ] = await Promise.all([
      prisma.apartment.count(),
      prisma.user.count(),
      prisma.list.count(),
      prisma.route.count(),
      prisma.apartmentImage.count(),
      prisma.apartmentList.groupBy({
        by: ['listId'],
        _count: true,
      }).then(groups => {
        const total = groups.reduce((sum, g) => sum + g._count, 0);
        return total / groups.length || 0;
      }),
      prisma.apartment.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      })
    ]);

    console.log('=== Database Statistics ===\n');
    console.log(`Total Apartments: ${apartmentCount.toLocaleString()}`);
    console.log(`Total Users: ${userCount}`);
    console.log(`Total Lists: ${listCount}`);
    console.log(`Total Routes: ${routeCount.toLocaleString()}`);
    console.log(`Total Images: ${imageCount.toLocaleString()}`);
    console.log(`Avg Apartments per List: ${Math.round(avgApartmentsPerList)}`);
    console.log(`New Apartments (24h): ${recentApartments}`);

    // Get price statistics
    const priceStats = await prisma.apartment.aggregate({
      _avg: { price: true },
      _min: { price: true },
      _max: { price: true },
      _count: true,
    });

    console.log('\n=== Price Statistics ===');
    console.log(`Average: ¥${Math.round(priceStats._avg.price || 0).toLocaleString()}`);
    console.log(`Min: ¥${(priceStats._min.price || 0).toLocaleString()}`);
    console.log(`Max: ¥${(priceStats._max.price || 0).toLocaleString()}`);

    // Get size statistics
    const sizeStats = await prisma.apartment.aggregate({
      _avg: { size: true },
      _min: { size: true },
      _max: { size: true },
    });

    console.log('\n=== Size Statistics ===');
    console.log(`Average: ${Math.round(sizeStats._avg.size || 0)}m²`);
    console.log(`Min: ${sizeStats._min.size || 0}m²`);
    console.log(`Max: ${sizeStats._max.size || 0}m²`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

stats();