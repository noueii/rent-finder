/**
 * @module core/logging/__tests__/factory.test.ts
 * @description Tests for the logger factory
 */

import { 
  createLogger, 
  getLogger, 
  configureGlobalLogger, 
  clearLoggerCache,
  createRequestLogger,
  createJobLogger,
  parseLogLevelFromEnv
} from '../factory';
import { LogLevel } from '../types';

describe('Logger Factory', () => {
  beforeEach(() => {
    clearLoggerCache();
  });

  describe('createLogger', () => {
    it('should create a logger instance', () => {
      const logger = createLogger('test-module');
      
      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.error).toBeDefined();
    });

    it('should cache logger instances', () => {
      const logger1 = createLogger('test-module');
      const logger2 = createLogger('test-module');
      
      expect(logger1).toBe(logger2);
    });

    it('should create different instances for different configs', () => {
      const logger1 = createLogger('test-module');
      const logger2 = createLogger('test-module', { level: LogLevel.ERROR });
      
      expect(logger1).not.toBe(logger2);
    });

    it('should apply custom configuration', () => {
      const mockTransport = jest.fn();
      const logger = createLogger('test-module', {
        level: LogLevel.WARN,
        transports: [mockTransport],
      });

      logger.debug('Should not log');
      logger.warn('Should log');
      
      expect(mockTransport).toHaveBeenCalledTimes(1);
    });
  });

  describe('getLogger', () => {
    it('should return a logger for the module', () => {
      const logger = getLogger('my-module');
      
      expect(logger).toBeDefined();
    });

    it('should return cached instance', () => {
      const logger1 = getLogger('my-module');
      const logger2 = getLogger('my-module');
      
      expect(logger1).toBe(logger2);
    });
  });

  describe('configureGlobalLogger', () => {
    it('should update global configuration', () => {
      const mockTransport = jest.fn();
      
      configureGlobalLogger({
        level: LogLevel.ERROR,
        transports: [mockTransport],
      });

      const logger = createLogger('test-module');
      
      logger.warn('Should not log');
      logger.error('Should log');
      
      expect(mockTransport).toHaveBeenCalledTimes(1);
    });

    it('should update existing loggers', () => {
      const mockTransport1 = jest.fn();
      const mockTransport2 = jest.fn();
      
      const logger = createLogger('test-module', {
        transports: [mockTransport1],
      });

      configureGlobalLogger({
        level: LogLevel.ERROR,
        transports: [mockTransport2],
      });

      logger.info('Should not log');
      logger.error('Should log');
      
      // New transport should be used
      expect(mockTransport1).not.toHaveBeenCalled();
      expect(mockTransport2).toHaveBeenCalledTimes(1);
    });
  });

  describe('createRequestLogger', () => {
    it('should create logger with request context', () => {
      const mockTransport = jest.fn();
      configureGlobalLogger({ transports: [mockTransport] });
      
      const logger = createRequestLogger('api', 'req-123', 'user-456');
      
      logger.info('Request processed');
      
      expect(mockTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            requestId: 'req-123',
            userId: 'user-456',
          }),
        })
      );
    });

    it('should work without userId', () => {
      const logger = createRequestLogger('api', 'req-123');
      
      expect(logger).toBeDefined();
    });
  });

  describe('createJobLogger', () => {
    it('should create logger with job context', () => {
      const mockTransport = jest.fn();
      configureGlobalLogger({ transports: [mockTransport] });
      
      const logger = createJobLogger('scrape-apartments', 'job-789');
      
      logger.info('Job started');
      
      expect(mockTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            jobId: 'job-789',
            jobName: 'scrape-apartments',
          }),
        })
      );
    });
  });

  describe('parseLogLevelFromEnv', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should parse log level from environment variable', () => {
      process.env.LOG_LEVEL = 'error';
      expect(parseLogLevelFromEnv()).toBe(LogLevel.ERROR);
      
      process.env.LOG_LEVEL = 'DEBUG';
      expect(parseLogLevelFromEnv()).toBe(LogLevel.DEBUG);
    });

    it('should use custom environment variable', () => {
      process.env.CUSTOM_LOG_LEVEL = 'warn';
      expect(parseLogLevelFromEnv('CUSTOM_LOG_LEVEL')).toBe(LogLevel.WARN);
    });

    it('should return default for invalid level', () => {
      process.env.LOG_LEVEL = 'invalid';
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'production',
        writable: true,
        configurable: true
      });
      expect(parseLogLevelFromEnv()).toBe(LogLevel.INFO);
      
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'development',
        writable: true,
        configurable: true
      });
      expect(parseLogLevelFromEnv()).toBe(LogLevel.DEBUG);
    });

    it('should return default when env var not set', () => {
      delete process.env.LOG_LEVEL;
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'production',
        writable: true,
        configurable: true
      });
      expect(parseLogLevelFromEnv()).toBe(LogLevel.INFO);
    });
  });

  describe('clearLoggerCache', () => {
    it('should clear cached loggers', () => {
      const logger1 = createLogger('test-module');
      clearLoggerCache();
      const logger2 = createLogger('test-module');
      
      expect(logger1).not.toBe(logger2);
    });
  });
});