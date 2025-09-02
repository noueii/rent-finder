import { PrismaClient } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';

const prisma = new PrismaClient();

interface StationData {
  line: string;
  operator: string;
  navitime_id: string;
  stations: Array<{
    name: string;
    japanese_name: string;
    station_id: string;
    order: number;
    transfers: string[];
  }>;
}

async function main() {
  console.log('🌱 Starting database seed...');

  try {
    // Load station data from the existing JSON file
    const stationDataPath = path.join(__dirname, '..', 'lines', 'station_data.json');
    const stationDataRaw = await fs.readFile(stationDataPath, 'utf-8');
    const stationData: StationData[] = JSON.parse(stationDataRaw);

    console.log(`📊 Found ${stationData.length} train lines to process`);

    // Track unique stations (same station can appear on multiple lines)
    const uniqueStations = new Map<string, {
      name: string;
      nameJa: string;
      lines: Set<string>;
      transfers: Set<string>;
    }>();

    // Process all stations from all lines
    for (const line of stationData) {
      for (const station of line.stations) {
        if (!uniqueStations.has(station.station_id)) {
          uniqueStations.set(station.station_id, {
            name: station.name,
            nameJa: station.japanese_name,
            lines: new Set([line.line]),
            transfers: new Set(station.transfers)
          });
        } else {
          const existing = uniqueStations.get(station.station_id)!;
          existing.lines.add(line.line);
          station.transfers.forEach(t => existing.transfers.add(t));
        }
      }
    }

    console.log(`🚉 Found ${uniqueStations.size} unique stations`);

    // Clear existing stations (for clean re-seeding)
    await prisma.station.deleteMany();
    console.log('🧹 Cleared existing station data');

    // Insert all stations
    const stationPromises = Array.from(uniqueStations.entries()).map(
      async ([stationId, stationInfo]) => {
        return prisma.station.create({
          data: {
            id: stationId,
            name: stationInfo.name,
            nameJa: stationInfo.nameJa,
            lines: JSON.stringify(Array.from(stationInfo.lines)),
            transfers: JSON.stringify(Array.from(stationInfo.transfers).filter(t => t.length > 0))
          }
        });
      }
    );

    // Process in batches to avoid overwhelming the database
    const batchSize = 50;
    for (let i = 0; i < stationPromises.length; i += batchSize) {
      const batch = stationPromises.slice(i, i + batchSize);
      await Promise.all(batch);
      console.log(`✅ Inserted stations ${i + 1} to ${Math.min(i + batchSize, stationPromises.length)}`);
    }

    // Add sample apartment data for testing (optional)
    if (process.env.SEED_SAMPLE_DATA === 'true') {
      console.log('🏠 Adding sample apartment data...');
      
      // Load sample data from apts.jp scraper output
      const listingsPath = path.join(__dirname, '..', 'apts.jp', 'listings.json');
      try {
        const listingsRaw = await fs.readFile(listingsPath, 'utf-8');
        const listings = JSON.parse(listingsRaw);
        
        // Get a few stations for sample data
        const sampleStations = await prisma.station.findMany({
          where: {
            name: {
              in: ['Shibuya', 'Shinjuku', 'Tokyo', 'Ikebukuro']
            }
          }
        });

        if (sampleStations.length > 0) {
          // Create sample apartments (take first 20 from listings)
          const sampleListings = listings.slice(0, 20);
          
          for (const listing of sampleListings) {
            // Pick a random station from our sample stations
            const randomStation = sampleStations[Math.floor(Math.random() * sampleStations.length)];
            
            await prisma.apartment.create({
              data: {
                sourceUrl: listing.url,
                sourceSite: 'apts.jp',
                title: `${listing.building_name} ${listing.unit_number}`,
                buildingName: listing.building_name,
                unitNumber: listing.unit_number,
                rentMonthly: listing.rawRent,
                size: parseFloat(listing.area_m2),
                layout: listing.bedroom,
                prefecture: listing.prefecture,
                city: listing.city,
                address: listing.address,
                features: listing.features ? listing.features.split(' · ') : [],
                stationId: randomStation.id,
                walkingMinutes: listing.station_distance_min || 10,
                imageUrls: []
              }
            });
          }
          
          console.log('✅ Added sample apartment data');
        }
      } catch (error) {
        console.log('⚠️  Could not load sample apartment data:', error);
      }
    }

    console.log('🎉 Database seed completed successfully!');
    
    // Print some statistics
    const stationCount = await prisma.station.count();
    const apartmentCount = await prisma.apartment.count();
    
    console.log('\n📈 Database statistics:');
    console.log(`   - Stations: ${stationCount}`);
    console.log(`   - Apartments: ${apartmentCount}`);
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });