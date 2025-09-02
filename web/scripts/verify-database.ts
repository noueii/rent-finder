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

async function verifyDatabase() {
  console.log('🔍 Verifying database integrity...');
  
  try {
    // Load original station data
    const stationDataPath = path.join(__dirname, '..', '..', 'lines', 'station_data.json');
    const stationDataRaw = await fs.readFile(stationDataPath, 'utf-8');
    const originalStationData: StationData[] = JSON.parse(stationDataRaw);
    
    // Get all unique stations from original data
    const originalStations = new Map<string, {
      name: string;
      nameJa: string;
      lines: Set<string>;
      transfers: Set<string>;
    }>();
    
    for (const line of originalStationData) {
      for (const station of line.stations) {
        if (!originalStations.has(station.station_id)) {
          originalStations.set(station.station_id, {
            name: station.name,
            nameJa: station.japanese_name,
            lines: new Set([line.line]),
            transfers: new Set(station.transfers)
          });
        } else {
          const existing = originalStations.get(station.station_id)!;
          existing.lines.add(line.line);
          station.transfers.forEach(t => existing.transfers.add(t));
        }
      }
    }
    
    // Get all stations from database
    const dbStations = await prisma.station.findMany({
      select: {
        id: true,
        name: true,
        nameJa: true,
        lines: true,
        transfers: true
      }
    });
    
    console.log(`📊 Original data: ${originalStations.size} unique stations`);
    console.log(`📊 Database: ${dbStations.length} stations`);
    
    // Verify counts match
    if (originalStations.size !== dbStations.length) {
      console.error('❌ Station count mismatch!');
      return false;
    }
    
    // Verify each station exists and has correct data
    let errors = 0;
    for (const [stationId, originalData] of originalStations) {
      const dbStation = dbStations.find(s => s.id === stationId);
      
      if (!dbStation) {
        console.error(`❌ Station ${stationId} (${originalData.name}) not found in database`);
        errors++;
        continue;
      }
      
      // Verify basic info
      if (dbStation.name !== originalData.name) {
        console.error(`❌ Station ${stationId}: name mismatch. Expected: ${originalData.name}, Got: ${dbStation.name}`);
        errors++;
      }
      
      if (dbStation.nameJa !== originalData.nameJa) {
        console.error(`❌ Station ${stationId}: Japanese name mismatch. Expected: ${originalData.nameJa}, Got: ${dbStation.nameJa}`);
        errors++;
      }
      
      // Verify lines
      const dbLines = JSON.parse(dbStation.lines);
      const originalLines = Array.from(originalData.lines).sort();
      const sortedDbLines = dbLines.sort();
      
      if (JSON.stringify(originalLines) !== JSON.stringify(sortedDbLines)) {
        console.error(`❌ Station ${stationId}: lines mismatch`);
        console.error(`   Original: ${JSON.stringify(originalLines)}`);
        console.error(`   Database: ${JSON.stringify(sortedDbLines)}`);
        errors++;
      }
      
      // Verify transfers
      const dbTransfers = JSON.parse(dbStation.transfers || '[]');
      const originalTransfers = Array.from(originalData.transfers).filter(t => t.length > 0).sort();
      const sortedDbTransfers = dbTransfers.sort();
      
      if (JSON.stringify(originalTransfers) !== JSON.stringify(sortedDbTransfers)) {
        console.error(`❌ Station ${stationId}: transfers mismatch`);
        console.error(`   Original: ${JSON.stringify(originalTransfers)}`);
        console.error(`   Database: ${JSON.stringify(sortedDbTransfers)}`);
        errors++;
      }
    }
    
    if (errors === 0) {
      console.log('✅ All stations verified successfully!');
      
      // Test some specific stations that should exist
      const testStations = ['00006668', '00004464', '00002705']; // Tokyo, Kanda, Shibuya
      console.log('\n🔍 Testing specific stations:');
      
      for (const stationId of testStations) {
        const station = await prisma.station.findUnique({
          where: { id: stationId }
        });
        
        if (station) {
          console.log(`✅ Station ${stationId}: ${station.name} (${station.nameJa})`);
          const lines = JSON.parse(station.lines);
          console.log(`   Lines: ${lines.join(', ')}`);
        } else {
          console.error(`❌ Test station ${stationId} not found`);
        }
      }
      
      return true;
    } else {
      console.error(`❌ Found ${errors} errors in station data`);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error verifying database:', error);
    return false;
  }
}

// Test database operations
async function testOperations() {
  console.log('\n🧪 Testing database operations...');
  
  try {
    // Test station search
    const tokyoStations = await prisma.station.findMany({
      where: {
        name: { contains: 'Tokyo' }
      }
    });
    console.log(`✅ Found ${tokyoStations.length} stations containing 'Tokyo'`);
    
    // Test apartment count
    const apartmentCount = await prisma.apartment.count();
    console.log(`✅ Found ${apartmentCount} apartments in database`);
    
    // Test health check
    const health = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Database health check passed');
    
    return true;
  } catch (error) {
    console.error('❌ Error testing database operations:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Database Verification Script');
  console.log('================================');
  
  const verificationPassed = await verifyDatabase();
  const operationsPassed = await testOperations();
  
  if (verificationPassed && operationsPassed) {
    console.log('\n🎉 Database verification completed successfully!');
    process.exit(0);
  } else {
    console.log('\n❌ Database verification failed!');
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });