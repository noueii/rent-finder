/**
 * @module core/logging
 * @description Centralized logging system with structured logging support
 * 
 * @example
 * ```typescript
 * import { getLogger } from '~/core/logging';
 * 
 * const logger = getLogger('my-module');
 * 
 * logger.info('Starting process', { userId: 123 });
 * logger.error('Process failed', error, { attemptCount: 3 });
 * ```
 */

export * from './types';
export * from './logger';
export * from './factory';
export * from './transports';
export * from './middleware';

// Re-export commonly used functions at top level
export { getLogger, createLogger, configureGlobalLogger } from './factory';
export { LogLevel } from './types';

// Default export for convenience
import { getLogger } from './factory';
export default getLogger;