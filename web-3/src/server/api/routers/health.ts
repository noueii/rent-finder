import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '~/server/api/trpc';
import { prisma } from '~/server/db';
import { SimplifiedOTPService } from '~/lib/transit';
import { ErrorHandler } from '~/core/errors/error-handler';
import type { HealthCheckResult, ServiceHealth, DependencyInfo } from '~/types/health';

/**
 * Health check router for system monitoring
 * Provides endpoints to check system health and dependencies
 */
export const healthRouter = createTRPCRouter({
  /**
   * Basic health check - returns 200 if service is up
   */
  check: publicProcedure
    .query(async (): Promise<{ status: 'ok' | 'degraded' | 'error'; timestamp: string }> => {
      return {
        status: 'ok',
        timestamp: new Date().toISOString()
      };
    }),

  /**
   * Detailed health check including all dependencies
   */
  detailed: publicProcedure
    .query(async (): Promise<HealthCheckResult> => {
      const errorHandler = new ErrorHandler();
      const services: ServiceHealth[] = [];
      const startTime = Date.now();
      
      // Check database connectivity
      const dbHealth = await checkDatabase();
      services.push(dbHealth);
      
      // Check transit service
      const transitHealth = await checkTransitService();
      services.push(transitHealth);
      
      // Check external services (if any are critical)
      // For MVP, we don't have critical external dependencies
      
      // Calculate overall status
      const hasError = services.some(s => s.status === 'error');
      const hasDegraded = services.some(s => s.status === 'degraded');
      const overallStatus = hasError ? 'error' : hasDegraded ? 'degraded' : 'healthy';
      
      // Get dependency versions
      const dependencies = getDependencyInfo();
      
      return {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version: process.env.APP_VERSION || '1.0.0',
        uptime: process.uptime(),
        services,
        dependencies,
        metrics: {
          responseTime: Date.now() - startTime,
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
          cpuUsage: process.cpuUsage()
        }
      };
    }),

  /**
   * Database-specific health check
   */
  database: publicProcedure
    .query(async (): Promise<ServiceHealth> => {
      return checkDatabase();
    }),

  /**
   * Transit service health check
   */
  transit: publicProcedure
    .query(async (): Promise<ServiceHealth> => {
      return checkTransitService();
    }),

  /**
   * Get system metrics
   */
  metrics: publicProcedure
    .query(async () => {
      const memUsage = process.memoryUsage();
      
      return {
        memory: {
          rss: memUsage.rss / 1024 / 1024, // MB
          heapTotal: memUsage.heapTotal / 1024 / 1024,
          heapUsed: memUsage.heapUsed / 1024 / 1024,
          external: memUsage.external / 1024 / 1024
        },
        cpu: process.cpuUsage(),
        uptime: process.uptime(),
        pid: process.pid,
        nodeVersion: process.version,
        platform: process.platform,
        timestamp: new Date().toISOString()
      };
    })
});

/**
 * Check database connectivity and performance
 */
async function checkDatabase(): Promise<ServiceHealth> {
  const start = Date.now();
  
  try {
    // Simple query to check connectivity
    await prisma.$queryRaw`SELECT 1`;
    
    // Check table accessibility
    const count = await prisma.user.count();
    
    const responseTime = Date.now() - start;
    
    return {
      name: 'PostgreSQL Database',
      status: responseTime < 100 ? 'healthy' : 'degraded',
      responseTime,
      details: {
        connected: true,
        userCount: count,
        responseTime: `${responseTime}ms`
      }
    };
  } catch (error) {
    return {
      name: 'PostgreSQL Database',
      status: 'error',
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown database error',
      details: {
        connected: false
      }
    };
  }
}

/**
 * Check transit service availability
 */
async function checkTransitService(): Promise<ServiceHealth> {
  const start = Date.now();
  
  try {
    const transitService = new SimplifiedOTPService();
    
    // Test with a known station
    const stations = await transitService.getReachableStations('station-1', 30);
    
    const responseTime = Date.now() - start;
    const isHealthy = stations.length > 0 && responseTime < 500;
    
    return {
      name: 'Transit Service',
      status: isHealthy ? 'healthy' : 'degraded',
      responseTime,
      details: {
        available: true,
        stationCount: stations.length,
        responseTime: `${responseTime}ms`
      }
    };
  } catch (error) {
    return {
      name: 'Transit Service',
      status: 'error',
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'Transit service unavailable',
      details: {
        available: false
      }
    };
  }
}

/**
 * Get dependency version information
 */
function getDependencyInfo(): DependencyInfo[] {
  // Read from package.json or environment
  return [
    {
      name: 'Node.js',
      version: process.version,
      required: '>=18.0.0'
    },
    {
      name: 'Next.js',
      version: process.env.NEXT_VERSION || '14.x',
      required: '^14.0.0'
    },
    {
      name: 'Prisma',
      version: process.env.PRISMA_VERSION || '5.x',
      required: '^5.0.0'
    },
    {
      name: 'PostgreSQL',
      version: process.env.PG_VERSION || '15.x',
      required: '>=14.0'
    }
  ];
}

// Type definitions for health check results
export type { HealthCheckResult, ServiceHealth, DependencyInfo };