/**
 * @module core/logging/logger
 * @description Core logger implementation with support for structured logging and correlation IDs
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Logger,
  LogEntry,
  LogLevelName,
  LogContext,
  LoggerConfig,
  LogFormatter,
  LogTransport,
} from './types';
import { LogLevel } from './types';

/**
 * Default logger implementation
 */
export class DefaultLogger implements Logger {
  private level: LogLevel;
  private context: LogContext;
  private correlationId?: string;
  private formatters: LogFormatter[];
  private transports: LogTransport[];
  private enableCorrelationId: boolean;

  constructor(
    private name: string,
    config: LoggerConfig = { level: LogLevel.INFO }
  ) {
    this.level = this.parseLogLevel(config.level);
    this.context = { ...config.context, logger: name };
    this.formatters = config.formatters || [];
    this.transports = config.transports || [consoleTransport];
    this.enableCorrelationId = config.enableCorrelationId ?? true;
    
    if (this.enableCorrelationId && !this.correlationId) {
      this.correlationId = uuidv4();
    }
  }

  debug(message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, undefined, data);
  }

  info(message: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, undefined, data);
  }

  warn(message: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, undefined, data);
  }

  error(message: string, error?: Error | unknown, data?: unknown): void {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    this.log(LogLevel.ERROR, message, errorObj, data);
  }

  fatal(message: string, error?: Error | unknown, data?: unknown): void {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    this.log(LogLevel.FATAL, message, errorObj, data);
  }

  child(additionalContext: LogContext): Logger {
    return new DefaultLogger(this.name, {
      level: this.level,
      context: { ...this.context, ...additionalContext },
      formatters: this.formatters,
      transports: this.transports,
      enableCorrelationId: this.enableCorrelationId,
    });
  }

  setCorrelationId(id: string): void {
    this.correlationId = id;
  }

  getCorrelationId(): string | undefined {
    return this.correlationId;
  }

  configure(config: Partial<LoggerConfig>): void {
    if (config.level !== undefined) {
      this.level = this.parseLogLevel(config.level);
    }
    if (config.context) {
      this.context = { ...this.context, ...config.context };
    }
    if (config.formatters) {
      this.formatters = config.formatters;
    }
    if (config.transports) {
      this.transports = config.transports;
    }
    if (config.enableCorrelationId !== undefined) {
      this.enableCorrelationId = config.enableCorrelationId;
    }
  }

  private log(
    level: LogLevel,
    message: string,
    error?: Error,
    data?: unknown
  ): void {
    if (level < this.level) return;

    let entry: LogEntry = {
      level,
      levelName: LogLevel[level] as LogLevelName,
      timestamp: new Date(),
      message,
      context: this.context,
      error,
      data,
      correlationId: this.correlationId,
    };

    // Apply formatters
    for (const formatter of this.formatters) {
      entry = formatter(entry);
    }

    // Send to transports
    for (const transport of this.transports) {
      try {
        const result = transport(entry);
        if (result instanceof Promise) {
          result.catch((err) => {
            console.error('Transport error:', err);
          });
        }
      } catch (err) {
        console.error('Transport error:', err);
      }
    }
  }

  private parseLogLevel(level: LogLevel | LogLevelName): LogLevel {
    if (typeof level === 'number') {
      return level;
    }
    return LogLevel[level] ?? LogLevel.INFO;
  }
}

/**
 * Default console transport
 */
export const consoleTransport: LogTransport = (entry: LogEntry) => {
  const { level, levelName, timestamp, message, context, error, data, correlationId } = entry;
  
  const prefix = `[${timestamp.toISOString()}] [${levelName}]`;
  const contextStr = context ? ` [${JSON.stringify(context)}]` : '';
  const correlationStr = correlationId ? ` [${correlationId}]` : '';
  
  const logMessage = `${prefix}${contextStr}${correlationStr} ${message}`;
  
  switch (level) {
    case LogLevel.DEBUG:
      console.debug(logMessage, data);
      break;
    case LogLevel.INFO:
      console.info(logMessage, data);
      break;
    case LogLevel.WARN:
      console.warn(logMessage, data);
      break;
    case LogLevel.ERROR:
    case LogLevel.FATAL:
      console.error(logMessage, error, data);
      break;
  }
};

/**
 * JSON formatter for structured logging
 */
export const jsonFormatter: LogFormatter = (entry: LogEntry) => {
  return {
    ...entry,
    data: {
      ...entry,
      error: entry.error ? {
        name: entry.error.name,
        message: entry.error.message,
        stack: entry.error.stack,
      } : undefined,
    },
  };
};

/**
 * Development-friendly formatter
 */
export const devFormatter: LogFormatter = (entry: LogEntry) => {
  const { context, ...rest } = entry;
  return {
    ...rest,
    context: {
      ...context,
      timestamp: entry.timestamp.toLocaleTimeString(),
    },
  };
};