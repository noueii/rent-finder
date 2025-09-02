#!/usr/bin/env tsx
/**
 * Test the list type toggle functionality
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function testListToggles() {
  try {
    // Get a user
    const user = await prisma.user.findFirst({});
    
    if (!user) {
      console.log("No user found");
      return;
    }
    
    console.log(`\n🔍 Testing list toggles for user: ${user.email}\n`);
    
    // Get a regular list (not LIKED/HIDDEN/etc)
    const list = await prisma.list.findFirst({
      where: { 
        userId: user.id,
        type: { notIn: ["LIKED", "HIDDEN", "BOOKMARKED", "FAVORITED"] },
      },
      include: { _count: { select: { apartments: true } } },
    });
    
    if (!list) {
      console.log("No suitable list found");
      return;
    }
    
    console.log(`📋 Testing with list: "${list.name}" (${list._count.apartments} apartments)\n`);
    
    // Get user's special lists
    const [likedList, hiddenList, bookmarkedList, favoritedList] = await Promise.all([
      prisma.list.findFirst({
        where: { userId: user.id, type: "LIKED" },
        include: { _count: { select: { apartments: true } } },
      }),
      prisma.list.findFirst({
        where: { userId: user.id, type: "HIDDEN" },
        include: { _count: { select: { apartments: true } } },
      }),
      prisma.list.findFirst({
        where: { userId: user.id, type: "BOOKMARKED" },
        include: { _count: { select: { apartments: true } } },
      }),
      prisma.list.findFirst({
        where: { userId: user.id, type: "FAVORITED" },
        include: { _count: { select: { apartments: true } } },
      }),
    ]);
    
    console.log(`📂 User's special lists:`);
    console.log(`- Liked: ${likedList ? `${likedList._count.apartments} apartments` : "None"}`);
    console.log(`- Hidden: ${hiddenList ? `${hiddenList._count.apartments} apartments` : "None"}`);
    console.log(`- Bookmarked: ${bookmarkedList ? `${bookmarkedList._count.apartments} apartments` : "None"}`);
    console.log(`- Favorited: ${favoritedList ? `${favoritedList._count.apartments} apartments` : "None"}\n`);
    
    // Get apartments in the test list
    const listApartments = await prisma.apartmentList.findMany({
      where: { listId: list.id },
      include: { apartment: { select: { id: true, title: true } } },
      take: 10,
    });
    
    // Check which apartments are also in special lists
    const specialListIds = [likedList?.id, hiddenList?.id, bookmarkedList?.id, favoritedList?.id].filter(Boolean) as string[];
    
    if (specialListIds.length === 0) {
      console.log("No special lists found, all apartments would be visible");
      return;
    }
    
    const apartmentsInSpecialLists = await prisma.apartmentList.groupBy({
      by: ['apartmentId', 'listId'],
      where: {
        listId: { in: specialListIds },
        apartmentId: { in: listApartments.map(la => la.apartmentId) },
      },
    });
    
    // Map apartment to list types
    const apartmentListTypes = new Map<string, Set<string>>();
    apartmentsInSpecialLists.forEach(item => {
      const types = apartmentListTypes.get(item.apartmentId) || new Set();
      if (item.listId === likedList?.id) types.add('LIKED');
      if (item.listId === hiddenList?.id) types.add('HIDDEN');
      if (item.listId === bookmarkedList?.id) types.add('BOOKMARKED');
      if (item.listId === favoritedList?.id) types.add('FAVORITED');
      apartmentListTypes.set(item.apartmentId, types);
    });
    
    console.log(`🏠 Sample apartments and their visibility:\n`);
    listApartments.forEach(la => {
      const types = apartmentListTypes.get(la.apartmentId);
      if (types && types.size > 0) {
        console.log(`${la.apartment.title}`);
        console.log(`  Also in: ${Array.from(types).join(', ')}`);
        console.log(`  Visible when:`);
        console.log(`    - Show Hidden OFF: ${types.has('HIDDEN') ? '❌' : '✅'}`);
        console.log(`    - Show Liked ON: ${types.has('LIKED') ? '✅' : 'N/A'}`);
        console.log(`    - Show Bookmarked ON: ${types.has('BOOKMARKED') ? '✅' : 'N/A'}`);
        console.log(`    - Show Favorited ON: ${types.has('FAVORITED') ? '✅' : 'N/A'}`);
      } else {
        console.log(`${la.apartment.title} - Always visible ✅`);
      }
      console.log('');
    });
    
    // Count how many would be hidden with default settings
    const hiddenByDefault = Array.from(apartmentListTypes.values()).filter(types => types.has('HIDDEN')).length;
    console.log(`📊 With default settings (Hidden OFF):`);
    console.log(`- ${hiddenByDefault} apartments would be hidden`);
    console.log(`- ${listApartments.length - hiddenByDefault} apartments would be visible`);
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testListToggles();