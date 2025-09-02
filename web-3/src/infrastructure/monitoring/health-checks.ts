import { ErrorHandler } from '~/core/errors/error-handler';
import type { ServiceHealth } from '~/types/health';

/**
 * Health check utilities for monitoring system components
 */
export class HealthCheckService {
  constructor(private errorHandler: ErrorHandler) {}

  /**
   * Create a health check function with timeout
   */
  createHealthCheck<T>(
    name: string,
    checkFn: () => Promise<T>,
    options: {
      timeout?: number;
      healthyThreshold?: (result: T) => boolean;
    } = {}
  ): () => Promise<ServiceHealth> {
    const { timeout = 5000, healthyThreshold } = options;

    return async (): Promise<ServiceHealth> => {
      const start = Date.now();

      try {
        // Run check with timeout
        const result = await this.withTimeout(checkFn(), timeout);
        const responseTime = Date.now() - start;

        // Determine health status
        let status: ServiceHealth['status'] = 'healthy';
        if (healthyThreshold && !healthyThreshold(result)) {
          status = 'degraded';
        } else if (responseTime > timeout * 0.8) {
          status = 'degraded'; // Slow response
        }

        return {
          name,
          status,
          responseTime,
          details: { result }
        };
      } catch (error) {
        const responseTime = Date.now() - start;
        
        return {
          name,
          status: 'error',
          responseTime,
          error: error instanceof Error ? error.message : String(error),
          details: {
            errorType: error?.constructor?.name || 'Unknown',
            timeout: responseTime >= timeout
          }
        };
      }
    };
  }

  /**
   * Run multiple health checks in parallel
   */
  async runHealthChecks(
    checks: Array<() => Promise<ServiceHealth>>
  ): Promise<ServiceHealth[]> {
    return Promise.all(checks.map(check => check()));
  }

  /**
   * Aggregate health check results
   */
  aggregateHealth(results: ServiceHealth[]): 'healthy' | 'degraded' | 'error' {
    if (results.some(r => r.status === 'error')) {
      return 'error';
    }
    if (results.some(r => r.status === 'degraded')) {
      return 'degraded';
    }
    return 'healthy';
  }

  /**
   * Create a composite health check from multiple checks
   */
  createCompositeCheck(
    name: string,
    checks: Array<() => Promise<ServiceHealth>>
  ): () => Promise<ServiceHealth> {
    return async (): Promise<ServiceHealth> => {
      const start = Date.now();
      
      try {
        const results = await this.runHealthChecks(checks);
        const status = this.aggregateHealth(results);
        const responseTime = Date.now() - start;

        return {
          name,
          status,
          responseTime,
          details: {
            checks: results,
            summary: {
              total: results.length,
              healthy: results.filter(r => r.status === 'healthy').length,
              degraded: results.filter(r => r.status === 'degraded').length,
              error: results.filter(r => r.status === 'error').length
            }
          }
        };
      } catch (error) {
        return {
          name,
          status: 'error',
          responseTime: Date.now() - start,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    };
  }

  /**
   * Add timeout to a promise
   */
  private async withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Health check timeout')), timeout);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Format health check results for logging
   */
  formatHealthResults(results: ServiceHealth[]): string {
    const lines = ['Health Check Results:'];
    
    results.forEach(result => {
      const status = result.status.toUpperCase().padEnd(8);
      const time = `${result.responseTime}ms`.padStart(8);
      const error = result.error ? ` - ${result.error}` : '';
      
      lines.push(`  ${status} ${time} ${result.name}${error}`);
    });

    const summary = {
      total: results.length,
      healthy: results.filter(r => r.status === 'healthy').length,
      degraded: results.filter(r => r.status === 'degraded').length,
      error: results.filter(r => r.status === 'error').length
    };

    lines.push('');
    lines.push(`Summary: ${summary.healthy}/${summary.total} healthy, ${summary.degraded} degraded, ${summary.error} errors`);

    return lines.join('\n');
  }
}

/**
 * Pre-configured health checks for common services
 */
export const commonHealthChecks = {
  /**
   * Database connectivity check
   */
  database: (prisma: any) => async (): Promise<boolean> => {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  },

  /**
   * Redis connectivity check (if using Redis)
   */
  redis: (redis: any) => async (): Promise<boolean> => {
    const result = await redis.ping();
    return result === 'PONG';
  },

  /**
   * External API check
   */
  externalApi: (url: string) => async (): Promise<boolean> => {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(3000)
    });
    return response.ok;
  },

  /**
   * File system check
   */
  fileSystem: (path: string) => async (): Promise<boolean> => {
    const fs = await import('fs/promises');
    await fs.access(path);
    return true;
  },

  /**
   * Memory usage check
   */
  memory: (maxHeapMB: number = 512) => async (): Promise<boolean> => {
    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    return used < maxHeapMB;
  },

  /**
   * Disk space check (requires additional dependencies)
   */
  diskSpace: (minFreeMB: number = 1024) => async (): Promise<boolean> => {
    // This would require a disk space checking library
    // For now, return true
    return true;
  }
};

/**
 * Export singleton instance
 */
export const healthCheckService = new HealthCheckService(new ErrorHandler());