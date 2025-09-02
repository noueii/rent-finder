import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Adding new scraping sources...');
  
  const newScrapers = [
    {
      name: 'RealEstate.co.jp',
      type: 'realestate',
      baseUrl: 'https://realestate.co.jp',
      searchUrlTemplate: 'https://realestate.co.jp/en/rent?prefecture=JP-13&search=Search',
      detailUrlPattern: 'https://realestate.co.jp/en/rent/view/\\d+',
      selectors: {
        title: '.property-title',
        price: '.price-amount',
        size: '.property-size',
        layout: '.layout-type',
        address: '.property-address'
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RentFinder/1.0)'
      },
      rateLimit: 2000,
      isActive: true
    },
    {
      name: 'YOLO Japan Home',
      type: 'yolo-japan',
      baseUrl: 'https://home.yolo-japan.com',
      searchUrlTemplate: 'https://home.yolo-japan.com/en/tokyo/list?perPage=50&page=1',
      detailUrlPattern: 'https://home.yolo-japan.com/en/property/\\d+',
      selectors: {
        title: '.property-title',
        price: '.price-value',
        size: '.property-area',
        layout: '.room-type',
        address: '.property-address'
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RentFinder/1.0)'
      },
      rateLimit: 2000,
      isActive: true
    },
    {
      name: 'Wagaya Japan',
      type: 'wagaya-japan',
      baseUrl: 'https://wagaya-japan.com',
      searchUrlTemplate: 'https://wagaya-japan.com/en/rent/tokyo/list/',
      detailUrlPattern: 'https://wagaya-japan.com/en/chintai_detail.php\\?id=\\d+',
      selectors: {
        title: '.property-title',
        price: '.price-amount',
        size: '.property-size',
        layout: '.room-layout',
        address: '.property-address'
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RentFinder/1.0)'
      },
      rateLimit: 2000,
      isActive: true
    },
    {
      name: 'E-Housing',
      type: 'e-housing',
      baseUrl: 'https://e-housing.jp',
      searchUrlTemplate: 'https://e-housing.jp/rent',
      detailUrlPattern: 'https://e-housing.jp/rent/tokyo/.*/\\d+',
      selectors: {
        title: '.property-title',
        price: '.price-value',
        size: '.area-value',
        layout: '.layout-info',
        address: '.property-address'
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RentFinder/1.0)'
      },
      rateLimit: 2000,
      isActive: true
    },
    {
      name: 'Japan Property',
      type: 'japan-property',
      baseUrl: 'https://www.japan-property.jp',
      searchUrlTemplate: 'https://www.japan-property.jp/apartment-for-rent/Tokyo/23wards',
      detailUrlPattern: 'https://www.japan-property.jp/apartment-property-for-rent-in-tokyo-R\\d+',
      selectors: {
        title: '.property-title',
        price: '.price-amount',
        size: '.property-size',
        layout: '.layout-type',
        address: '.property-address'
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RentFinder/1.0)'
      },
      rateLimit: 2000,
      isActive: true
    },
    {
      name: 'Metro Residences',
      type: 'metro-residences',
      baseUrl: 'https://www.metroresidences.com',
      searchUrlTemplate: 'https://www.metroresidences.com/jp-en/apartment-rental/',
      detailUrlPattern: 'https://www.metroresidences.com/jp-en/apartment-rental/tokyo/.*/\\d+',
      selectors: {
        title: '.property-title',
        price: '.price-value',
        size: '.property-size',
        layout: '.layout-info',
        address: '.property-address'
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RentFinder/1.0)'
      },
      rateLimit: 2000,
      isActive: true
    },
    {
      name: 'Hmlet Japan',
      type: 'hmlet-japan',
      baseUrl: 'https://hmletjapan.com',
      searchUrlTemplate: 'https://hmletjapan.com/en/property/n/shibuya,shinjuku,central,asakusa,ikebukuro,shinagawa',
      detailUrlPattern: 'https://hmletjapan.com/en/property/\\d+/units/\\d+/detail',
      selectors: {
        title: '.property-title',
        price: '.price-display',
        size: '.unit-size',
        layout: '.room-layout',
        address: '.property-location'
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RentFinder/1.0)'
      },
      rateLimit: 2000,
      isActive: true
    }
  ];

  // Add new scrapers
  for (const scraper of newScrapers) {
    try {
      await prisma.scrapingSource.create({
        data: scraper
      });
      console.log(`✅ Added ${scraper.name}`);
    } catch (error: any) {
      if (error.code === 'P2002') {
        console.log(`⏭️  ${scraper.name} already exists, skipping...`);
      } else {
        console.error(`❌ Error adding ${scraper.name}:`, error);
      }
    }
  }

  console.log('✅ All scrapers added successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });