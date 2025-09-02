// Configuration for scraper logger to prevent memory overload
export const SCRAPER_LOGGER_CONFIG = {
  // Maximum logs per scraper instance
  MAX_LOGS_PER_INSTANCE: 100, // Reduced from 1000
  
  // Maximum global logs across all scrapers
  MAX_GLOBAL_LOGS: 1000, // Reduced from 5000
  
  // Maximum size of metadata object (in characters when stringified)
  MAX_METADATA_SIZE: 1000,
  
  // Time to keep logs in memory (milliseconds)
  LOG_RETENTION_TIME: 30 * 60 * 1000, // 30 minutes
  
  // Interval to clean up old logs (milliseconds)
  CLEANUP_INTERVAL: 5 * 60 * 1000, // 5 minutes
  
  // Log levels to store (set to null to store all)
  STORED_LOG_LEVELS: null, // or ['error', 'warn'] to only store important logs
  
  // Enable/disable logging
  ENABLED: process.env.NODE_ENV !== 'production' || process.env.ENABLE_SCRAPER_LOGS === 'true',
  
  // Memory usage monitoring
  WARN_AT_MEMORY_MB: 50, // Warn when logs use more than 50MB
  MAX_MEMORY_MB: 100, // Stop logging when logs use more than 100MB
};