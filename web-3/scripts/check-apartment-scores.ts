#!/usr/bin/env tsx
/**
 * Check how many apartments meet current target values
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkScores() {
  const targetPrice = 100000;
  const targetSize = 35;
  const targetCommute = 20;
  
  console.log(`\nChecking apartments against your targets:`);
  console.log(`- Price: ¥${targetPrice.toLocaleString()} or less`);
  console.log(`- Size: ${targetSize}m² or more`);
  console.log(`- Commute: ${targetCommute} minutes or less\n`);

  // Count apartments meeting price target
  const meetingPrice = await prisma.apartment.count({
    where: { price: { lte: targetPrice } }
  });
  const totalWithPrice = await prisma.apartment.count({
    where: { price: { gt: 0 } }
  });
  
  // Count apartments meeting size target
  const meetingSize = await prisma.apartment.count({
    where: { size: { gte: targetSize } }
  });
  const totalWithSize = await prisma.apartment.count({
    where: { size: { gt: 0 } }
  });
  
  // Count routes meeting commute target
  const meetingCommute = await prisma.route.count({
    where: { duration: { lte: targetCommute } }
  });
  const totalRoutes = await prisma.route.count();

  console.log(`📊 RESULTS:`);
  console.log(`Price: ${meetingPrice}/${totalWithPrice} apartments (${(meetingPrice/totalWithPrice*100).toFixed(1)}%) meet target`);
  console.log(`Size: ${meetingSize}/${totalWithSize} apartments (${(meetingSize/totalWithSize*100).toFixed(1)}%) meet target`);
  console.log(`Commute: ${meetingCommute}/${totalRoutes} routes (${(meetingCommute/totalRoutes*100).toFixed(1)}%) meet target\n`);

  // Show some examples of apartments that would score 100%
  const perfectApartments = await prisma.apartment.findMany({
    where: {
      AND: [
        { price: { lte: targetPrice } },
        { size: { gte: targetSize } }
      ]
    },
    take: 5,
    orderBy: { price: 'asc' }
  });

  console.log(`Examples of apartments that score 100% on price & size:`);
  perfectApartments.forEach(apt => {
    console.log(`- ¥${apt.price?.toLocaleString()}/mo, ${apt.size}m² - ${apt.title}`);
  });

  await prisma.$disconnect();
}

checkScores();