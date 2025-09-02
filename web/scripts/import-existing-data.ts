#!/usr/bin/env node
/**
 * Script to import existing scraped data from apts.jp and realestate.co.jp
 */

import { PrismaClient } from '@prisma/client';
import { dataImporter } from '../src/services/data-importer';
import { join } from 'path';

async function main() {
  const db = new PrismaClient();
  
  try {
    await db.$connect();
    console.log('Connected to database');

    // Import apts.jp data
    const aptsJpPath = join(__dirname, '../../apts.jp/listings.json');
    console.log('Importing apts.jp data...');
    console.log('Looking for file at:', aptsJpPath);
    
    try {
      const aptsResult = await dataImporter.importAptsJpData(aptsJpPath);
      console.log(`apts.jp import complete:`, aptsResult);
    } catch (error) {
      console.error('Failed to import apts.jp data:', error);
    }

    // Import realestate.co.jp data
    const realEstatePath = join(__dirname, '../../html-converter-realestate/output_listings.json');
    console.log('Importing realestate.co.jp data...');
    console.log('Looking for file at:', realEstatePath);
    
    try {
      const realEstateResult = await dataImporter.importRealEstateData(realEstatePath);
      console.log(`realestate.co.jp import complete:`, realEstateResult);
    } catch (error) {
      console.error('Failed to import realestate.co.jp data:', error);
    }

    // Display final statistics
    const totalApartments = await db.apartment.count();
    const totalStations = await db.station.count();
    
    console.log('\n=== Final Statistics ===');
    console.log(`Total apartments: ${totalApartments}`);
    console.log(`Total stations: ${totalStations}`);
    
    // Show apartments per site
    const aptsJpCount = await db.apartment.count({ where: { sourceSite: 'apts.jp' } });
    const realEstateCount = await db.apartment.count({ where: { sourceSite: 'realestate.co.jp' } });
    
    console.log(`apts.jp apartments: ${aptsJpCount}`);
    console.log(`realestate.co.jp apartments: ${realEstateCount}`);

    // Show price statistics
    const priceStats = await db.apartment.aggregate({
      _avg: { rentMonthly: true },
      _min: { rentMonthly: true },
      _max: { rentMonthly: true },
    });

    console.log('\n=== Price Statistics ===');
    console.log(`Average rent: ¥${Math.round(priceStats._avg.rentMonthly || 0).toLocaleString()}`);
    console.log(`Min rent: ¥${(priceStats._min.rentMonthly || 0).toLocaleString()}`);
    console.log(`Max rent: ¥${(priceStats._max.rentMonthly || 0).toLocaleString()}`);

    // Show size statistics
    const sizeStats = await db.apartment.aggregate({
      _avg: { size: true },
      _min: { size: true },
      _max: { size: true },
    });

    console.log('\n=== Size Statistics ===');
    console.log(`Average size: ${Math.round(sizeStats._avg.size || 0)}m²`);
    console.log(`Min size: ${sizeStats._min.size || 0}m²`);
    console.log(`Max size: ${sizeStats._max.size || 0}m²`);

    // Show layout distribution
    const layoutStats = await db.apartment.groupBy({
      by: ['layout'],
      _count: true,
      orderBy: { _count: { layout: 'desc' } },
      take: 10,
    });

    console.log('\n=== Layout Distribution (Top 10) ===');
    layoutStats.forEach(stat => {
      console.log(`${stat.layout}: ${stat._count} apartments`);
    });

    // Show station distribution
    const stationStats = await db.apartment.groupBy({
      by: ['stationId'],
      _count: true,
      orderBy: { _count: { stationId: 'desc' } },
      take: 10,
    });

    console.log('\n=== Top 10 Stations by Apartment Count ===');
    for (const stat of stationStats) {
      const station = await db.station.findUnique({
        where: { id: stat.stationId },
        select: { name: true, nameJa: true },
      });
      console.log(`${station?.name || 'Unknown'} (${station?.nameJa || ''}): ${stat._count} apartments`);
    }

    console.log('\n✅ Data import complete!');

  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

// Run the script
main().catch(console.error);