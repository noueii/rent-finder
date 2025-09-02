import { db } from "~/server/db";
import { SCRAPER_LOGGER_CONFIG } from "./scraper-logger-config";

export interface ScraperLog {
  id: string;
  jobId: string;
  scraperType: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  metadata?: any;
  timestamp: Date;
}

export class ScraperLogger {
  private logs: ScraperLog[] = [];
  private maxLogsInMemory = SCRAPER_LOGGER_CONFIG.MAX_LOGS_PER_INSTANCE;
  private jobId: string;
  private scraperType: string;
  private static cleanupInterval: NodeJS.Timeout | null = null;

  constructor(jobId: string, scraperType: string) {
    this.jobId = jobId;
    this.scraperType = scraperType;
    
    // Start cleanup interval if not already running
    ScraperLogger.startCleanupInterval();
  }

  private log(level: ScraperLog['level'], message: string, metadata?: any) {
    // Skip if logging is disabled
    if (!SCRAPER_LOGGER_CONFIG.ENABLED) return;
    
    // Skip if this log level is not configured to be stored
    if (SCRAPER_LOGGER_CONFIG.STORED_LOG_LEVELS && 
        !SCRAPER_LOGGER_CONFIG.STORED_LOG_LEVELS.includes(level)) {
      return;
    }
    
    // Truncate metadata if too large
    let truncatedMetadata = metadata;
    if (metadata) {
      try {
        const metadataStr = JSON.stringify(metadata);
        if (metadataStr.length > SCRAPER_LOGGER_CONFIG.MAX_METADATA_SIZE) {
          truncatedMetadata = {
            _truncated: true,
            _originalSize: metadataStr.length,
            ...Object.fromEntries(
              Object.entries(metadata).slice(0, 5) // Keep only first 5 properties
            )
          };
        }
      } catch (e) {
        truncatedMetadata = { _error: 'Failed to stringify metadata' };
      }
    }
    
    const log: ScraperLog = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      jobId: this.jobId,
      scraperType: this.scraperType,
      level,
      message,
      metadata: truncatedMetadata,
      timestamp: new Date(),
    };

    // Add to in-memory logs
    this.logs.push(log);
    
    // Keep only recent logs in memory
    if (this.logs.length > this.maxLogsInMemory) {
      this.logs = this.logs.slice(-this.maxLogsInMemory);
    }

    // Also log to console with color coding
    const colors = {
      info: '\x1b[36m',
      warn: '\x1b[33m',
      error: '\x1b[31m',
      debug: '\x1b[90m',
    };
    const reset = '\x1b[0m';
    
    // Use direct console methods to bypass any potential pino overrides
    const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    const logMessage = `${colors[level]}[${this.scraperType}:${this.jobId.substring(0, 8)}] ${message}${reset}`;
    
    if (metadata) {
      (console as any)[consoleMethod](logMessage, metadata);
    } else {
      (console as any)[consoleMethod](logMessage);
    }

    // Store in global logs for admin panel
    ScraperLogger.addGlobalLog(log);
  }

  info(message: string, metadata?: any) {
    this.log('info', message, metadata);
  }

  warn(message: string, metadata?: any) {
    this.log('warn', message, metadata);
  }

  error(message: string, metadata?: any) {
    this.log('error', message, metadata);
  }

  debug(message: string, metadata?: any) {
    this.log('debug', message, metadata);
  }

  success(message: string, metadata?: any) {
    this.log('info', `✅ ${message}`, metadata);
  }

  getLogs(): ScraperLog[] {
    return [...this.logs];
  }

  // Static methods for global log management
  private static globalLogs: ScraperLog[] = [];
  private static maxGlobalLogs = SCRAPER_LOGGER_CONFIG.MAX_GLOBAL_LOGS;

  static addGlobalLog(log: ScraperLog) {
    this.globalLogs.push(log);
    if (this.globalLogs.length > this.maxGlobalLogs) {
      this.globalLogs = this.globalLogs.slice(-this.maxGlobalLogs);
    }
  }

  static getGlobalLogs(filters?: {
    jobId?: string;
    scraperType?: string;
    level?: ScraperLog['level'];
    since?: Date;
    limit?: number;
  }): ScraperLog[] {
    let logs = [...this.globalLogs];

    if (filters?.jobId) {
      logs = logs.filter(log => log.jobId === filters.jobId);
    }
    if (filters?.scraperType) {
      logs = logs.filter(log => log.scraperType === filters.scraperType);
    }
    if (filters?.level) {
      logs = logs.filter(log => log.level === filters.level);
    }
    if (filters?.since) {
      logs = logs.filter(log => log.timestamp >= filters.since);
    }

    // Sort by timestamp descending (newest first)
    logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (filters?.limit) {
      logs = logs.slice(0, filters.limit);
    }

    return logs;
  }

  static clearGlobalLogs() {
    this.globalLogs = [];
  }

  static getLogStats() {
    const stats = {
      total: this.globalLogs.length,
      byLevel: {
        info: 0,
        warn: 0,
        error: 0,
        debug: 0,
      },
      byScraperType: {} as Record<string, number>,
      recentErrors: [] as ScraperLog[],
    };

    for (const log of this.globalLogs) {
      stats.byLevel[log.level]++;
      stats.byScraperType[log.scraperType] = (stats.byScraperType[log.scraperType] || 0) + 1;
    }

    stats.recentErrors = this.globalLogs
      .filter(log => log.level === 'error')
      .slice(0, 10);

    return stats;
  }
  
  // Cleanup old logs based on retention time
  private static cleanupOldLogs() {
    const now = Date.now();
    const cutoffTime = now - SCRAPER_LOGGER_CONFIG.LOG_RETENTION_TIME;
    
    // Remove logs older than retention time
    this.globalLogs = this.globalLogs.filter(log => 
      log.timestamp.getTime() > cutoffTime
    );
    
    // Also ensure we don't exceed max logs
    if (this.globalLogs.length > this.maxGlobalLogs) {
      this.globalLogs = this.globalLogs.slice(-this.maxGlobalLogs);
    }
  }
  
  // Start automatic cleanup interval
  private static startCleanupInterval() {
    if (!this.cleanupInterval) {
      this.cleanupInterval = setInterval(() => {
        this.cleanupOldLogs();
      }, SCRAPER_LOGGER_CONFIG.CLEANUP_INTERVAL);
      
      // Also cleanup on first start
      this.cleanupOldLogs();
    }
  }
  
  // Stop cleanup interval (useful for testing)
  static stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Export a factory function to create loggers
export function createScraperLogger(jobId: string, scraperType: string): ScraperLogger {
  return new ScraperLogger(jobId, scraperType);
}