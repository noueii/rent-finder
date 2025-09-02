#!/usr/bin/env tsx
// @ts-nocheck
/**
 * Analyze apartment data to suggest optimal target values for scoring
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function analyzeApartments() {
  try {
    console.log("=== Analyzing Apartment Data for Target Value Suggestions ===\n");

    // Get price statistics
    const priceStats = await prisma.apartment.aggregate({
      _avg: { price: true },
      _min: { price: true },
      _max: { price: true },
      _count: true,
    });

    // Get price percentiles
    const pricePercentiles = await prisma.$queryRaw<{percentile_25: number, percentile_50: number, percentile_75: number}[]>`
      SELECT 
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price) as percentile_25,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY price) as percentile_50,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price) as percentile_75
      FROM "Apartment"
      WHERE price IS NOT NULL
    `;

    console.log("📊 PRICE ANALYSIS:");
    console.log(`  Min: ¥${(priceStats._min.price || 0).toLocaleString()}`);
    console.log(`  25th percentile: ¥${Math.round(pricePercentiles[0]?.percentile_25 || 0).toLocaleString()}`);
    console.log(`  Median (50th): ¥${Math.round(pricePercentiles[0]?.percentile_50 || 0).toLocaleString()}`);
    console.log(`  75th percentile: ¥${Math.round(pricePercentiles[0]?.percentile_75 || 0).toLocaleString()}`);
    console.log(`  Max: ¥${(priceStats._max.price || 0).toLocaleString()}`);
    console.log(`  Average: ¥${Math.round(priceStats._avg.price || 0).toLocaleString()}`);
    console.log(`\n  💡 Suggested target: ¥${Math.round(pricePercentiles[0]?.percentile_25 || 0).toLocaleString()} (25th percentile)`);
    console.log(`     This will give good scores to the cheapest 25% of apartments\n`);

    // Get size statistics
    const sizeStats = await prisma.apartment.aggregate({
      _avg: { size: true },
      _min: { size: true },
      _max: { size: true },
    });

    const sizePercentiles = await prisma.$queryRaw<{percentile_25: number, percentile_50: number, percentile_75: number}[]>`
      SELECT 
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY size) as percentile_25,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY size) as percentile_50,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY size) as percentile_75
      FROM "Apartment"
      WHERE size IS NOT NULL
    `;

    console.log("📐 SIZE ANALYSIS:");
    console.log(`  Min: ${sizeStats._min.size || 0}m²`);
    console.log(`  25th percentile: ${Math.round(sizePercentiles[0]?.percentile_25 || 0)}m²`);
    console.log(`  Median (50th): ${Math.round(sizePercentiles[0]?.percentile_50 || 0)}m²`);
    console.log(`  75th percentile: ${Math.round(sizePercentiles[0]?.percentile_75 || 0)}m²`);
    console.log(`  Max: ${sizeStats._max.size || 0}m²`);
    console.log(`  Average: ${Math.round(sizeStats._avg.size || 0)}m²`);
    console.log(`\n  💡 Suggested target: ${Math.round(sizePercentiles[0]?.percentile_75 || 0)}m² (75th percentile)`);
    console.log(`     This will give good scores to the largest 25% of apartments\n`);

    // Get age statistics
    const ageStats = await prisma.apartment.aggregate({
      where: { buildingAge: { not: null } },
      _avg: { buildingAge: true },
      _min: { buildingAge: true },
      _max: { buildingAge: true },
      _count: true,
    });

    let agePercentiles: any[] = [{ percentile_25: 5, percentile_50: 10, percentile_75: 20 }]; // defaults
    if (ageStats._count > 0) {
      agePercentiles = await prisma.$queryRaw<{percentile_25: number, percentile_50: number, percentile_75: number}[]>`
        SELECT 
          PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY "buildingAge") as percentile_25,
          PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY "buildingAge") as percentile_50,
          PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY "buildingAge") as percentile_75
        FROM "Apartment"
        WHERE "buildingAge" IS NOT NULL
      `;

      console.log("🏢 BUILDING AGE ANALYSIS:");
      console.log(`  Min: ${ageStats._min.buildingAge || 0} years`);
      console.log(`  25th percentile: ${Math.round(agePercentiles[0]?.percentile_25 || 0)} years`);
      console.log(`  Median (50th): ${Math.round(agePercentiles[0]?.percentile_50 || 0)} years`);
      console.log(`  75th percentile: ${Math.round(agePercentiles[0]?.percentile_75 || 0)} years`);
      console.log(`  Max: ${ageStats._max.buildingAge || 0} years`);
      console.log(`  Average: ${Math.round(ageStats._avg.buildingAge || 0)} years`);
      console.log(`\n  💡 Suggested target: ${Math.round(agePercentiles[0]?.percentile_25 || 0)} years (25th percentile)`);
      console.log(`     This will give good scores to the newest 25% of buildings\n`);
    }

    // Get floor statistics
    const floorStats = await prisma.apartment.aggregate({
      where: { floor: { not: null } },
      _avg: { floor: true },
      _min: { floor: true },
      _max: { floor: true },
      _count: true,
    });

    if (floorStats._count > 0) {
      console.log("🏗️ FLOOR ANALYSIS:");
      console.log(`  Min: ${floorStats._min.floor || 0}F`);
      console.log(`  Max: ${floorStats._max.floor || 0}F`);
      console.log(`  Average: ${Math.round(floorStats._avg.floor || 0)}F`);
      console.log(`\n  💡 Suggested target: 3F (typical preference)`);
      console.log(`     Adjust based on your preference for higher/lower floors\n`);
    }

    // Get walking time statistics
    const walkingStats = await prisma.apartmentStation.aggregate({
      _avg: { walkingMinutes: true },
      _min: { walkingMinutes: true },
      _max: { walkingMinutes: true },
      _count: true,
    });

    let walkingPercentiles: any[] = [{ percentile_25: 3, percentile_50: 5, percentile_75: 10 }]; // defaults
    if (walkingStats._count > 0) {
      walkingPercentiles = await prisma.$queryRaw<{percentile_25: number, percentile_50: number, percentile_75: number}[]>`
        SELECT 
          PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY "walkingMinutes") as percentile_25,
          PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY "walkingMinutes") as percentile_50,
          PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY "walkingMinutes") as percentile_75
        FROM "ApartmentStation"
      `;

      console.log("🚶 WALKING TIME ANALYSIS:");
      console.log(`  Min: ${walkingStats._min.walkingMinutes || 0} minutes`);
      console.log(`  25th percentile: ${Math.round(walkingPercentiles[0].percentile_25)} minutes`);
      console.log(`  Median (50th): ${Math.round(walkingPercentiles[0].percentile_50)} minutes`);
      console.log(`  75th percentile: ${Math.round(walkingPercentiles[0].percentile_75)} minutes`);
      console.log(`  Max: ${walkingStats._max.walkingMinutes || 0} minutes`);
      console.log(`  Average: ${Math.round(walkingStats._avg.walkingMinutes || 0)} minutes`);
      console.log(`\n  💡 Suggested target: ${Math.round(walkingPercentiles[0].percentile_25)} minutes (25th percentile)`);
      console.log(`     This will give good scores to apartments closest to stations\n`);
    }

    // Get route/commute statistics (if available)
    const routeStats = await prisma.route.aggregate({
      _avg: { duration: true },
      _min: { duration: true },
      _max: { duration: true },
      _count: true,
    });

    let routePercentiles: any[] = [{ percentile_25: 20, percentile_50: 30, percentile_75: 45 }]; // defaults
    if (routeStats._count > 0) {
      routePercentiles = await prisma.$queryRaw<{percentile_25: number, percentile_50: number, percentile_75: number}[]>`
        SELECT 
          PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY duration) as percentile_25,
          PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration) as percentile_50,
          PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY duration) as percentile_75
        FROM "Route"
      `;

      console.log("🚆 COMMUTE TIME ANALYSIS:");
      console.log(`  Min: ${routeStats._min.duration || 0} minutes`);
      console.log(`  25th percentile: ${Math.round(routePercentiles[0]?.percentile_25 || 0)} minutes`);
      console.log(`  Median (50th): ${Math.round(routePercentiles[0]?.percentile_50 || 0)} minutes`);
      console.log(`  75th percentile: ${Math.round(routePercentiles[0]?.percentile_75 || 0)} minutes`);
      console.log(`  Max: ${routeStats._max.duration || 0} minutes`);
      console.log(`  Average: ${Math.round(routeStats._avg.duration || 0)} minutes`);
      console.log(`\n  💡 Suggested target: ${Math.round(routePercentiles[0]?.percentile_25 || 0)} minutes (25th percentile)`);
      console.log(`     This will give good scores to apartments with shortest commutes\n`);
    }

    console.log("\n=== RECOMMENDED TARGET VALUES ===");
    console.log("\nFor competitive scoring (only top 25% get perfect scores):");
    console.log(`{
  targetPrice: ${Math.round(pricePercentiles[0]?.percentile_25 || 0)},
  targetSize: ${Math.round(sizePercentiles[0]?.percentile_75 || 0)},
  targetCommute: ${routeStats._count > 0 ? Math.round(routePercentiles[0]?.percentile_25 || 20) : 20},
  targetAge: ${ageStats._count > 0 ? Math.round(agePercentiles[0]?.percentile_25 || 5) : 5},
  targetFloor: 3,
  targetWalkTime: ${walkingStats._count > 0 ? Math.round(walkingPercentiles[0].percentile_25) : 3}
}`);

    console.log("\nFor balanced scoring (top 50% get good scores):");
    console.log(`{
  targetPrice: ${Math.round(pricePercentiles[0]?.percentile_50 || 0)},
  targetSize: ${Math.round(sizePercentiles[0]?.percentile_50 || 0)},
  targetCommute: ${routeStats._count > 0 ? Math.round(routePercentiles[0]?.percentile_50 || 30) : 30},
  targetAge: ${ageStats._count > 0 ? Math.round(agePercentiles[0]?.percentile_50 || 10) : 10},
  targetFloor: 3,
  targetWalkTime: ${walkingStats._count > 0 ? Math.round(walkingPercentiles[0].percentile_50) : 5}
}`);

  } catch (error) {
    console.error("Error analyzing apartments:", error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeApartments();