import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Removing example scrapers...');
  
  try {
    // Delete SUUMO scraper
    const suumoResult = await prisma.scrapingSource.deleteMany({
      where: { 
        OR: [
          { name: 'SUUMO' },
          { type: 'suumo' }
        ]
      }
    });
    
    if (suumoResult.count > 0) {
      console.log(`✅ Removed ${suumoResult.count} SUUMO scraper(s)`);
    } else {
      console.log('⏭️  SUUMO scraper not found');
    }
    
    // Delete Homes scraper
    const homesResult = await prisma.scrapingSource.deleteMany({
      where: { 
        OR: [
          { name: 'Homes' },
          { type: 'homes' }
        ]
      }
    });
    
    if (homesResult.count > 0) {
      console.log(`✅ Removed ${homesResult.count} Homes scraper(s)`);
    } else {
      console.log('⏭️  Homes scraper not found');
    }
    
    console.log('✅ Cleanup completed!');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });