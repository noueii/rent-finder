#!/usr/bin/env tsx
/**
 * Standalone script to import Tokyo station data from JSON file
 * 
 * Usage:
 *   npx tsx scripts/import-station-data.ts
 *   
 * Options:
 *   --clear    Clear existing station data before import
 *   --verify   Run verification after import
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

// Parse command line arguments
const args = process.argv.slice(2);
const shouldClear = args.includes('--clear');
const shouldVerify = args.includes('--verify');

interface Route {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  operator: string;
  operator_full: string;
  color: string;
}

interface Station {
  id: string;
  name: string;
  name_en: string;
  name_ja: string;
  lat: number;
  lon: number;
  coordinates: number[];
  routes: Route[];
  operators: string[];
  lines: string[];
  platform_count: number;
}

interface StationData {
  metadata: any;
  stations: Station[];
}

async function clearExistingData() {
  console.log('🧹 Clearing existing station data...');
  
  // Clear in correct order to respect foreign key constraints
  await prisma.apartmentStation.deleteMany();
  await prisma.stationLine.deleteMany();
  await prisma.station.deleteMany();
  await prisma.trainLine.deleteMany();
  
  console.log('✅ Existing data cleared');
}

async function importStationData() {
  console.log('📍 Starting Tokyo station data import...\n');

  try {
    // Load JSON data
    const jsonPath = path.join(__dirname, '../docs/references/tokyo_stations_detailed.json');
    if (!fs.existsSync(jsonPath)) {
      throw new Error(`Station data file not found: ${jsonPath}`);
    }

    const jsonData: StationData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const stations = jsonData.stations;

    console.log(`📊 Found ${stations.length} stations in JSON file`);
    console.log(`📊 Metadata: ${JSON.stringify(jsonData.metadata, null, 2)}\n`);

    // Track progress
    const lineMap = new Map<string, any>();
    const stationMap = new Map<string, any>();
    let errors = 0;

    // Step 1: Extract and create unique train lines
    console.log('🚊 Processing train lines...');
    const uniqueLines = new Map<string, any>();
    
    stations.forEach((station) => {
      if (station.routes && Array.isArray(station.routes)) {
        station.routes.forEach((route) => {
          const lineKey = `${route.route_long_name}-${route.operator_full}`;
          if (!uniqueLines.has(lineKey)) {
            uniqueLines.set(lineKey, {
              name: route.route_long_name,
              nameEn: extractEnglishName(route.route_long_name),
              company: route.operator_full,
              color: route.color ? `#${route.color}` : null
            });
          }
        });
      }
    });

    console.log(`  Found ${uniqueLines.size} unique train lines`);

    // Create train lines with progress tracking
    console.log('\n🚊 Creating train lines in database...');
    let lineCount = 0;
    
    for (const [key, lineData] of uniqueLines) {
      try {
        const trainLine = await prisma.trainLine.create({
          data: lineData
        });
        lineMap.set(key, trainLine);
        lineCount++;
        
        if (lineCount % 20 === 0) {
          process.stdout.write(`\r  Created ${lineCount}/${uniqueLines.size} train lines...`);
        }
      } catch (error) {
        console.error(`\n  ❌ Error creating line ${key}:`, error);
        errors++;
      }
    }
    console.log(`\n  ✅ Created ${lineCount} train lines`);

    // Step 2: Create stations
    console.log('\n🚉 Creating stations in database...');
    let stationCount = 0;
    
    for (const station of stations) {
      try {
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
          process.stdout.write(`\r  Created ${stationCount}/${stations.length} stations...`);
        }
      } catch (error) {
        console.error(`\n  ❌ Error creating station ${station.name}:`, error);
        errors++;
      }
    }
    console.log(`\n  ✅ Created ${stationCount} stations`);

    // Step 3: Create station-line relationships
    console.log('\n🔗 Creating station-line relationships...');
    let relationCount = 0;
    let skippedRelations = 0;
    
    for (const station of stations) {
      if (station.routes && Array.isArray(station.routes)) {
        const stationRecord = stationMap.get(station.id);
        if (stationRecord) {
          for (let i = 0; i < station.routes.length; i++) {
            const route = station.routes[i];
            const lineKey = `${route.route_long_name}-${route.operator_full}`;
            const lineRecord = lineMap.get(lineKey);
            
            if (lineRecord) {
              try {
                await prisma.stationLine.create({
                  data: {
                    stationId: stationRecord.id,
                    lineId: lineRecord.id,
                    order: i // Use route index as order
                  }
                });
                relationCount++;
                
                if (relationCount % 100 === 0) {
                  process.stdout.write(`\r  Created ${relationCount} station-line relationships...`);
                }
              } catch (error) {
                // Skip duplicate relations
                skippedRelations++;
              }
            }
          }
        }
      }
    }
    console.log(`\n  ✅ Created ${relationCount} station-line relationships`);
    if (skippedRelations > 0) {
      console.log(`  ℹ️  Skipped ${skippedRelations} duplicate relationships`);
    }

    // Summary
    console.log('\n📊 Import Summary:');
    console.log(`  - Train Lines: ${lineCount}/${uniqueLines.size}`);
    console.log(`  - Stations: ${stationCount}/${stations.length}`);
    console.log(`  - Station-Line Relations: ${relationCount}`);
    console.log(`  - Errors: ${errors}`);

    return { success: true, errors };

  } catch (error) {
    console.error('\n❌ Fatal error during import:', error);
    return { success: false, errors: 1 };
  }
}

function extractEnglishName(bilingualName: string): string {
  // Extract English part from bilingual names like "JR常磐線各駅停車 JR Jōban Local Line"
  const parts = bilingualName.split(' ');
  const englishStart = parts.findIndex(part => /^[A-Za-z]/.test(part));
  
  if (englishStart !== -1) {
    return parts.slice(englishStart).join(' ');
  }
  
  return bilingualName;
}

async function verifyImport() {
  console.log('\n🔍 Verifying import...\n');

  const stationCount = await prisma.station.count();
  const trainLineCount = await prisma.trainLine.count();
  const stationLineCount = await prisma.stationLine.count();

  console.log('📊 Database counts:');
  console.log(`  - Stations: ${stationCount}`);
  console.log(`  - Train Lines: ${trainLineCount}`);
  console.log(`  - Station-Line Relations: ${stationLineCount}`);

  // Check for major stations
  console.log('\n🚉 Spot check - Major stations:');
  const majorStations = ['東京', '新宿', '渋谷', '池袋', '品川', '上野', '秋葉原'];
  
  for (const stationName of majorStations) {
    const station = await prisma.station.findFirst({
      where: {
        name: {
          contains: stationName
        }
      },
      include: {
        lines: true
      }
    });

    if (station) {
      console.log(`  ✅ ${stationName}: Found with ${station.lines.length} lines`);
    } else {
      console.log(`  ❌ ${stationName}: Not found`);
    }
  }

  // Check for orphaned records
  const stationsWithoutLines = await prisma.station.count({
    where: {
      lines: {
        none: {}
      }
    }
  });

  const linesWithoutStations = await prisma.trainLine.count({
    where: {
      stations: {
        none: {}
      }
    }
  });

  console.log('\n🔍 Data integrity:');
  console.log(`  - Stations without lines: ${stationsWithoutLines}`);
  console.log(`  - Lines without stations: ${linesWithoutStations}`);
}

async function main() {
  console.log('🚀 Tokyo Station Data Import Tool\n');

  try {
    if (shouldClear) {
      await clearExistingData();
      console.log('');
    }

    const result = await importStationData();

    if (shouldVerify && result.success) {
      await verifyImport();
    }

    console.log('\n✅ Import process completed!');
    process.exit(result.errors > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n❌ Unhandled error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the import
main();