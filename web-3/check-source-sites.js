import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkSourceSites() {
  try {
    // Get distinct sourceSite values
    const sourceSites = await prisma.apartment.groupBy({
      by: ['sourceSite'],
      _count: {
        sourceSite: true,
      },
    });

    console.log('Source Sites in Database:');
    console.log('========================');
    sourceSites.forEach(site => {
      console.log(`${site.sourceSite}: ${site._count.sourceSite} apartments`);
    });

    // Check apartments without coordinates
    console.log('\nApartments without coordinates:');
    console.log('==============================');
    
    for (const site of sourceSites) {
      const count = await prisma.apartment.count({
        where: {
          sourceSite: site.sourceSite,
          OR: [
            { latitude: null },
            { longitude: null },
          ],
        },
      });
      if (count > 0) {
        console.log(`${site.sourceSite}: ${count} apartments without coordinates`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSourceSites();