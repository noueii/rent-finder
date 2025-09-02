#!/usr/bin/env tsx
/**
 * Test that browse page excludes liked and hidden apartments
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function testBrowseExclusion() {
  try {
    // Get a user
    const user = await prisma.user.findFirst({});
    
    if (!user) {
      console.log("No user found");
      return;
    }
    
    console.log(`\n🔍 Testing browse exclusion for user: ${user.email}\n`);
    
    // Get user's liked and hidden lists
    const [likedList, hiddenList] = await Promise.all([
      prisma.list.findFirst({
        where: { userId: user.id, type: "LIKED" },
        include: { _count: { select: { apartments: true } } },
      }),
      prisma.list.findFirst({
        where: { userId: user.id, type: "HIDDEN" },
        include: { _count: { select: { apartments: true } } },
      }),
    ]);
    
    console.log(`📋 User's lists:`);
    console.log(`- Liked list: ${likedList ? `${likedList._count.apartments} apartments` : "Not found"}`);
    console.log(`- Hidden list: ${hiddenList ? `${hiddenList._count.apartments} apartments` : "Not found"}\n`);
    
    if (!likedList && !hiddenList) {
      console.log("User has no liked or hidden lists. Browse will show all apartments.");
      return;
    }
    
    // Get apartment IDs that should be excluded
    const excludedApartmentIds = new Set<string>();
    
    if (likedList) {
      const likedApartments = await prisma.apartmentList.findMany({
        where: { listId: likedList.id },
        select: { apartmentId: true },
      });
      likedApartments.forEach(item => excludedApartmentIds.add(item.apartmentId));
    }
    
    if (hiddenList) {
      const hiddenApartments = await prisma.apartmentList.findMany({
        where: { listId: hiddenList.id },
        select: { apartmentId: true },
      });
      hiddenApartments.forEach(item => excludedApartmentIds.add(item.apartmentId));
    }
    
    console.log(`🚫 Total apartments to exclude: ${excludedApartmentIds.size}\n`);
    
    // Get a browse list
    const browseList = await prisma.list.findFirst({
      where: { 
        userId: user.id,
        type: { notIn: ["LIKED", "HIDDEN", "BOOKMARKED", "FAVORITED"] },
      },
      include: { _count: { select: { apartments: true } } },
    });
    
    if (!browseList) {
      console.log("No browse list found");
      return;
    }
    
    console.log(`📖 Browse list: "${browseList.name}" with ${browseList._count.apartments} total apartments`);
    
    // Count how many would be shown vs excluded
    const browseApartments = await prisma.apartmentList.findMany({
      where: { listId: browseList.id },
      select: { apartmentId: true, apartment: { select: { title: true } } },
      take: 20,
    });
    
    let shownCount = 0;
    let excludedCount = 0;
    
    console.log(`\n🏠 Sample of apartments in browse list:`);
    browseApartments.forEach(item => {
      const isExcluded = excludedApartmentIds.has(item.apartmentId);
      if (isExcluded) {
        console.log(`  ❌ ${item.apartment.title} (will be hidden)`);
        excludedCount++;
      } else {
        console.log(`  ✅ ${item.apartment.title} (will be shown)`);
        shownCount++;
      }
    });
    
    console.log(`\n📊 Summary:`);
    console.log(`- Would show: ${shownCount} apartments`);
    console.log(`- Would hide: ${excludedCount} apartments`);
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testBrowseExclusion();