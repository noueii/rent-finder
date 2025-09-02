import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSourceSite() {
  const apartment = await prisma.apartment.findFirst({
    where: {
      externalId: '742',
      sourceUrl: { contains: 'realestate.co.jp' }
    }
  });
  
  console.log('Apartment with externalId 742:', apartment ? {
    id: apartment.id,
    externalId: apartment.externalId,
    sourceSite: apartment.sourceSite,
    sourceUrl: apartment.sourceUrl,
    title: apartment.title
  } : 'Not found');
  
  // Check what sourceSite values exist
  const sourceSites = await prisma.apartment.groupBy({
    by: ['sourceSite'],
    where: {
      sourceUrl: { contains: 'realestate.co.jp' }
    },
    _count: true
  });
  
  console.log('\nRealEstate sourceSite values:');
  sourceSites.forEach(s => {
    console.log(`  "${s.sourceSite}": ${s._count} apartments`);
  });
  
  await prisma.$disconnect();
}

checkSourceSite();
