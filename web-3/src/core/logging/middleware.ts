/**
 * @module core/logging/middleware
 * @description Logging middleware for HTTP requests and tRPC procedures
 */

import { v4 as uuidv4 } from 'uuid';
import { type TRPCError } from '@trpc/server';
import { type Logger } from './types';
import { createRequestLogger } from './factory';

/**
 * Express/Next.js middleware for request logging
 */
export function createRequestLoggingMiddleware(defaultLogger?: Logger) {
  return (req: any, res: any, next: any) => {
    const requestId = req.headers['x-request-id'] || uuidv4();
    const userId = req.user?.id || req.headers['x-user-id'];
    
    // Attach request ID to request object
    req.requestId = requestId;
    
    // Create request-specific logger
    const logger = defaultLogger 
      ? defaultLogger.child({ requestId, userId })
      : createRequestLogger('http', requestId, userId);
    
    // Attach logger to request
    req.logger = logger;
    
    // Log request
    logger.info(`${req.method} ${req.path}`, {
      method: req.method,
      path: req.path,
      query: req.query,
      headers: {
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type'],
      },
    });
    
    // Track response time
    const startTime = Date.now();
    
    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function(...args: any[]) {
      const duration = Date.now() - startTime;
      
      logger.info(`${req.method} ${req.path} ${res.statusCode}`, {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
      });
      
      originalEnd.apply(res, args);
    };
    
    next();
  };
}

/**
 * tRPC middleware for procedure logging
 */
export function createTRPCLoggingMiddleware(logger?: Logger) {
  return async function loggingMiddleware(opts: {
    ctx: any;
    next: any;
    path: string;
    type: 'query' | 'mutation' | 'subscription';
    rawInput: unknown;
  }) {
    const requestId = opts.ctx.requestId || uuidv4();
    const userId = opts.ctx.user?.id;
    
    const procedureLogger = logger
      ? logger.child({ requestId, userId, procedure: opts.path })
      : createRequestLogger('trpc', requestId, userId);
    
    // Attach logger to context
    opts.ctx.logger = procedureLogger;
    opts.ctx.requestId = requestId;
    
    procedureLogger.info(`${opts.type} ${opts.path} started`, {
      type: opts.type,
      path: opts.path,
      input: opts.rawInput,
    });
    
    const startTime = Date.now();
    
    try {
      const result = await opts.next({
        ctx: opts.ctx,
      });
      
      const duration = Date.now() - startTime;
      
      procedureLogger.info(`${opts.type} ${opts.path} completed`, {
        type: opts.type,
        path: opts.path,
        duration: `${duration}ms`,
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      procedureLogger.error(
        `${opts.type} ${opts.path} failed`,
        error as Error,
        {
          type: opts.type,
          path: opts.path,
          duration: `${duration}ms`,
          error: error instanceof Error ? {
            name: error.name,
            message: error.message,
            code: (error as TRPCError).code,
          } : error,
        }
      );
      
      throw error;
    }
  };
}

/**
 * Error logging middleware
 */
export function createErrorLoggingMiddleware(logger: Logger) {
  return (err: Error, req: any, res: any, next: any) => {
    const requestLogger = req.logger || logger;
    
    requestLogger.error('Unhandled error', err, {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      requestId: req.requestId,
    });
    
    next(err);
  };
}

/**
 * Performance logging middleware
 */
export function createPerformanceLoggingMiddleware(
  logger: Logger,
  slowRequestThreshold = 1000
) {
  return (req: any, res: any, next: any) => {
    const startTime = process.hrtime();
    
    const logPerformance = () => {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds * 1000 + nanoseconds / 1000000;
      
      if (duration > slowRequestThreshold) {
        const requestLogger = req.logger || logger;
        requestLogger.warn('Slow request detected', {
          method: req.method,
          path: req.path,
          duration: `${duration.toFixed(2)}ms`,
          threshold: `${slowRequestThreshold}ms`,
        });
      }
    };
    
    res.on('finish', logPerformance);
    res.on('close', logPerformance);
    
    next();
  };
}