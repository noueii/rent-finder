/**
 * Health check related type definitions
 */

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'error';
  responseTime: number;
  error?: string;
  details?: Record<string, any>;
}

export interface DependencyInfo {
  name: string;
  version: string;
  required: string;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'error';
  timestamp: string;
  version: string;
  uptime: number;
  services: ServiceHealth[];
  dependencies: DependencyInfo[];
  metrics: {
    responseTime: number;
    memoryUsage: number;
    cpuUsage: NodeJS.CpuUsage;
  };
}

export interface SystemMetrics {
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  cpu: NodeJS.CpuUsage;
  uptime: number;
  pid: number;
  nodeVersion: string;
  platform: string;
  timestamp: string;
}