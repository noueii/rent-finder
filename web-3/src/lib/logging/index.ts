import pino from "pino";
import { z } from "zod";

// Log level schema
const LogLevelSchema = z.enum(["trace", "debug", "info", "warn", "error", "fatal"]);
type LogLevel = z.infer<typeof LogLevelSchema>;

// Logger configuration
const getLogLevel = (): LogLevel => {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase();
  const parsed = LogLevelSchema.safeParse(envLevel);
  
  if (parsed.success) return parsed.data;
  
  // Default log levels by environment
  switch (process.env.NODE_ENV) {
    case "production":
      return "info";
    case "test":
      return "error";
    default:
      return "debug";
  }
};

// Base logger configuration
const baseConfig: pino.LoggerOptions = {
  level: getLogLevel(),
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      hostname: bindings.hostname,
      node_version: process.version,
    }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "password",
      "token",
      "authorization",
      "cookie",
      "*.password",
      "*.token",
      "*.authorization",
      "*.cookie",
    ],
    remove: true,
  },
};

// Development configuration with pretty printing
const devConfig: pino.LoggerOptions = {
  ...baseConfig,
  // Only use transport in main thread, not in workers
  ...(process.env.NEXT_RUNTIME !== "edge" && !process.env.JEST_WORKER_ID
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            ignore: "pid,hostname",
            translateTime: "SYS:standard",
          },
        },
      }
    : {}),
};

// Production configuration optimized for performance
const prodConfig: pino.LoggerOptions = {
  ...baseConfig,
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
    req: (req: any) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      query: req.query,
      params: req.params,
      headers: {
        "user-agent": req.headers?.["user-agent"],
        "x-forwarded-for": req.headers?.["x-forwarded-for"],
      },
    }),
    res: (res: any) => ({
      statusCode: res.statusCode,
    }),
  },
};

// Create the main logger instance
// In instrumentation context, use basic config without transports
const isInstrumentation = typeof globalThis !== 'undefined' && 
  'process' in globalThis && 
  process.env.NEXT_RUNTIME === 'nodejs' &&
  !process.env.NEXT_PHASE;

export const logger = pino(
  isInstrumentation ? baseConfig : (process.env.NODE_ENV === "production" ? prodConfig : devConfig)
);

// Create child loggers for different modules
export const createLogger = (name: string, defaultMeta?: Record<string, any>) => {
  return logger.child({ module: name, ...defaultMeta });
};

// Specialized loggers
export const apiLogger = createLogger("api");
export const scraperLogger = createLogger("scraper");
export const dbLogger = createLogger("database");
export const authLogger = createLogger("auth");
export const jobLogger = createLogger("jobs");
export const cacheLogger = createLogger("cache");
export const transitLogger = createLogger("transit");
export const performanceLogger = createLogger("performance");

// Error logging helper
export const logError = (
  logger: pino.Logger,
  error: unknown,
  context?: Record<string, any>
) => {
  if (error instanceof Error) {
    logger.error({
      err: error,
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      ...context,
    }, "Error occurred");
  } else {
    logger.error({
      error: String(error),
      ...context,
    }, "Non-Error object thrown");
  }
};

// Performance logging helper
export const logPerformance = (
  operation: string,
  duration: number,
  metadata?: Record<string, any>
) => {
  const level = duration > 5000 ? "warn" : duration > 1000 ? "info" : "debug";
  performanceLogger[level]({
    operation,
    duration,
    durationMs: duration,
    ...metadata,
  }, `Operation ${operation} completed in ${duration}ms`);
};

// Request logging middleware for Next.js
export const requestLogger = (handler: any) => {
  return async (req: any, res: any) => {
    const start = Date.now();
    const requestId = Math.random().toString(36).substring(7);
    
    // Add request ID to request object
    req.id = requestId;
    
    // Log request
    apiLogger.info({
      requestId,
      method: req.method,
      url: req.url,
      headers: {
        "user-agent": req.headers["user-agent"],
        "x-forwarded-for": req.headers["x-forwarded-for"],
      },
    }, "Incoming request");
    
    // Capture response
    const originalEnd = res.end;
    res.end = function(...args: any[]) {
      const duration = Date.now() - start;
      
      // Log response
      apiLogger.info({
        requestId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
      }, "Request completed");
      
      // Log slow requests
      if (duration > 1000) {
        performanceLogger.warn({
          requestId,
          method: req.method,
          url: req.url,
          duration,
        }, "Slow request detected");
      }
      
      originalEnd.apply(res, args);
    };
    
    try {
      return await handler(req, res);
    } catch (error) {
      logError(apiLogger, error, { requestId });
      throw error;
    }
  };
};

// Export types
export type { LogLevel };
export { pino };