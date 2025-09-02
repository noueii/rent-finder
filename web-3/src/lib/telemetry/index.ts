import { NodeSDK } from "@opentelemetry/sdk-node";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { trace, metrics, SpanStatusCode, context } from "@opentelemetry/api";
import { logger } from "~/lib/logging";

const telemetryLogger = logger.child({ module: "telemetry" });

// Initialize OpenTelemetry
export const initTelemetry = () => {
  try {
    // Skip telemetry in development unless explicitly enabled
    if (process.env.NODE_ENV !== "production" && process.env.ENABLE_TELEMETRY !== "true") {
      telemetryLogger.info("Telemetry disabled in development");
      return;
    }

    // Create resource
    const resource = resourceFromAttributes({
      [ATTR_SERVICE_NAME]: "tokyo-apartment-finder",
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? "0.1.0",
      environment: process.env.NODE_ENV ?? "development",
    });

    // Create Prometheus exporter for metrics
    const prometheusExporter = new PrometheusExporter({
      port: parseInt(process.env.METRICS_PORT ?? "9464"),
      endpoint: "/metrics",
    }, () => {
      telemetryLogger.info(`Prometheus metrics server started on port ${process.env.METRICS_PORT ?? "9464"}`);
    });

    // Create OTLP trace exporter if endpoint is configured
    let traceExporter;
    if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
      traceExporter = new OTLPTraceExporter({
        url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
        headers: process.env.OTEL_EXPORTER_OTLP_HEADERS 
          ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
          : undefined,
      });
    }

    // Initialize SDK
    const sdk = new NodeSDK({
      resource,
      instrumentations: [
        getNodeAutoInstrumentations({
          "@opentelemetry/instrumentation-fs": {
            enabled: false, // Disable fs instrumentation to reduce noise
          },
        }),
      ],
      spanProcessors: traceExporter ? [new BatchSpanProcessor(traceExporter)] : [],
      metricReader: new PeriodicExportingMetricReader({
        exporter: prometheusExporter,
        exportIntervalMillis: 10000, // Export every 10 seconds
      }),
    });

    // Start the SDK
    sdk.start();
    telemetryLogger.info("OpenTelemetry initialized successfully");

    // Graceful shutdown
    process.on("SIGTERM", () => {
      sdk.shutdown()
        .then(() => telemetryLogger.info("OpenTelemetry terminated"))
        .catch((error) => telemetryLogger.error(error, "Error shutting down OpenTelemetry"));
    });
  } catch (error) {
    telemetryLogger.error(error, "Failed to initialize OpenTelemetry");
  }
};

// Get tracer instance
export const getTracer = (name: string) => {
  return trace.getTracer(name, process.env.npm_package_version ?? "0.1.0");
};

// Get meter instance
export const getMeter = (name: string) => {
  return metrics.getMeter(name, process.env.npm_package_version ?? "0.1.0");
};

// Custom span wrapper for async operations
export async function withSpan<T>(
  name: string,
  fn: () => Promise<T>,
  options?: {
    tracer?: string;
    attributes?: Record<string, any>;
  }
): Promise<T> {
  const tracer = getTracer(options?.tracer ?? "app");
  const span = tracer.startSpan(name, {
    attributes: options?.attributes,
  });

  try {
    const result = await context.with(trace.setSpan(context.active(), span), fn);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : String(error),
    });
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}

// Custom metrics
export const createMetrics = () => {
  const meter = getMeter("app-metrics");

  // HTTP metrics
  const httpRequestDuration = meter.createHistogram("http_request_duration_ms", {
    description: "Duration of HTTP requests in milliseconds",
    unit: "ms",
  });

  const httpRequestsTotal = meter.createCounter("http_requests_total", {
    description: "Total number of HTTP requests",
  });

  // Scraper metrics
  const scraperRunsTotal = meter.createCounter("scraper_runs_total", {
    description: "Total number of scraper runs",
  });

  const scraperDuration = meter.createHistogram("scraper_duration_ms", {
    description: "Duration of scraper runs in milliseconds",
    unit: "ms",
  });

  const scraperItemsScraped = meter.createCounter("scraper_items_scraped_total", {
    description: "Total number of items scraped",
  });

  // Database metrics
  const dbQueryDuration = meter.createHistogram("db_query_duration_ms", {
    description: "Duration of database queries in milliseconds",
    unit: "ms",
  });

  const dbConnectionsActive = meter.createUpDownCounter("db_connections_active", {
    description: "Number of active database connections",
  });

  // Cache metrics
  const cacheHits = meter.createCounter("cache_hits_total", {
    description: "Total number of cache hits",
  });

  const cacheMisses = meter.createCounter("cache_misses_total", {
    description: "Total number of cache misses",
  });

  // Job queue metrics
  const jobsProcessed = meter.createCounter("jobs_processed_total", {
    description: "Total number of jobs processed",
  });

  const jobsInQueue = meter.createUpDownCounter("jobs_in_queue", {
    description: "Number of jobs currently in queue",
  });

  const jobProcessingDuration = meter.createHistogram("job_processing_duration_ms", {
    description: "Duration of job processing in milliseconds",
    unit: "ms",
  });

  // Business metrics
  const searchesPerformed = meter.createCounter("searches_performed_total", {
    description: "Total number of searches performed",
  });

  const apartmentsViewed = meter.createCounter("apartments_viewed_total", {
    description: "Total number of apartment details viewed",
  });

  const listsCreated = meter.createCounter("lists_created_total", {
    description: "Total number of lists created",
  });

  return {
    http: {
      requestDuration: httpRequestDuration,
      requestsTotal: httpRequestsTotal,
    },
    scraper: {
      runsTotal: scraperRunsTotal,
      duration: scraperDuration,
      itemsScraped: scraperItemsScraped,
    },
    database: {
      queryDuration: dbQueryDuration,
      connectionsActive: dbConnectionsActive,
    },
    cache: {
      hits: cacheHits,
      misses: cacheMisses,
    },
    jobs: {
      processed: jobsProcessed,
      inQueue: jobsInQueue,
      processingDuration: jobProcessingDuration,
    },
    business: {
      searchesPerformed,
      apartmentsViewed,
      listsCreated,
    },
  };
};

// Export singleton metrics instance
export const appMetrics = createMetrics();