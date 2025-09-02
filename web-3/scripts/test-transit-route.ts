#!/usr/bin/env tsx
/**
 * Test transit route between two coordinates
 * Usage: npm run test-transit-route -- --from "35.6812,139.7671" --to "35.6580,139.7016"
 * Or: npx tsx scripts/test-transit-route.ts --from "35.6812,139.7671" --to "35.6580,139.7016"
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

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

// Main function
async function testTransitRoute() {
  const args = parseArgs();
  
  // Validate arguments
  if (!args.from || !args.to) {
    console.error('❌ Missing required arguments');
    console.log('\nUsage:');
    console.log('  npm run test-transit-route -- --from "lat,lon" --to "lat,lon" [--output file.json] [--endpoint url]');
    console.log('\nExample:');
    console.log('  npm run test-transit-route -- --from "35.6812,139.7671" --to "35.6580,139.7016"');
    console.log('\nOptions:');
    console.log('  --from     Starting coordinates (latitude,longitude)');
    console.log('  --to       Destination coordinates (latitude,longitude)');
    console.log('  --output   Output JSON file (default: transit-route-result.json)');
    console.log('  --endpoint OTP endpoint URL (default: http://localhost:8080/otp/routers/default)');
    process.exit(1);
  }
  
  // Parse coordinates
  const [fromLat, fromLon] = args.from.split(',').map(Number);
  const [toLat, toLon] = args.to.split(',').map(Number);
  
  if (isNaN(fromLat) || isNaN(fromLon) || isNaN(toLat) || isNaN(toLon)) {
    console.error('❌ Invalid coordinates format. Use: "latitude,longitude"');
    process.exit(1);
  }
  
  // Configuration
  const endpoint = args.endpoint || process.env.OTP_ENDPOINT || 'http://localhost:8080/otp/routers/default';
  const outputFile = args.output || 'transit-route-result.json';
  
  console.log('\n🚉 Transit Route Test');
  console.log('====================');
  console.log(`From: ${fromLat}, ${fromLon}`);
  console.log(`To: ${toLat}, ${toLon}`);
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Output: ${outputFile}\n`);
  
  try {
    // Build request URL
    const params = new URLSearchParams({
      fromPlace: `${fromLat},${fromLon}`,
      toPlace: `${toLat},${toLon}`,
      mode: 'TRANSIT,WALK',
      maxWalkDistance: '1000',
      arriveBy: 'false',
      numItineraries: '5',
      locale: 'ja'
    });
    
    const url = `${endpoint}/plan?${params}`;
    console.log('🔗 Request URL:', url);
    console.log('\nMaking request...');
    
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
        from: { lat: fromLat, lon: fromLon },
        to: { lat: toLat, lon: toLon },
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
        }
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
    
    // Save error output
    const errorOutput = {
      request: {
        from: { lat: fromLat, lon: fromLon },
        to: { lat: toLat, lon: toLon },
        timestamp: new Date().toISOString(),
        endpoint
      },
      error: {
        message: error instanceof Error ? error.message : String(error),
        type: error instanceof Error ? error.name : 'Unknown'
      }
    };
    
    const outputPath = join(process.cwd(), outputFile);
    writeFileSync(outputPath, JSON.stringify(errorOutput, null, 2));
    console.log(`\n💾 Error details saved to: ${outputPath}`);
    
    process.exit(1);
  }
}

// Run the script
testTransitRoute();