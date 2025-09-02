/**
 * @module core/logging/factory
 * @description Factory for creating and managing logger instances
 */

import { DefaultLogger, consoleTransport, devFormatter, jsonFormatter } from './logger';
import type { Logger, LoggerConfig, LoggerFactory } from './types';
import { LogLevel } from './types';

/**
 * Global logger configuration
 */
let globalConfig: Partial<LoggerConfig> = {
  level: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
  transports: [consoleTransport],
  formatters: process.env.NODE_ENV === 'production' ? [jsonFormatter] : [devFormatter],
};

/**
 * Logger instance cache
 */
const loggerCache = new Map<string, Logger>();

/**
 * Create or retrieve a logger instance
 */
export const createLogger: LoggerFactory = (name: string, config?: Partial<LoggerConfig>) => {
  const cacheKey = `${name}:${JSON.stringify(config || {})}`;
  
  if (loggerCache.has(cacheKey)) {
    return loggerCache.get(cacheKey)!;
  }

  const mergedConfig: LoggerConfig = {
    ...globalConfig,
    ...config,
    level: config?.level ?? globalConfig.level ?? LogLevel.INFO,
  };

  const logger = new DefaultLogger(name, mergedConfig);
  loggerCache.set(cacheKey, logger);
  
  return logger;
};

/**
 * Configure global logger settings
 */
export function configureGlobalLogger(config: Partial<LoggerConfig>): void {
  globalConfig = { ...globalConfig, ...config };
  
  // Update existing loggers
  for (const logger of loggerCache.values()) {
    logger.configure(config);
  }
}

/**
 * Get logger for a specific module
 */
export function getLogger(module: string): Logger {
  return createLogger(module);
}

/**
 * Clear logger cache (useful for testing)
 */
export function clearLoggerCache(): void {
  loggerCache.clear();
}

/**
 * Create a logger with request context
 */
export function createRequestLogger(
  module: string,
  requestId: string,
  userId?: string
): Logger {
  return createLogger(module, {
    context: {
      requestId,
      userId,
    },
  });
}

/**
 * Create a logger for background jobs
 */
export function createJobLogger(
  jobName: string,
  jobId: string
): Logger {
  return createLogger(`job:${jobName}`, {
    context: {
      jobId,
      jobName,
    },
  });
}

/**
 * Parse log level from environment variable
 */
export function parseLogLevelFromEnv(envVar = 'LOG_LEVEL'): LogLevel {
  const levelStr = process.env[envVar]?.toUpperCase();
  
  if (levelStr && levelStr in LogLevel) {
    return LogLevel[levelStr as keyof typeof LogLevel];
  }
  
  return process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
}