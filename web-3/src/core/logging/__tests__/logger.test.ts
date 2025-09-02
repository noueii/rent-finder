/**
 * @module core/logging/__tests__/logger.test.ts
 * @description Tests for the logger implementation
 */

import { DefaultLogger, consoleTransport, jsonFormatter, devFormatter } from '../logger';
import { LogLevel } from '../types';
import type { LogEntry, LogTransport } from '../types';

describe('DefaultLogger', () => {
  let mockTransport: jest.Mock<void, [LogEntry]>;
  let logger: DefaultLogger;

  beforeEach(() => {
    mockTransport = jest.fn();
    logger = new DefaultLogger('test-logger', {
      level: LogLevel.DEBUG,
      transports: [mockTransport],
    });
  });

  describe('log levels', () => {
    it('should log debug messages', () => {
      logger.debug('Debug message', { data: 'test' });
      
      expect(mockTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.DEBUG,
          levelName: 'DEBUG',
          message: 'Debug message',
          data: { data: 'test' },
        })
      );
    });

    it('should log info messages', () => {
      logger.info('Info message');
      
      expect(mockTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.INFO,
          levelName: 'INFO',
          message: 'Info message',
        })
      );
    });

    it('should log warn messages', () => {
      logger.warn('Warning message');
      
      expect(mockTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.WARN,
          levelName: 'WARN',
          message: 'Warning message',
        })
      );
    });

    it('should log error messages with Error object', () => {
      const error = new Error('Test error');
      logger.error('Error occurred', error, { userId: 123 });
      
      expect(mockTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.ERROR,
          levelName: 'ERROR',
          message: 'Error occurred',
          error,
          data: { userId: 123 },
        })
      );
    });

    it('should log fatal messages', () => {
      const error = new Error('Fatal error');
      logger.fatal('System failure', error);
      
      expect(mockTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.FATAL,
          levelName: 'FATAL',
          message: 'System failure',
          error,
        })
      );
    });
  });

  describe('log level filtering', () => {
    beforeEach(() => {
      logger = new DefaultLogger('test-logger', {
        level: LogLevel.WARN,
        transports: [mockTransport],
      });
    });

    it('should not log messages below configured level', () => {
      logger.debug('Debug message');
      logger.info('Info message');
      
      expect(mockTransport).not.toHaveBeenCalled();
    });

    it('should log messages at or above configured level', () => {
      logger.warn('Warning message');
      logger.error('Error message');
      logger.fatal('Fatal message');
      
      expect(mockTransport).toHaveBeenCalledTimes(3);
    });
  });

  describe('context and correlation IDs', () => {
    it('should include context in log entries', () => {
      logger = new DefaultLogger('test-logger', {
        level: LogLevel.INFO,
        context: { service: 'test-service', version: '1.0.0' },
        transports: [mockTransport],
      });

      logger.info('Test message');
      
      expect(mockTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            service: 'test-service',
            version: '1.0.0',
            logger: 'test-logger',
          }),
        })
      );
    });

    it('should set and include correlation ID', () => {
      logger.setCorrelationId('test-correlation-id');
      logger.info('Test message');
      
      expect(mockTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: 'test-correlation-id',
        })
      );
    });

    it('should generate correlation ID when enabled', () => {
      logger = new DefaultLogger('test-logger', {
        level: LogLevel.INFO,
        transports: [mockTransport],
        enableCorrelationId: true,
      });

      logger.info('Test message');
      
      expect(mockTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
        })
      );
    });
  });

  describe('child loggers', () => {
    it('should create child logger with additional context', () => {
      const childLogger = logger.child({ userId: '123', action: 'login' });
      
      childLogger.info('User action');
      
      expect(mockTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            logger: 'test-logger',
            userId: 123,
            action: 'login',
          }),
        })
      );
    });

    it('should inherit parent correlation ID', () => {
      logger.setCorrelationId('parent-correlation-id');
      const childLogger = logger.child({ module: 'child' });
      
      expect(childLogger.getCorrelationId()).toBe('parent-correlation-id');
    });
  });

  describe('formatters', () => {
    it('should apply formatters in order', () => {
      const formatter1 = jest.fn((entry: LogEntry) => ({
        ...entry,
        message: `[F1] ${entry.message}`,
      }));
      
      const formatter2 = jest.fn((entry: LogEntry) => ({
        ...entry,
        message: `[F2] ${entry.message}`,
      }));

      logger = new DefaultLogger('test-logger', {
        level: LogLevel.INFO,
        formatters: [formatter1, formatter2],
        transports: [mockTransport],
      });

      logger.info('Test message');
      
      expect(formatter1).toHaveBeenCalled();
      expect(formatter2).toHaveBeenCalled();
      expect(mockTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '[F2] [F1] Test message',
        })
      );
    });

    it('should format with jsonFormatter', () => {
      const formattedTransport = jest.fn();
      logger = new DefaultLogger('test-logger', {
        level: LogLevel.INFO,
        formatters: [jsonFormatter],
        transports: [formattedTransport],
      });

      const error = new Error('Test error');
      logger.error('Error message', error);
      
      expect(formattedTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            error: {
              name: 'Error',
              message: 'Test error',
              stack: expect.any(String),
            },
          }),
        })
      );
    });
  });

  describe('configuration', () => {
    it('should update configuration', () => {
      logger.configure({ level: LogLevel.ERROR });
      
      logger.info('Should not log');
      logger.error('Should log');
      
      expect(mockTransport).toHaveBeenCalledTimes(1);
    });

    it('should parse string log levels', () => {
      logger = new DefaultLogger('test-logger', {
        level: 'WARN' as any,
        transports: [mockTransport],
      });

      logger.info('Should not log');
      logger.warn('Should log');
      
      expect(mockTransport).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should convert non-Error objects to Error', () => {
      logger.error('Error occurred', 'string error');
      
      expect(mockTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'string error',
          }),
        })
      );
    });

    it('should handle transport errors gracefully', () => {
      const errorTransport = jest.fn(() => {
        throw new Error('Transport error');
      });
      
      logger = new DefaultLogger('test-logger', {
        level: LogLevel.INFO,
        transports: [errorTransport, mockTransport],
      });

      // Should not throw
      expect(() => logger.info('Test message')).not.toThrow();
      
      // Second transport should still be called
      expect(mockTransport).toHaveBeenCalled();
    });

    it('should handle async transport errors', async () => {
      const asyncErrorTransport = jest.fn(async () => {
        throw new Error('Async transport error');
      });
      
      logger = new DefaultLogger('test-logger', {
        level: LogLevel.INFO,
        transports: [asyncErrorTransport],
      });

      // Should not throw
      expect(() => logger.info('Test message')).not.toThrow();
      
      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(asyncErrorTransport).toHaveBeenCalled();
    });
  });
});