import * as Sentry from "@sentry/nextjs";
import { logger } from "~/lib/logging";
import { initTelemetry, appMetrics } from "~/lib/telemetry";

const monitoringLogger = logger.child({ module: "monitoring" });

// Initialize all monitoring services
export const initMonitoring = () => {
  // Skip monitoring in edge runtime or worker processes
  if (process.env.NEXT_RUNTIME === "edge" || process.env.JEST_WORKER_ID) {
    console.log("Skipping monitoring initialization in edge/worker runtime");
    return;
  }

  try {
    monitoringLogger.info("Initializing monitoring services...");

    // Initialize OpenTelemetry
    initTelemetry();

    // Log successful initialization
    monitoringLogger.info("Monitoring services initialized successfully");

    // Set up process monitoring
    setupProcessMonitoring();

    // Set up unhandled error monitoring
    setupErrorMonitoring();
  } catch (error) {
    console.error("Failed to initialize monitoring services:", error);
    // Don't throw - allow app to continue without monitoring
  }
};

// Monitor process metrics
function setupProcessMonitoring() {
  // Monitor memory usage every 30 seconds
  setInterval(() => {
    const memUsage = process.memoryUsage();
    
    monitoringLogger.debug({
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
      },
    }, "Process memory usage");
  }, 30000);

  // Monitor event loop lag
  let lastCheck = process.hrtime.bigint();
  setInterval(() => {
    const now = process.hrtime.bigint();
    const delay = Number(now - lastCheck) / 1e6 - 100; // Expected 100ms, calculate delay
    
    if (delay > 50) {
      monitoringLogger.warn({
        eventLoopDelay: delay,
      }, "High event loop delay detected");
    }
    
    lastCheck = now;
  }, 100);
}

// Set up error monitoring
function setupErrorMonitoring() {
  // Unhandled promise rejections
  process.on("unhandledRejection", (reason, promise) => {
    monitoringLogger.error({
      error: reason,
      promise: promise.toString(),
    }, "Unhandled Promise Rejection");

    Sentry.captureException(reason, {
      tags: {
        type: "unhandledRejection",
      },
    });
  });

  // Uncaught exceptions
  process.on("uncaughtException", (error) => {
    // Use console.error as fallback if logger fails
    try {
      monitoringLogger.fatal({
        error,
      }, "Uncaught Exception");
    } catch (logError) {
      console.error("Failed to log uncaught exception:", error);
      console.error("Logger error:", logError);
    }

    // Try to capture in Sentry
    try {
      Sentry.captureException(error, {
        tags: {
          type: "uncaughtException",
        },
      });
    } catch (sentryError) {
      console.error("Failed to send to Sentry:", sentryError);
    }

    // Give Sentry time to send the error
    setTimeout(() => {
      process.exit(1);
    }, 2000);
  });

  // Process warnings
  process.on("warning", (warning) => {
    monitoringLogger.warn({
      warning: {
        name: warning.name,
        message: warning.message,
        stack: warning.stack,
      },
    }, "Process warning");
  });
}

// Custom monitoring functions
export const monitorDatabaseQuery = async <T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> => {
  const startTime = Date.now();

  try {
    const result = await queryFn();
    const duration = Date.now() - startTime;

    appMetrics.database.queryDuration.record(duration, {
      query: queryName,
      status: "success",
    });

    if (duration > 1000) {
      monitoringLogger.warn({
        query: queryName,
        duration,
      }, "Slow database query detected");
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    appMetrics.database.queryDuration.record(duration, {
      query: queryName,
      status: "error",
    });

    throw error;
  }
};

export const monitorScraperRun = async <T>(
  scraperName: string,
  scraperFn: () => Promise<T>
): Promise<T> => {
  const startTime = Date.now();

  appMetrics.scraper.runsTotal.add(1, {
    scraper: scraperName,
    status: "started",
  });

  try {
    const result = await scraperFn();
    const duration = Date.now() - startTime;

    appMetrics.scraper.runsTotal.add(1, {
      scraper: scraperName,
      status: "success",
    });

    appMetrics.scraper.duration.record(duration, {
      scraper: scraperName,
      status: "success",
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    appMetrics.scraper.runsTotal.add(1, {
      scraper: scraperName,
      status: "failed",
    });

    appMetrics.scraper.duration.record(duration, {
      scraper: scraperName,
      status: "failed",
    });

    throw error;
  }
};

export const monitorCacheOperation = (
  operation: "hit" | "miss",
  cacheKey: string
) => {
  if (operation === "hit") {
    appMetrics.cache.hits.add(1, { cache: "search", key: cacheKey });
  } else {
    appMetrics.cache.misses.add(1, { cache: "search", key: cacheKey });
  }
};

// Business metrics helpers
export const trackSearch = (searchType: string, filters?: Record<string, any>) => {
  appMetrics.business.searchesPerformed.add(1, {
    type: searchType,
    hasFilters: filters && Object.keys(filters).length > 0 ? "yes" : "no",
  });
};

export const trackApartmentView = (apartmentId: string, source: string) => {
  appMetrics.business.apartmentsViewed.add(1, {
    source,
  });
};

export const trackListCreation = (listType: string) => {
  appMetrics.business.listsCreated.add(1, {
    type: listType,
  });
};

// Export monitoring utilities
export * from "./middleware";
export { logger } from "~/lib/logging";
export { appMetrics } from "~/lib/telemetry";