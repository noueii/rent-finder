import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clear existing data
  console.log('🧹 Clearing existing data...');
  await prisma.apartmentStation.deleteMany();
  await prisma.apartmentList.deleteMany();
  await prisma.apartmentImage.deleteMany();
  await prisma.route.deleteMany();
  await prisma.apartment.deleteMany();
  await prisma.stationLine.deleteMany();
  await prisma.station.deleteMany();
  await prisma.trainLine.deleteMany();
  await prisma.searchSession.deleteMany();
  await prisma.list.deleteMany();
  await prisma.userPreference.deleteMany();
  await prisma.scrapingSource.deleteMany();

  // Import station data from tokyo_stations_detailed.json
  console.log('📍 Importing Tokyo station data...');
  const stationDataPath = path.join(__dirname, '../docs/references/tokyo_stations_detailed.json');
  const jsonData = JSON.parse(fs.readFileSync(stationDataPath, 'utf-8'));
  const stationData = jsonData.stations;

  console.log(`📊 Found ${stationData.length} stations in JSON file`);

  // Create train lines
  const lineMap = new Map<string, any>();
  const stationMap = new Map<string, any>();

  // First pass: collect unique lines from routes
  const uniqueLines = new Map<string, any>();
  stationData.forEach((station: any) => {
    if (station.routes && Array.isArray(station.routes)) {
      station.routes.forEach((route: any) => {
        const lineKey = `${route.route_long_name}-${route.operator_full}`;
        if (!uniqueLines.has(lineKey)) {
          uniqueLines.set(lineKey, {
            name: route.route_long_name,
            nameEn: route.route_long_name.split(' ').slice(-3).join(' '), // Extract English part
            company: route.operator_full,
            color: route.color ? `#${route.color}` : null
          });
        }
      });
    }
  });

  // Create train lines in database
  console.log(`📊 Creating ${uniqueLines.size} train lines...`);
  for (const [key, lineData] of uniqueLines) {
    const trainLine = await prisma.trainLine.create({
      data: lineData
    });
    lineMap.set(key, trainLine);
  }

  // Create stations
  console.log(`🚉 Creating ${stationData.length} stations...`);
  let stationCount = 0;
  for (const station of stationData) {
    const createdStation = await prisma.station.create({
      data: {
        name: station.name_ja || station.name,
        nameEn: station.name_en || null,
        latitude: station.lat,
        longitude: station.lon
      }
    });
    stationMap.set(station.id, createdStation);
    stationCount++;
    if (stationCount % 50 === 0) {
      console.log(`  Created ${stationCount} stations...`);
    }
  }

  // Create station-line relationships
  console.log('🔗 Creating station-line relationships...');
  let relationCount = 0;
  for (const station of stationData) {
    if (station.routes && Array.isArray(station.routes)) {
      const stationRecord = stationMap.get(station.id);
      if (stationRecord) {
        for (const route of station.routes) {
          const lineKey = `${route.route_long_name}-${route.operator_full}`;
          const lineRecord = lineMap.get(lineKey);
          if (lineRecord) {
            await prisma.stationLine.create({
              data: {
                stationId: stationRecord.id,
                lineId: lineRecord.id,
                order: 0 // We don't have order data, so defaulting to 0
              }
            });
            relationCount++;
          }
        }
      }
    }
    if (relationCount % 100 === 0 && relationCount > 0) {
      console.log(`  Created ${relationCount} station-line relationships...`);
    }
  }
  console.log(`  Total station-line relationships created: ${relationCount}`);

  // Create sample apartments for testing
  console.log('🏠 Creating sample apartments...');
  const sampleApartments = [
    {
      externalId: 'sample-001',
      sourceUrl: 'https://example.com/apartment-001',
      sourceSite: 'sample',
      title: 'Modern 1LDK near Shibuya Station',
      price: 150000,
      size: 45.5,
      layout: '1LDK',
      floor: 3,
      totalFloors: 8,
      buildingAge: 5,
      address: '東京都渋谷区渋谷1-2-3',
      area: '渋谷',
      ward: '渋谷区',
      city: '東京',
      prefecture: '東京都',
      latitude: 35.6595,
      longitude: 139.7005,
      description: 'Beautiful modern apartment with great access to Shibuya station. Recently renovated with new appliances.',
      amenities: ['Auto-lock', 'Elevator', 'Balcony', 'Air conditioning'],
      availability: 'available',
      nearbyStations: [
        { name: 'Shibuya Station', walkingMinutes: 5, lines: ['JY Yamanote Line', 'JB Saikyo Line'] },
        { name: 'Omotesando Station', walkingMinutes: 10, lines: ['G Ginza Line', 'Z Hanzomon Line'] }
      ],
      scrapedAt: new Date()
    },
    {
      externalId: 'sample-002',
      sourceUrl: 'https://example.com/apartment-002',
      sourceSite: 'sample',
      title: 'Cozy Studio in Nakameguro',
      price: 95000,
      size: 25.0,
      layout: '1K',
      floor: 2,
      totalFloors: 4,
      buildingAge: 15,
      address: '東京都目黒区上目黒2-3-4',
      area: '中目黒',
      ward: '目黒区',
      city: '東京',
      prefecture: '東京都',
      latitude: 35.6440,
      longitude: 139.6982,
      description: 'Compact but efficient studio apartment perfect for single living.',
      amenities: ['Bicycle parking', 'Air conditioning'],
      availability: 'available',
      nearbyStations: [
        { name: 'Nakameguro Station', walkingMinutes: 7, lines: ['H Hibiya Line', 'TY Toyoko Line'] }
      ],
      scrapedAt: new Date()
    },
    {
      externalId: 'sample-003',
      sourceUrl: 'https://example.com/apartment-003',
      sourceSite: 'sample',
      title: 'Spacious 2LDK Family Apartment',
      price: 220000,
      size: 65.0,
      layout: '2LDK',
      floor: 5,
      totalFloors: 10,
      buildingAge: 3,
      address: '東京都世田谷区三軒茶屋1-5-6',
      area: '三軒茶屋',
      ward: '世田谷区',
      city: '東京',
      prefecture: '東京都',
      latitude: 35.6435,
      longitude: 139.6681,
      description: 'Perfect for families, this spacious apartment features modern amenities and is close to parks and schools.',
      amenities: ['Auto-lock', 'Elevator', 'Balcony', 'Air conditioning', 'Floor heating', 'Parking space'],
      availability: 'available',
      nearbyStations: [
        { name: 'Sangenjaya Station', walkingMinutes: 3, lines: ['DT Den-en-toshi Line'] },
        { name: 'Komazawa-daigaku Station', walkingMinutes: 12, lines: ['DT Den-en-toshi Line'] }
      ],
      scrapedAt: new Date()
    }
  ];

  for (const apartmentData of sampleApartments) {
    const apartment = await prisma.apartment.create({
      data: apartmentData
    });

    // Add sample images
    await prisma.apartmentImage.createMany({
      data: [
        {
          apartmentId: apartment.id,
          url: `https://example.com/images/${apartment.externalId}-1.jpg`,
          caption: 'Living room',
          order: 1
        },
        {
          apartmentId: apartment.id,
          url: `https://example.com/images/${apartment.externalId}-2.jpg`,
          caption: 'Kitchen',
          order: 2
        }
      ]
    });

    // Link apartments to nearby stations (simplified - just finding closest stations)
    const nearbyStations = Array.from(stationMap.values())
      .filter(station => {
        const distance = Math.sqrt(
          Math.pow(station.latitude - apartment.latitude!, 2) +
          Math.pow(station.longitude - apartment.longitude!, 2)
        );
        return distance < 0.02; // Roughly 2km
      })
      .slice(0, 3); // Top 3 closest

    for (const station of nearbyStations) {
      const distance = Math.sqrt(
        Math.pow(station.latitude - apartment.latitude!, 2) +
        Math.pow(station.longitude - apartment.longitude!, 2)
      ) * 111000; // Convert to meters (rough approximation)
      
      await prisma.apartmentStation.create({
        data: {
          apartmentId: apartment.id,
          stationId: station.id,
          walkingMinutes: Math.round(distance / 80), // 80m per minute walking speed
          distance: Math.round(distance)
        }
      });
    }
  }

  // Create scraping sources
  console.log('🔧 Creating scraping sources...');
  await prisma.scrapingSource.createMany({
    data: [
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
    ]
  });

  console.log('✅ Database seed completed successfully!');
  console.log(`📊 Summary:
  - Train Lines: ${uniqueLines.size}
  - Stations: ${stationData.length}
  - Station-Line Relations: ${relationCount}
  - Sample Apartments: ${sampleApartments.length}
  - Scraping Sources: 7`);
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });