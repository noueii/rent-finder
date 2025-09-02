#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function importStations() {
  try {
    // Read the transit graph
    const graphPath = path.join(__dirname, '../../lines/tokyo_transit_graph_complete.json');
    const graphData = JSON.parse(fs.readFileSync(graphPath, 'utf-8'));
    
    console.log(`Found ${Object.keys(graphData.stations).length} stations to import`);
    
    let imported = 0;
    let updated = 0;
    let failed = 0;
    
    // Import each station
    for (const [stationId, stationData] of Object.entries(graphData.stations as Record<string, any>)) {
      try {
        // Check if station already exists
        const existing = await prisma.station.findUnique({
          where: { id: stationId }
        });
        
        const stationRecord = {
          id: stationId,
          name: stationData.name,
          nameJa: stationData.name_ja || stationData.name,
          lines: JSON.stringify(stationData.lines || []),
          transfers: JSON.stringify(stationData.transfers || []),
          latitude: stationData.coordinates?.[1] || null,
          longitude: stationData.coordinates?.[0] || null,
        };
        
        if (existing) {
          // Update existing station
          await prisma.station.update({
            where: { id: stationId },
            data: stationRecord,
          });
          updated++;
        } else {
          // Create new station
          await prisma.station.create({
            data: stationRecord,
          });
          imported++;
        }
        
        if ((imported + updated) % 50 === 0) {
          console.log(`Progress: ${imported} imported, ${updated} updated`);
        }
      } catch (error) {
        console.error(`Failed to import station ${stationId}:`, error);
        failed++;
      }
    }
    
    console.log('\n✅ Station import complete:');
    console.log(`   - Imported: ${imported}`);
    console.log(`   - Updated: ${updated}`);
    console.log(`   - Failed: ${failed}`);
    console.log(`   - Total stations in database: ${await prisma.station.count()}`);
    
  } catch (error) {
    console.error('Fatal error during import:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the import
importStations();