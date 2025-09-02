/**
 * @module core/logging/transports
 * @description Custom transports for different logging destinations
 */

import type { LogTransport, LogEntry } from './types';
import { LogLevel } from './types';

/**
 * File transport for logging to files (mock implementation for browser compatibility)
 * In a real Node.js environment, this would write to actual files
 */
export const createFileTransport = (filePath: string): LogTransport => {
  return async (entry: LogEntry) => {
    // In a browser environment, we can't write to files
    // This is a mock implementation that could be replaced with actual file writing in Node.js
    if (typeof window === 'undefined') {
      // Server-side: could implement actual file writing here
      console.log(`[FileTransport] Would write to ${filePath}:`, JSON.stringify(entry));
    } else {
      // Client-side: store in localStorage as a fallback
      const logs = JSON.parse(localStorage.getItem('app-logs') || '[]');
      logs.push({
        ...entry,
        timestamp: entry.timestamp.toISOString(),
      });
      // Keep only last 1000 logs
      if (logs.length > 1000) {
        logs.splice(0, logs.length - 1000);
      }
      localStorage.setItem('app-logs', JSON.stringify(logs));
    }
  };
};

/**
 * Transport that filters by log level
 */
export const createFilteredTransport = (
  minLevel: LogLevel,
  transport: LogTransport
): LogTransport => {
  return (entry: LogEntry) => {
    if (entry.level >= minLevel) {
      return transport(entry);
    }
  };
};

/**
 * Transport that batches log entries
 */
export class BatchTransport {
  private buffer: LogEntry[] = [];
  private timer?: NodeJS.Timeout;

  constructor(
    private transport: LogTransport,
    private batchSize = 10,
    private flushInterval = 5000
  ) {}

  async log(entry: LogEntry): Promise<void> {
    this.buffer.push(entry);

    if (this.buffer.length >= this.batchSize) {
      await this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.flushInterval);
    }
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }

    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    // Send all entries at once
    for (const entry of entries) {
      await this.transport(entry);
    }
  }

  // Call this method to get the transport function
  getTransport(): LogTransport {
    return (entry: LogEntry) => this.log(entry);
  }
}

/**
 * Transport for sending logs to external service (mock implementation)
 */
export const createRemoteTransport = (
  endpoint: string,
  apiKey: string
): LogTransport => {
  const batchTransport = new BatchTransport(
    async (entry: LogEntry) => {
      try {
        // Mock implementation - replace with actual API call
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            ...entry,
            timestamp: entry.timestamp.toISOString(),
            error: entry.error ? {
              name: entry.error.name,
              message: entry.error.message,
              stack: entry.error.stack,
            } : undefined,
          }),
        });

        if (!response.ok) {
          console.error('Failed to send logs to remote service:', response.statusText);
        }
      } catch (error) {
        console.error('Error sending logs to remote service:', error);
      }
    },
    50, // batch size
    10000 // flush interval (10 seconds)
  );

  return batchTransport.getTransport();
};

/**
 * Console transport with color coding
 */
export const coloredConsoleTransport: LogTransport = (entry: LogEntry) => {
  const colors = {
    [LogLevel.DEBUG]: '\x1b[36m', // cyan
    [LogLevel.INFO]: '\x1b[32m',  // green
    [LogLevel.WARN]: '\x1b[33m',  // yellow
    [LogLevel.ERROR]: '\x1b[31m', // red
    [LogLevel.FATAL]: '\x1b[35m', // magenta
  };
  
  const reset = '\x1b[0m';
  const color = colors[entry.level] || reset;
  
  const timestamp = entry.timestamp.toLocaleTimeString();
  const level = entry.levelName.padEnd(5);
  const logger = entry.context?.logger || 'app';
  
  let message = `${color}[${timestamp}] ${level}${reset} [${logger}]`;
  
  if (entry.correlationId) {
    message += ` [${entry.correlationId.substring(0, 8)}]`;
  }
  
  message += ` ${entry.message}`;
  
  if (entry.level >= LogLevel.ERROR && entry.error) {
    console.error(message, '\n', entry.error, entry.data);
  } else if (entry.data) {
    console.log(message, entry.data);
  } else {
    console.log(message);
  }
};

/**
 * Development transport with pretty printing
 */
export const devTransport: LogTransport = (entry: LogEntry) => {
  if (typeof window !== 'undefined') {
    // Browser environment - use console with styling
    const styles = {
      [LogLevel.DEBUG]: 'color: #888; font-style: italic;',
      [LogLevel.INFO]: 'color: #4CAF50;',
      [LogLevel.WARN]: 'color: #FF9800; font-weight: bold;',
      [LogLevel.ERROR]: 'color: #F44336; font-weight: bold;',
      [LogLevel.FATAL]: 'color: #9C27B0; font-weight: bold; text-decoration: underline;',
    };
    
    const style = styles[entry.level] || '';
    const prefix = `%c[${entry.levelName}] ${entry.context?.logger || 'app'}`;
    
    console.log(prefix, style, entry.message, entry.data || '');
    
    if (entry.error) {
      console.error(entry.error);
    }
  } else {
    // Node.js environment - use colored console
    coloredConsoleTransport(entry);
  }
};