/**
 * @module core/logging/examples/integration-examples
 * @description Examples of integrating logging with Express, tRPC, and other frameworks
 */

// Express types (if you need to use this example, install @types/express)
type Request = any;
type Response = any;
type NextFunction = any;
import { TRPCError } from '@trpc/server';
import { 
  getLogger, 
  createRequestLoggingMiddleware,
  createTRPCLoggingMiddleware,
  createErrorLoggingMiddleware,
  createPerformanceLoggingMiddleware,
} from '~/core/logging';
import { NotFoundError, ValidationError } from '~/core/errors';

// Example 1: Express middleware setup
export function expressIntegrationExample(app: any) {
  const logger = getLogger('express-app');
  
  // Request logging
  app.use(createRequestLoggingMiddleware(logger));
  
  // Performance monitoring
  app.use(createPerformanceLoggingMiddleware(logger, 500)); // Warn for requests > 500ms
  
  // Example route with logging
  app.get('/api/apartments/:id', async (req: Request, res: Response) => {
    const { logger: requestLogger } = req as any;
    const { id } = req.params;
    
    requestLogger.info('Fetching apartment', { apartmentId: id });
    
    try {
      // Simulate fetching apartment
      const apartment = await fetchApartment(id);
      
      if (!apartment) {
        requestLogger.warn('Apartment not found', { apartmentId: id });
        throw new NotFoundError('Apartment', id);
      }
      
      requestLogger.info('Apartment fetched successfully', { 
        apartmentId: id,
        stationId: apartment.stationId,
      });
      
      res.json(apartment);
    } catch (error) {
      requestLogger.error('Failed to fetch apartment', error as Error, {
        apartmentId: id,
      });
      throw error;
    }
  });
  
  // Error logging middleware (should be last)
  app.use(createErrorLoggingMiddleware(logger));
}

// Example 2: tRPC integration
export function trpcIntegrationExample() {
  const logger = getLogger('trpc-api');
  
  // Create tRPC context with logger
  async function createContext(opts: {
    req: Request;
    res: Response;
  }) {
    const requestId = opts.req.headers['x-request-id'] as string || crypto.randomUUID();
    const userId = (opts.req as any).user?.id;
    
    return {
      req: opts.req,
      res: opts.res,
      requestId,
      userId,
      logger: logger.child({ requestId, userId }),
    };
  }
  
  // Example router with logging
  // const t = initTRPC.context<typeof createContext>().create();
  // const loggedProcedure = t.procedure.use(createTRPCLoggingMiddleware(logger));
  
  // Example procedure
  const apartmentRouter = {
    search: async ({ input, ctx }: any) => {
      const { logger: procedureLogger } = ctx;
      
      procedureLogger.info('Searching apartments', {
        stationId: input.stationId,
        maxCommuteTime: input.maxCommuteTime,
      });
      
      try {
        // Validate input
        if (!input.stationId) {
          throw new ValidationError('Station ID is required', {
            field: 'stationId',
          });
        }
        
        // Perform search
        const results = await searchApartments(input);
        
        procedureLogger.info('Search completed', {
          resultsCount: results.length,
          stationId: input.stationId,
        });
        
        return results;
      } catch (error) {
        procedureLogger.error('Search failed', error as Error, {
          input,
        });
        
        // Convert to tRPC error
        if (error instanceof ValidationError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
            cause: error,
          });
        }
        
        throw error;
      }
    },
  };
  
  return apartmentRouter;
}

// Example 3: Background job logging
export function backgroundJobExample() {
  const logger = getLogger('jobs');
  
  class ApartmentScraperJob {
    private logger = logger.child({ job: 'apartment-scraper' });
    
    async run(jobId: string) {
      const jobLogger = this.logger.child({ jobId });
      
      jobLogger.info('Job started');
      
      try {
        // Track progress
        const sources = ['suumo', 'homes', 'athome'];
        
        for (const [index, source] of sources.entries()) {
          jobLogger.info('Scraping source', {
            source,
            progress: `${index + 1}/${sources.length}`,
          });
          
          try {
            const count = await this.scrapeSource(source, jobLogger);
            
            jobLogger.info('Source scraped successfully', {
              source,
              apartmentsFound: count,
            });
          } catch (error) {
            jobLogger.error(`Failed to scrape ${source}`, error as Error, {
              source,
            });
            // Continue with other sources
          }
        }
        
        jobLogger.info('Job completed successfully');
      } catch (error) {
        jobLogger.error('Job failed', error as Error);
        throw error;
      }
    }
    
    private async scrapeSource(source: string, logger: any): Promise<number> {
      const sourceLogger = logger.child({ source });
      
      sourceLogger.debug('Fetching listings page');
      // Simulate scraping
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const count = Math.floor(Math.random() * 50) + 10;
      sourceLogger.debug('Parsing apartment data', { count });
      
      return count;
    }
  }
  
  // Run the job
  const job = new ApartmentScraperJob();
  job.run('job-123');
}

// Example 4: Database query logging
export function databaseLoggingExample() {
  const logger = getLogger('database');
  
  // Prisma middleware for logging
  function createPrismaLoggingMiddleware(prisma: any) {
    prisma.$use(async (params: any, next: any) => {
      const startTime = Date.now();
      const queryLogger = logger.child({
        model: params.model,
        action: params.action,
      });
      
      queryLogger.debug('Executing query', {
        args: params.args,
      });
      
      try {
        const result = await next(params);
        const duration = Date.now() - startTime;
        
        queryLogger.debug('Query completed', {
          duration: `${duration}ms`,
          resultCount: Array.isArray(result) ? result.length : 1,
        });
        
        // Log slow queries
        if (duration > 100) {
          queryLogger.warn('Slow query detected', {
            duration: `${duration}ms`,
            threshold: '100ms',
            query: params,
          });
        }
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        queryLogger.error('Query failed', error as Error, {
          duration: `${duration}ms`,
          query: params,
        });
        
        throw error;
      }
    });
  }
  
  return createPrismaLoggingMiddleware;
}

// Example 5: WebSocket logging
export function websocketLoggingExample() {
  const logger = getLogger('websocket');
  
  class WebSocketHandler {
    private logger = logger;
    
    handleConnection(socket: any) {
      const connectionId = crypto.randomUUID();
      const socketLogger = this.logger.child({ 
        connectionId,
        clientIp: socket.remoteAddress,
      });
      
      socketLogger.info('Client connected');
      
      socket.on('message', (data: any) => {
        socketLogger.debug('Message received', {
          type: data.type,
          size: JSON.stringify(data).length,
        });
        
        try {
          this.handleMessage(data, socketLogger);
        } catch (error) {
          socketLogger.error('Failed to handle message', error as Error, {
            messageType: data.type,
          });
        }
      });
      
      socket.on('error', (error: Error) => {
        socketLogger.error('Socket error', error);
      });
      
      socket.on('close', () => {
        socketLogger.info('Client disconnected');
      });
    }
    
    private handleMessage(data: any, logger: any) {
      switch (data.type) {
        case 'subscribe':
          logger.info('Client subscribed', { 
            channel: data.channel,
          });
          break;
          
        case 'unsubscribe':
          logger.info('Client unsubscribed', { 
            channel: data.channel,
          });
          break;
          
        default:
          logger.warn('Unknown message type', { 
            type: data.type,
          });
      }
    }
  }
  
  return WebSocketHandler;
}

// Helper functions
async function fetchApartment(id: string) {
  // Simulate fetching
  if (id === 'not-found') return null;
  return { 
    id, 
    stationId: 'shibuya',
    rent: 120000,
  };
}

async function searchApartments(input: any) {
  // Simulate search
  return Array.from({ length: 10 }, (_, i) => ({
    id: `apt-${i}`,
    stationId: input.stationId,
    rent: 100000 + i * 10000,
  }));
}