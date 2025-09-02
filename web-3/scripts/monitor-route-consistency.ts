#!/usr/bin/env tsx
/**
 * Monitor route data consistency
 * Checks for common issues like walking-only routes with train time
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface RouteIssue {
  type: string;
  severity: 'error' | 'warning';
  routeId: string;
  apartmentId: string;
  details: string;
  data: any;
}

async function monitorRouteConsistency() {
  console.log('🔍 Monitoring Route Consistency...\n');

  const issues: RouteIssue[] = [];

  try {
    // Get all routes with basic info
    const routes = await prisma.route.findMany({
      include: {
        apartment: {
          select: {
            id: true,
            address: true,
          }
        },
        toStation: {
          select: {
            name: true,
            nameEn: true,
          }
        }
      }
    });

    console.log(`Total routes to check: ${routes.length}`);

    for (const route of routes) {
      // Check 1: Walking-only routes with train time
      if (route.routeData && typeof route.routeData === 'object') {
        const routeData = route.routeData as any;
        if (routeData.legs && Array.isArray(routeData.legs)) {
          const hasOnlyWalkingLegs = routeData.legs.every((leg: any) => leg.mode === 'WALK');
          const totalDuration = routeData.duration || 0;
          
          if (hasOnlyWalkingLegs && route.trainTime > 0) {
            issues.push({
              type: 'WALKING_ONLY_WITH_TRAIN_TIME',
              severity: 'error',
              routeId: route.id,
              apartmentId: route.apartmentId,
              details: `Walking-only route has trainTime=${route.trainTime}`,
              data: {
                duration: route.duration,
                walkTime: route.walkTime,
                trainTime: route.trainTime,
                toStation: route.toStation.nameEn || route.toStation.name
              }
            });
          }

          // Check 2: Time calculations don't add up
          const tolerance = 2; // 2 minute tolerance
          if (route.walkTime + route.trainTime > route.duration + tolerance) {
            issues.push({
              type: 'TIME_CALCULATION_ERROR',
              severity: 'warning',
              routeId: route.id,
              apartmentId: route.apartmentId,
              details: `Times don't add up: walk(${route.walkTime}) + train(${route.trainTime}) > duration(${route.duration})`,
              data: {
                duration: route.duration,
                walkTime: route.walkTime,
                trainTime: route.trainTime,
                sum: route.walkTime + route.trainTime,
                difference: (route.walkTime + route.trainTime) - route.duration
              }
            });
          }

          // Check 3: Walk time exceeds total duration
          if (route.walkTime > route.duration) {
            issues.push({
              type: 'WALK_TIME_EXCEEDS_DURATION',
              severity: 'error',
              routeId: route.id,
              apartmentId: route.apartmentId,
              details: `Walk time (${route.walkTime}) exceeds total duration (${route.duration})`,
              data: {
                duration: route.duration,
                walkTime: route.walkTime,
                trainTime: route.trainTime
              }
            });
          }

          // Check 4: TOO_CLOSE routes with train time
          if (totalDuration < 600 && route.trainTime > 0) { // Less than 10 minutes total
            issues.push({
              type: 'SHORT_ROUTE_WITH_TRAIN',
              severity: 'warning',
              routeId: route.id,
              apartmentId: route.apartmentId,
              details: `Very short route (${Math.ceil(totalDuration/60)}min) has train time`,
              data: {
                totalSeconds: totalDuration,
                duration: route.duration,
                walkTime: route.walkTime,
                trainTime: route.trainTime
              }
            });
          }

          // Check 5: Missing or invalid route data
          if (!routeData.legs || routeData.legs.length === 0) {
            issues.push({
              type: 'MISSING_ROUTE_LEGS',
              severity: 'error',
              routeId: route.id,
              apartmentId: route.apartmentId,
              details: 'Route has no legs data',
              data: {
                duration: route.duration,
                hasRouteData: !!route.routeData
              }
            });
          }
        }
      }

      // Check 6: Negative or zero durations
      if (route.duration <= 0) {
        issues.push({
          type: 'INVALID_DURATION',
          severity: 'error',
          routeId: route.id,
          apartmentId: route.apartmentId,
          details: `Invalid duration: ${route.duration}`,
          data: {
            duration: route.duration,
            walkTime: route.walkTime,
            trainTime: route.trainTime
          }
        });
      }
    }

    // Display results
    console.log('\n📊 Consistency Check Results:');
    console.log('============================');
    console.log(`Total routes checked: ${routes.length}`);
    console.log(`Issues found: ${issues.length}`);

    // Group issues by type
    const issuesByType = issues.reduce((acc, issue) => {
      if (!acc[issue.type]) {
        acc[issue.type] = [];
      }
      acc[issue.type].push(issue);
      return acc;
    }, {} as Record<string, RouteIssue[]>);

    // Display summary by type
    console.log('\n📈 Issues by Type:');
    Object.entries(issuesByType).forEach(([type, typeIssues]) => {
      const errors = typeIssues.filter(i => i.severity === 'error').length;
      const warnings = typeIssues.filter(i => i.severity === 'warning').length;
      console.log(`\n${type}:`);
      console.log(`  Total: ${typeIssues.length} (${errors} errors, ${warnings} warnings)`);
      
      // Show first few examples
      typeIssues.slice(0, 3).forEach(issue => {
        console.log(`  - Route ${issue.routeId}: ${issue.details}`);
        if (issue.data) {
          console.log(`    Data:`, JSON.stringify(issue.data, null, 2).split('\n').join('\n    '));
        }
      });
      
      if (typeIssues.length > 3) {
        console.log(`  ... and ${typeIssues.length - 3} more`);
      }
    });

    // Generate report file
    const reportPath = './route-consistency-report.json';
    const fs = await import('fs');
    await fs.promises.writeFile(
      reportPath,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        summary: {
          totalRoutes: routes.length,
          totalIssues: issues.length,
          byType: Object.entries(issuesByType).map(([type, typeIssues]) => ({
            type,
            count: typeIssues.length,
            errors: typeIssues.filter(i => i.severity === 'error').length,
            warnings: typeIssues.filter(i => i.severity === 'warning').length
          }))
        },
        issues: issues.slice(0, 100) // First 100 issues for review
      }, null, 2)
    );

    console.log(`\n💾 Detailed report saved to: ${reportPath}`);

    // Provide fix suggestions
    if (issues.length > 0) {
      console.log('\n🔧 Suggested Actions:');
      if (issuesByType['WALKING_ONLY_WITH_TRAIN_TIME']) {
        console.log('1. Run fix-too-close-routes.ts to fix walking routes with train time');
      }
      if (issuesByType['TIME_CALCULATION_ERROR']) {
        console.log('2. Run fix-route-durations.ts to recalculate route times');
      }
      if (issuesByType['MISSING_ROUTE_LEGS']) {
        console.log('3. Delete routes with missing data and recalculate them');
      }
    } else {
      console.log('\n✅ No consistency issues found!');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the monitoring
monitorRouteConsistency().catch(console.error);