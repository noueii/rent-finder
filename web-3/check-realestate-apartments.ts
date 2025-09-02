import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkRealEstateApartments() {
  try {
    // Count total apartments
    const total = await prisma.apartment.count();
    console.log(`\n📊 Total apartments in database: ${total}`);
    
    // Count RealEstate apartments
    const realEstateCount = await prisma.apartment.count({
      where: {
        sourceUrl: {
          contains: 'realestate.co.jp'
        }
      }
    });
    
    console.log(`🏠 RealEstate apartments: ${realEstateCount}`);
    
    // Get latest RealEstate apartments
    const latestRealEstate = await prisma.apartment.findMany({
      where: {
        sourceUrl: {
          contains: 'realestate.co.jp'
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    });
    
    if (latestRealEstate.length > 0) {
      console.log('\n📅 Latest RealEstate apartments:');
      latestRealEstate.forEach((apt, i) => {
        console.log(`${i + 1}. ${apt.title || 'No title'}`);
        console.log(`   ID: ${apt.externalId}`);
        console.log(`   Rent: ¥${apt.price?.toLocaleString()}`);
        console.log(`   Created: ${apt.createdAt.toISOString()}`);
        console.log(`   URL: ${apt.sourceUrl}\n`);
      });
    } else {
      console.log('\n❌ No RealEstate apartments found in database');
    }
    
    // Check recent job status (if job table exists)
    // Comment out for now as job table might not exist
    /*
    const recentJobs = await prisma.job.findMany({
      where: {
        type: 'update-apartments',
        data: {
          path: ['scraperType'],
          equals: 'realestate'
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    });
    
    console.log(`\n📋 Recent RealEstate jobs: ${recentJobs.length}`);
    recentJobs.forEach((job, i) => {
      console.log(`${i + 1}. Status: ${job.status}, Created: ${job.createdAt.toISOString()}`);
      if (job.result) {
        console.log(`   Result: ${JSON.stringify(job.result).substring(0, 100)}...`);
      }
    });
    */
    
  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRealEstateApartments();