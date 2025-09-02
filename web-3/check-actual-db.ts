import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDB() {
  // First, let's see if apartment with externalId 742 exists
  const byExternalId = await prisma.apartment.findMany({
    where: { externalId: '742' }
  });
  
  console.log(`\nApartments with externalId '742': ${byExternalId.length}`);
  if (byExternalId.length > 0) {
    byExternalId.forEach(apt => {
      console.log(`- ID: ${apt.id}, Source: ${apt.sourceSite}, URL: ${apt.sourceUrl}`);
    });
  }
  
  // Let's check the recent RealEstate apartments
  const recent = await prisma.apartment.findMany({
    where: { 
      sourceUrl: { contains: 'realestate.co.jp' }
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  
  console.log('\nMost recent RealEstate apartments:');
  recent.forEach(apt => {
    console.log(`- External ID: ${apt.externalId}, DB ID: ${apt.id}`);
    console.log(`  URL: ${apt.sourceUrl}`);
  });
  
  await prisma.$disconnect();
}

checkDB();
