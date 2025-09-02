/**
 * @module core/logging/examples/basic-usage
 * @description Basic examples of using the logging system
 */

import { getLogger, LogLevel, configureGlobalLogger } from '~/core/logging';
import { coloredConsoleTransport, createFileTransport } from '~/core/logging/transports';

// Example 1: Basic logging
export function basicLoggingExample() {
  const logger = getLogger('apartment-service');
  
  logger.debug('Fetching apartment details', { apartmentId: 'apt-123' });
  logger.info('Apartment search completed', { 
    resultsCount: 25,
    searchTime: '142ms' 
  });
  logger.warn('API rate limit approaching', { 
    remaining: 10,
    resetTime: new Date(Date.now() + 60000) 
  });
  logger.error('Failed to fetch apartment data', new Error('Network timeout'), {
    apartmentId: 'apt-456',
    retryCount: 3
  });
}

// Example 2: Configuring logger for different environments
export function configureForEnvironment() {
  if (process.env.NODE_ENV === 'production') {
    configureGlobalLogger({
      level: LogLevel.INFO,
      transports: [
        createFileTransport('./logs/app.log'),
      ],
      enableCorrelationId: true,
    });
  } else {
    configureGlobalLogger({
      level: LogLevel.DEBUG,
      transports: [coloredConsoleTransport],
      enableCorrelationId: false,
    });
  }
}

// Example 3: Using child loggers for context
export function childLoggerExample() {
  const logger = getLogger('user-service');
  
  // Process user request
  function processUserRequest(userId: string, requestId: string) {
    const requestLogger = logger.child({
      userId,
      requestId,
      action: 'updateProfile',
    });
    
    requestLogger.info('Starting profile update');
    
    try {
      // Simulate some work
      requestLogger.debug('Validating user input');
      requestLogger.debug('Updating database');
      requestLogger.info('Profile updated successfully');
    } catch (error) {
      requestLogger.error('Profile update failed', error as Error);
    }
  }
  
  processUserRequest('user-123', 'req-456');
}

// Example 4: Correlation IDs for distributed tracing
export function correlationIdExample() {
  const logger = getLogger('api-gateway');
  
  // Simulate handling an HTTP request
  function handleRequest(correlationId: string) {
    logger.setCorrelationId(correlationId);
    
    logger.info('Received apartment search request');
    
    // Call multiple services
    callStationService(correlationId);
    callScraperService(correlationId);
    
    logger.info('Request completed');
  }
  
  function callStationService(correlationId: string) {
    const serviceLogger = getLogger('station-service');
    serviceLogger.setCorrelationId(correlationId);
    serviceLogger.info('Finding nearby stations');
  }
  
  function callScraperService(correlationId: string) {
    const serviceLogger = getLogger('scraper-service');
    serviceLogger.setCorrelationId(correlationId);
    serviceLogger.info('Scraping apartment listings');
  }
  
  handleRequest('corr-789');
}

// Example 5: Structured logging for analytics
export function structuredLoggingExample() {
  const logger = getLogger('analytics');
  
  // Log user events with structured data
  function logUserEvent(event: {
    type: string;
    userId: string;
    properties: Record<string, unknown>;
  }) {
    logger.info(`User event: ${event.type}`, {
      eventType: event.type,
      userId: event.userId,
      timestamp: new Date().toISOString(),
      ...event.properties,
    });
  }
  
  // Example events
  logUserEvent({
    type: 'search_performed',
    userId: 'user-123',
    properties: {
      stationId: 'shibuya',
      maxCommuteTime: 30,
      priceRange: { min: 80000, max: 150000 },
    },
  });
  
  logUserEvent({
    type: 'apartment_viewed',
    userId: 'user-123',
    properties: {
      apartmentId: 'apt-789',
      source: 'search_results',
      position: 3,
    },
  });
}

// Example 6: Performance logging
export function performanceLoggingExample() {
  const logger = getLogger('performance');
  
  async function measureOperation<T>(
    name: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    const childLogger = logger.child({ operation: name });
    
    childLogger.debug(`Starting ${name}`);
    
    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      
      childLogger.info(`Completed ${name}`, {
        duration: `${duration}ms`,
        success: true,
      });
      
      // Log warning for slow operations
      if (duration > 1000) {
        childLogger.warn(`Slow operation detected: ${name}`, {
          duration: `${duration}ms`,
          threshold: '1000ms',
        });
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      childLogger.error(`Failed ${name}`, error as Error, {
        duration: `${duration}ms`,
        success: false,
      });
      
      throw error;
    }
  }
  
  // Usage
  measureOperation('fetch_apartments', async () => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    return { count: 25 };
  });
}

// Example 7: Error context logging
export function errorContextLoggingExample() {
  const logger = getLogger('error-handler');
  
  class ApartmentService {
    private logger = logger.child({ service: 'ApartmentService' });
    
    async findApartment(id: string) {
      try {
        // Simulate database query
        if (!id) {
          throw new Error('Invalid apartment ID');
        }
        
        this.logger.debug('Querying database', { apartmentId: id });
        
        // Simulate not found
        if (id === 'not-found') {
          this.logger.warn('Apartment not found', { apartmentId: id });
          return null;
        }
        
        return { id, name: 'Sample Apartment' };
      } catch (error) {
        this.logger.error(
          'Failed to find apartment',
          error as Error,
          {
            apartmentId: id,
            operation: 'findApartment',
            stackTrace: (error as Error).stack,
          }
        );
        throw error;
      }
    }
  }
  
  const service = new ApartmentService();
  service.findApartment('apt-123').catch(() => {});
}