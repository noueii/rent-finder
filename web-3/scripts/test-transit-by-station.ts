#!/usr/bin/env tsx
/**
 * Test transit route between two stations by name
 * Usage: npm run test-transit-station -- --from "Shinjuku" --to "Shibuya"
 */

import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const params: { from?: string; to?: string; output?: string; endpoint?: string } = {};
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace('--', '');
    const value = args[i + 1];
    if (key && value) {
      params[key as keyof typeof params] = value;
    }
  }
  
  return params;
}

// Find station by name
async function findStation(name: string) {
  // Try exact match first
  let station = await prisma.station.findFirst({
    where: { 
      OR: [
        { name: { equals: name } },
        { nameEn: { equals: name, mode: 'insensitive' } }
      ]
    }
  });
  
  // Try partial match
  if (!station) {
    station = await prisma.station.findFirst({
      where: { 
        OR: [
          { name: { contains: name } },
          { nameEn: { contains: name, mode: 'insensitive' } }
        ]
      }
    });
  }
  
  return station;
}

// Main function
async function testTransitByStation() {
  const args = parseArgs();
  
  // Validate arguments
  if (!args.from || !args.to) {
    console.error('❌ Missing required arguments');
    console.log('\nUsage:');
    console.log('  npm run test-transit-station -- --from "StationName" --to "StationName" [--output file.json]');
    console.log('\nExample:');
    console.log('  npm run test-transit-station -- --from "Shinjuku" --to "Shibuya"');
    console.log('  npm run test-transit-station -- --from "新宿" --to "渋谷"');
    console.log('\nOptions:');
    console.log('  --from     Starting station name (English or Japanese)');
    console.log('  --to       Destination station name (English or Japanese)');
    console.log('  --output   Output JSON file (default: transit-route-[from]-[to].json)');
    console.log('  --endpoint OTP endpoint URL (default: http://localhost:8080/otp/routers/default)');
    process.exit(1);
  }
  
  try {
    console.log('\n🚉 Finding stations...');
    
    // Find stations
    const [fromStation, toStation] = await Promise.all([
      findStation(args.from),
      findStation(args.to)
    ]);
    
    if (!fromStation) {
      console.error(`❌ Station not found: "${args.from}"`);
      // Suggest similar stations
      const suggestions = await prisma.station.findMany({
        where: { 
          OR: [
            { name: { contains: args.from.substring(0, 2) } },
            { nameEn: { contains: args.from.substring(0, 2), mode: 'insensitive' } }
          ]
        },
        take: 5
      });
      if (suggestions.length > 0) {
        console.log('\nDid you mean:');
        suggestions.forEach(s => console.log(`  - ${s.nameEn || s.name} (${s.name})`));
      }
      process.exit(1);
    }
    
    if (!toStation) {
      console.error(`❌ Station not found: "${args.to}"`);
      // Suggest similar stations
      const suggestions = await prisma.station.findMany({
        where: { 
          OR: [
            { name: { contains: args.to.substring(0, 2) } },
            { nameEn: { contains: args.to.substring(0, 2), mode: 'insensitive' } }
          ]
        },
        take: 5
      });
      if (suggestions.length > 0) {
        console.log('\nDid you mean:');
        suggestions.forEach(s => console.log(`  - ${s.nameEn || s.name} (${s.name})`));
      }
      process.exit(1);
    }
    
    console.log(`✅ From: ${fromStation.nameEn || fromStation.name} (${fromStation.name})`);
    console.log(`✅ To: ${toStation.nameEn || toStation.name} (${toStation.name})`);
    
    // Configuration
    const endpoint = args.endpoint || process.env.OTP_ENDPOINT || 'http://localhost:8080/otp/routers/default';
    const outputFile = args.output || `transit-route-${fromStation.nameEn || fromStation.name}-${toStation.nameEn || toStation.name}.json`.replace(/\s+/g, '-').toLowerCase();
    
    console.log(`\n📍 Coordinates:`);
    console.log(`   From: ${fromStation.latitude}, ${fromStation.longitude}`);
    console.log(`   To: ${toStation.latitude}, ${toStation.longitude}`);
    console.log(`\n🔗 Endpoint: ${endpoint}`);
    console.log(`💾 Output: ${outputFile}\n`);
    
    // Build request URL
    const params = new URLSearchParams({
      fromPlace: `${fromStation.latitude},${fromStation.longitude}`,
      toPlace: `${toStation.latitude},${toStation.longitude}`,
      mode: 'TRANSIT,WALK',
      maxWalkDistance: '1000',
      arriveBy: 'false',
      numItineraries: '3',
      locale: 'ja'
    });
    
    const url = `${endpoint}/plan?${params}`;
    console.log('Making request...');
    
    // Make request
    const startTime = Date.now();
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });
    const duration = Date.now() - startTime;
    
    console.log(`\n✅ Response received in ${duration}ms`);
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    // Parse response
    const data = await response.json();
    
    // Create output object
    const output = {
      request: {
        from: {
          station: fromStation.nameEn || fromStation.name,
          stationJa: fromStation.name,
          lat: fromStation.latitude,
          lon: fromStation.longitude
        },
        to: {
          station: toStation.nameEn || toStation.name,
          stationJa: toStation.name,
          lat: toStation.latitude,
          lon: toStation.longitude
        },
        timestamp: new Date().toISOString(),
        endpoint,
        url
      },
      response: {
        status: response.status,
        duration: `${duration}ms`,
        data
      },
      summary: {} as any
    };
    
    // Add summary if successful
    if (data.plan?.itineraries?.length > 0) {
      const best = data.plan.itineraries[0];
      output.summary = {
        found: true,
        routes: data.plan.itineraries.length,
        bestRoute: {
          duration: `${Math.round(best.duration / 60)} minutes`,
          durationSeconds: best.duration,
          transfers: best.transfers,
          walkTime: `${Math.round(best.walkTime / 60)} minutes`,
          transitTime: `${Math.round(best.transitTime / 60)} minutes`,
          legs: best.legs.map((leg: any) => ({
            mode: leg.mode,
            from: leg.from.name,
            to: leg.to.name,
            duration: `${Math.round(leg.duration / 60)} min`,
            route: leg.route?.longName || leg.route?.shortName || 'Walking'
          }))
        },
        allRoutes: data.plan.itineraries.map((itin: any, i: number) => ({
          option: i + 1,
          duration: `${Math.round(itin.duration / 60)} minutes`,
          transfers: itin.transfers,
          summary: itin.legs
            .filter((leg: any) => leg.mode === 'RAIL' || leg.mode === 'SUBWAY')
            .map((leg: any) => leg.route?.shortName || leg.route?.longName)
            .filter(Boolean)
            .join(' → ')
        }))
      };
      
      console.log('\n📊 Route Summary:');
      console.log(`- Total duration: ${output.summary.bestRoute.duration}`);
      console.log(`- Transfers: ${output.summary.bestRoute.transfers}`);
      console.log(`- Walking time: ${output.summary.bestRoute.walkTime}`);
      console.log(`- Transit time: ${output.summary.bestRoute.transitTime}`);
      console.log('\n🚶 Route details:');
      output.summary.bestRoute.legs.forEach((leg: any, i: number) => {
        console.log(`  ${i + 1}. ${leg.mode}: ${leg.from} → ${leg.to} (${leg.duration})`);
        if (leg.route !== 'Walking') {
          console.log(`     via ${leg.route}`);
        }
      });
      
      if (output.summary.allRoutes.length > 1) {
        console.log('\n🚃 Alternative routes:');
        output.summary.allRoutes.forEach((route: any) => {
          console.log(`  Option ${route.option}: ${route.duration} (${route.transfers} transfers)`);
          if (route.summary) {
            console.log(`    Lines: ${route.summary}`);
          }
        });
      }
    } else if (data.error) {
      output.summary = {
        found: false,
        error: data.error.message || data.error.msg,
        errorCode: data.error.id
      };
      console.log('\n❌ No route found:', output.summary.error);
    } else {
      output.summary = {
        found: false,
        error: 'Unknown response format'
      };
      console.log('\n❌ Unexpected response format');
    }
    
    // Write output file
    const outputPath = join(process.cwd(), outputFile);
    writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`\n💾 Results saved to: ${outputPath}`);
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
testTransitByStation();