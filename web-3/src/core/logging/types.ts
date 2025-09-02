/**
 * @module core/logging/types
 * @description Type definitions for the logging system
 */

/**
 * Log levels in order of severity
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

/**
 * Log level names for string-based configuration
 */
export type LogLevelName = keyof typeof LogLevel;

/**
 * Base structure for all log entries
 */
export interface LogEntry {
  level: LogLevel;
  levelName: LogLevelName;
  timestamp: Date;
  message: string;
  context?: LogContext;
  error?: Error;
  data?: unknown;
  correlationId?: string;
}

/**
 * Context information for structured logging
 */
export interface LogContext {
  service?: string;
  module?: string;
  userId?: string;
  requestId?: string;
  sessionId?: string;
  [key: string]: unknown;
}

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  level: LogLevel | LogLevelName;
  context?: LogContext;
  formatters?: LogFormatter[];
  transports?: LogTransport[];
  enableCorrelationId?: boolean;
}

/**
 * Function to format log entries
 */
export type LogFormatter = (entry: LogEntry) => LogEntry;

/**
 * Function to output log entries
 */
export type LogTransport = (entry: LogEntry) => void | Promise<void>;

/**
 * Logger interface
 */
export interface Logger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, error?: Error | unknown, data?: unknown): void;
  fatal(message: string, error?: Error | unknown, data?: unknown): void;
  
  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger;
  
  /**
   * Set correlation ID for all subsequent logs
   */
  setCorrelationId(id: string): void;
  
  /**
   * Get current correlation ID
   */
  getCorrelationId(): string | undefined;
  
  /**
   * Update logger configuration
   */
  configure(config: Partial<LoggerConfig>): void;
}

/**
 * Factory function to create loggers
 */
export type LoggerFactory = (name: string, config?: Partial<LoggerConfig>) => Logger;