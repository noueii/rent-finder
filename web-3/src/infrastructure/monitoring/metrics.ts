/**
 * Simple metrics collection for performance monitoring
 * Follows YAGNI principle - no external dependencies
 */

export interface Metric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  tags?: Record<string, string>;
}

export interface Counter {
  name: string;
  count: number;
  tags?: Record<string, string>;
}

export interface Histogram {
  name: string;
  values: number[];
  min: number;
  max: number;
  mean: number;
  median: number;
  p95: number;
  p99: number;
}

/**
 * Simple in-memory metrics collector
 */
export class MetricsCollector {
  private metrics: Map<string, Metric[]> = new Map();
  private counters: Map<string, Counter> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private readonly maxMetricsPerName = 1000; // Prevent memory leaks

  /**
   * Record a metric value
   */
  record(name: string, value: number, unit: string = 'ms', tags?: Record<string, string>): void {
    const metric: Metric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      tags
    };

    const key = this.getMetricKey(name, tags);
    const metrics = this.metrics.get(key) || [];
    
    metrics.push(metric);
    
    // Keep only recent metrics to prevent memory growth
    if (metrics.length > this.maxMetricsPerName) {
      metrics.splice(0, metrics.length - this.maxMetricsPerName);
    }
    
    this.metrics.set(key, metrics);
  }

  /**
   * Increment a counter
   */
  increment(name: string, amount: number = 1, tags?: Record<string, string>): void {
    const key = this.getMetricKey(name, tags);
    const counter = this.counters.get(key) || { name, count: 0, tags };
    counter.count += amount;
    this.counters.set(key, counter);
  }

  /**
   * Record a value for histogram calculation
   */
  histogram(name: string, value: number): void {
    const values = this.histograms.get(name) || [];
    values.push(value);
    
    // Keep only recent values
    if (values.length > this.maxMetricsPerName) {
      values.splice(0, values.length - this.maxMetricsPerName);
    }
    
    this.histograms.set(name, values);
  }

  /**
   * Measure execution time of a function
   */
  async measureTime<T>(
    name: string,
    fn: () => Promise<T>,
    tags?: Record<string, string>
  ): Promise<T> {
    const start = Date.now();
    
    try {
      const result = await fn();
      const duration = Date.now() - start;
      
      this.record(name, duration, 'ms', { ...tags, status: 'success' });
      this.histogram(`${name}.duration`, duration);
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      
      this.record(name, duration, 'ms', { ...tags, status: 'error' });
      this.increment(`${name}.errors`, 1, tags);
      
      throw error;
    }
  }

  /**
   * Get metrics summary
   */
  getSummary(): Record<string, any> {
    const summary: Record<string, any> = {
      metrics: {},
      counters: {},
      histograms: {}
    };

    // Summarize metrics
    this.metrics.forEach((metrics, key) => {
      const recent = metrics.slice(-100); // Last 100 values
      const values = recent.map(m => m.value);
      
      summary.metrics[key] = {
        count: recent.length,
        last: values[values.length - 1],
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length
      };
    });

    // Include counters
    this.counters.forEach((counter, key) => {
      summary.counters[key] = counter.count;
    });

    // Calculate histogram statistics
    this.histograms.forEach((values, name) => {
      summary.histograms[name] = this.calculateHistogramStats(values);
    });

    return summary;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics.clear();
    this.counters.clear();
    this.histograms.clear();
  }

  /**
   * Get metrics for a specific time range
   */
  getMetricsInRange(name: string, startTime: number, endTime: number): Metric[] {
    const allMetrics: Metric[] = [];
    
    this.metrics.forEach((metrics, key) => {
      if (key.startsWith(name)) {
        const filtered = metrics.filter(
          m => m.timestamp >= startTime && m.timestamp <= endTime
        );
        allMetrics.push(...filtered);
      }
    });
    
    return allMetrics;
  }

  /**
   * Create metric key from name and tags
   */
  private getMetricKey(name: string, tags?: Record<string, string>): string {
    if (!tags || Object.keys(tags).length === 0) {
      return name;
    }
    
    const tagString = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
    
    return `${name}{${tagString}}`;
  }

  /**
   * Calculate histogram statistics
   */
  private calculateHistogramStats(values: number[]): Histogram {
    if (values.length === 0) {
      return {
        name: 'empty',
        values: [],
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        p95: 0,
        p99: 0
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      name: 'histogram',
      values: sorted,
      min: sorted[0]!,
      max: sorted[sorted.length - 1]!,
      mean: sum / sorted.length,
      median: sorted[Math.floor(sorted.length / 2)]!,
      p95: sorted[Math.floor(sorted.length * 0.95)]!,
      p99: sorted[Math.floor(sorted.length * 0.99)]!
    };
  }
}

/**
 * Request/response logging middleware
 */
export function createRequestLogger(metrics: MetricsCollector) {
  return async (req: any, res: any, next: () => Promise<void>) => {
    const start = Date.now();
    const method = req.method || 'UNKNOWN';
    const path = req.url || req.path || 'UNKNOWN';

    try {
      await next();
      
      const duration = Date.now() - start;
      const status = res.statusCode || 200;
      
      metrics.record('http.request.duration', duration, 'ms', {
        method,
        path,
        status: status.toString()
      });
      
      metrics.increment('http.requests.total', 1, {
        method,
        path,
        status: status.toString()
      });
      
      if (status >= 400) {
        metrics.increment('http.requests.errors', 1, {
          method,
          path,
          status: status.toString()
        });
      }
    } catch (error) {
      const duration = Date.now() - start;
      
      metrics.record('http.request.duration', duration, 'ms', {
        method,
        path,
        status: 'error'
      });
      
      metrics.increment('http.requests.errors', 1, {
        method,
        path,
        error: error?.constructor?.name || 'Unknown'
      });
      
      throw error;
    }
  };
}

/**
 * Export singleton instance
 */
export const metrics = new MetricsCollector();

/**
 * Convenience functions
 */
export const recordMetric = metrics.record.bind(metrics);
export const incrementCounter = metrics.increment.bind(metrics);
export const recordHistogram = metrics.histogram.bind(metrics);
export const measureTime = metrics.measureTime.bind(metrics);