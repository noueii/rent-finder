import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyStationImport() {
  console.log('🔍 Verifying station data import...\n');

  try {
    // Count records
    const stationCount = await prisma.station.count();
    const trainLineCount = await prisma.trainLine.count();
    const stationLineCount = await prisma.stationLine.count();

    console.log('📊 Record counts:');
    console.log(`  - Stations: ${stationCount}`);
    console.log(`  - Train Lines: ${trainLineCount}`);
    console.log(`  - Station-Line Relations: ${stationLineCount}`);

    // Sample some stations
    console.log('\n📍 Sample stations:');
    const sampleStations = await prisma.station.findMany({
      take: 5,
      include: {
        lines: {
          include: {
            line: true
          }
        }
      }
    });

    for (const station of sampleStations) {
      console.log(`\n  Station: ${station.name} (${station.nameEn})`);
      console.log(`  Location: ${station.latitude}, ${station.longitude}`);
      console.log(`  Lines:`);
      for (const stationLine of station.lines) {
        console.log(`    - ${stationLine.line.name} (${stationLine.line.company})`);
      }
    }

    // Check for stations without lines
    const stationsWithoutLines = await prisma.station.findMany({
      where: {
        lines: {
          none: {}
        }
      },
      take: 5
    });

    if (stationsWithoutLines.length > 0) {
      console.log(`\n⚠️  Found ${stationsWithoutLines.length} stations without lines:`);
      stationsWithoutLines.forEach(s => console.log(`  - ${s.name}`));
    }

    // Check for major stations
    console.log('\n🚉 Checking major stations:');
    const majorStations = ['新宿', '渋谷', '東京', '池袋', '品川'];
    for (const stationName of majorStations) {
      const station = await prisma.station.findFirst({
        where: {
          name: {
            contains: stationName
          }
        },
        include: {
          lines: {
            include: {
              line: true
            }
          }
        }
      });

      if (station) {
        console.log(`  ✅ ${stationName}: Found with ${station.lines.length} lines`);
      } else {
        console.log(`  ❌ ${stationName}: Not found`);
      }
    }

    // Check unique train lines
    console.log('\n🚊 Sample train lines:');
    const sampleLines = await prisma.trainLine.findMany({
      take: 10,
      include: {
        stations: {
          take: 3
        }
      }
    });

    for (const line of sampleLines) {
      console.log(`  - ${line.name} (${line.company}) - ${line.stations.length} stations linked`);
    }

    console.log('\n✅ Verification complete!');

  } catch (error) {
    console.error('❌ Error during verification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyStationImport();