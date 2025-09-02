import { cacheService, cacheKeys, cacheTTL } from './cache';

// Performance timing utilities
export class PerformanceTimer {
  private start: number;
  private markers: Map<string, number> = new Map();

  constructor() {
    this.start = Date.now();
  }

  mark(label: string): void {
    this.markers.set(label, Date.now());
  }

  measure(label: string, startMarker?: string): number {
    const end = Date.now();
    const start = startMarker ? this.markers.get(startMarker) || this.start : this.start;
    const duration = end - start;
    
    console.log(`⏱️  ${label}: ${duration}ms`);
    return duration;
  }

  getTotal(): number {
    return Date.now() - this.start;
  }

  reset(): void {
    this.start = Date.now();
    this.markers.clear();
  }
}

// Performance monitoring service
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();
  private readonly maxSamples = 100;

  private constructor() {}

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  recordTiming(metric: string, duration: number): void {
    if (!this.metrics.has(metric)) {
      this.metrics.set(metric, []);
    }

    const samples = this.metrics.get(metric)!;
    samples.push(duration);

    // Keep only the last N samples
    if (samples.length > this.maxSamples) {
      samples.shift();
    }
  }

  getMetrics(metric: string): {
    avg: number;
    min: number;
    max: number;
    p95: number;
    p99: number;
    count: number;
  } | null {
    const samples = this.metrics.get(metric);
    if (!samples || samples.length === 0) {
      return null;
    }

    const sorted = [...samples].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      avg: sum / count,
      min: sorted[0],
      max: sorted[count - 1],
      p95: sorted[Math.floor(count * 0.95)],
      p99: sorted[Math.floor(count * 0.99)],
      count,
    };
  }

  getAllMetrics(): Record<string, ReturnType<typeof this.getMetrics>> {
    const result: Record<string, ReturnType<typeof this.getMetrics>> = {};
    
    for (const [metric] of this.metrics) {
      result[metric] = this.getMetrics(metric);
    }
    
    return result;
  }

  clear(): void {
    this.metrics.clear();
  }
}

// Performance decorator for functions
export function withPerformanceMonitoring<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  metricName: string
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    const timer = new PerformanceTimer();
    const monitor = PerformanceMonitor.getInstance();
    
    try {
      const result = await fn(...args);
      const duration = timer.getTotal();
      monitor.recordTiming(metricName, duration);
      return result;
    } catch (error) {
      const duration = timer.getTotal();
      monitor.recordTiming(`${metricName}_error`, duration);
      throw error;
    }
  };
}

// Database query performance tracking
export class QueryPerformanceTracker {
  private static queries: Map<string, number[]> = new Map();
  private static readonly maxQueries = 100;

  static track(queryName: string, duration: number): void {
    if (!this.queries.has(queryName)) {
      this.queries.set(queryName, []);
    }

    const times = this.queries.get(queryName)!;
    times.push(duration);

    if (times.length > this.maxQueries) {
      times.shift();
    }
  }

  static getSlowQueries(threshold: number = 100): Array<{
    query: string;
    avgDuration: number;
    count: number;
  }> {
    const slowQueries: Array<{
      query: string;
      avgDuration: number;
      count: number;
    }> = [];

    for (const [query, times] of this.queries) {
      const avgDuration = times.reduce((a, b) => a + b, 0) / times.length;
      if (avgDuration > threshold) {
        slowQueries.push({
          query,
          avgDuration,
          count: times.length,
        });
      }
    }

    return slowQueries.sort((a, b) => b.avgDuration - a.avgDuration);
  }

  static getStats(): Record<string, {
    avg: number;
    min: number;
    max: number;
    count: number;
  }> {
    const stats: Record<string, {
      avg: number;
      min: number;
      max: number;
      count: number;
    }> = {};

    for (const [query, times] of this.queries) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);
      
      stats[query] = {
        avg,
        min,
        max,
        count: times.length,
      };
    }

    return stats;
  }
}

// Memory usage monitoring
export class MemoryMonitor {
  static getCurrentUsage(): NodeJS.MemoryUsage {
    return process.memoryUsage();
  }

  static getFormattedUsage(): {
    rss: string;
    heapTotal: string;
    heapUsed: string;
    external: string;
  } {
    const usage = process.memoryUsage();
    
    return {
      rss: `${Math.round(usage.rss / 1024 / 1024 * 100) / 100} MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100} MB`,
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100} MB`,
      external: `${Math.round(usage.external / 1024 / 1024 * 100) / 100} MB`,
    };
  }

  static logUsage(label: string = 'Memory Usage'): void {
    const usage = this.getFormattedUsage();
    console.log(`📊 ${label}:`, usage);
  }
}

// Performance middleware for tRPC
export function createPerformanceMiddleware() {
  return (opts: any) => {
    return async (next: any) => {
      const timer = new PerformanceTimer();
      const monitor = PerformanceMonitor.getInstance();
      
      try {
        const result = await next(opts);
        const duration = timer.getTotal();
        
        // Record timing
        monitor.recordTiming(`trpc_${opts.path}`, duration);
        
        // Log slow queries
        if (duration > 200) {
          console.warn(`🐌 Slow query: ${opts.path} took ${duration}ms`);
        }
        
        return result;
      } catch (error) {
        const duration = timer.getTotal();
        monitor.recordTiming(`trpc_${opts.path}_error`, duration);
        throw error;
      }
    };
  };
}

// System health check
export class SystemHealthChecker {
  static async checkHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    checks: Record<string, {
      status: 'pass' | 'fail';
      duration: number;
      details?: any;
    }>;
  }> {
    const checks: Record<string, {
      status: 'pass' | 'fail';
      duration: number;
      details?: any;
    }> = {};

    // Check database
    const dbTimer = new PerformanceTimer();
    try {
      // This would be replaced with actual DB check
      await new Promise(resolve => setTimeout(resolve, 1));
      checks.database = {
        status: 'pass',
        duration: dbTimer.getTotal(),
      };
    } catch (error) {
      checks.database = {
        status: 'fail',
        duration: dbTimer.getTotal(),
        details: error,
      };
    }

    // Check cache
    const cacheTimer = new PerformanceTimer();
    try {
      await cacheService.set('health_check', 'ok', 10);
      const result = await cacheService.get('health_check');
      checks.cache = {
        status: result === 'ok' ? 'pass' : 'fail',
        duration: cacheTimer.getTotal(),
      };
    } catch (error) {
      checks.cache = {
        status: 'fail',
        duration: cacheTimer.getTotal(),
        details: error,
      };
    }

    // Check memory
    const memoryUsage = MemoryMonitor.getCurrentUsage();
    const memoryLimit = 1024 * 1024 * 1024; // 1GB
    checks.memory = {
      status: memoryUsage.heapUsed < memoryLimit ? 'pass' : 'fail',
      duration: 0,
      details: MemoryMonitor.getFormattedUsage(),
    };

    // Determine overall status
    const failedChecks = Object.values(checks).filter(check => check.status === 'fail').length;
    let status: 'healthy' | 'degraded' | 'unhealthy';
    
    if (failedChecks === 0) {
      status = 'healthy';
    } else if (failedChecks === 1) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}

// Export singleton instances
export const performanceMonitor = PerformanceMonitor.getInstance();