import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { appMetrics, withSpan } from "~/lib/telemetry";
import { apiLogger, logError } from "~/lib/logging";

export interface MonitoringContext {
  requestId: string;
  userId?: string;
  method: string;
  path: string;
  startTime: number;
}

// Extract user ID from request
const extractUserId = (request: NextRequest): string | undefined => {
  // Try to get from auth cookie/session
  const sessionCookie = request.cookies.get("next-auth.session-token");
  if (sessionCookie) {
    // In production, this would be properly decoded
    return undefined; // Placeholder
  }
  return undefined;
};

// Create monitoring context from request
export const createMonitoringContext = (request: NextRequest): MonitoringContext => {
  const requestId = Math.random().toString(36).substring(7);
  const url = new URL(request.url);
  
  return {
    requestId,
    userId: extractUserId(request),
    method: request.method,
    path: url.pathname,
    startTime: Date.now(),
  };
};

// Monitoring middleware
export async function withMonitoring(
  request: NextRequest,
  handler: (request: NextRequest, context: MonitoringContext) => Promise<NextResponse>
): Promise<NextResponse> {
  const context = createMonitoringContext(request);
  const { requestId, method, path, startTime } = context;

  // Set Sentry context
  Sentry.configureScope((scope) => {
    scope.setTag("request_id", requestId);
    scope.setContext("request", {
      method,
      path,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries()),
    });
    if (context.userId) {
      scope.setUser({ id: context.userId });
    }
  });

  // Log request
  apiLogger.info({
    requestId,
    method,
    path,
    userId: context.userId,
    userAgent: request.headers.get("user-agent"),
    ip: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip"),
  }, "Incoming request");

  // Increment request counter
  appMetrics.http.requestsTotal.add(1, {
    method,
    path: normalizePathForMetrics(path),
  });

  try {
    // Execute handler with OpenTelemetry span
    const response = await withSpan(
      `${method} ${path}`,
      async () => handler(request, context),
      {
        tracer: "http",
        attributes: {
          "http.method": method,
          "http.target": path,
          "http.url": request.url,
          "http.user_agent": request.headers.get("user-agent"),
          "user.id": context.userId,
        },
      }
    );

    // Calculate duration
    const duration = Date.now() - startTime;

    // Record metrics
    appMetrics.http.requestDuration.record(duration, {
      method,
      path: normalizePathForMetrics(path),
      status: response.status.toString(),
    });

    appMetrics.http.requestsTotal.add(1, {
      method,
      path: normalizePathForMetrics(path),
      status: response.status.toString(),
    });

    // Log response
    apiLogger.info({
      requestId,
      method,
      path,
      status: response.status,
      duration,
      userId: context.userId,
    }, "Request completed");

    // Add monitoring headers
    response.headers.set("X-Request-ID", requestId);
    response.headers.set("X-Response-Time", duration.toString());

    return response;
  } catch (error) {
    // Calculate duration
    const duration = Date.now() - startTime;

    // Log error
    logError(apiLogger, error, {
      requestId,
      method,
      path,
      duration,
      userId: context.userId,
    });

    // Record error metrics
    appMetrics.http.requestsTotal.add(1, {
      method,
      path: normalizePathForMetrics(path),
      status: "500",
    });

    // Report to Sentry
    Sentry.captureException(error, {
      tags: {
        request_id: requestId,
      },
    });

    // Return error response
    return NextResponse.json(
      {
        error: "Internal Server Error",
        requestId,
      },
      { status: 500 }
    );
  } finally {
    // Clear Sentry scope
    Sentry.configureScope((scope) => {
      scope.clear();
    });
  }
}

// Normalize path for metrics to avoid high cardinality
function normalizePathForMetrics(path: string): string {
  // Replace dynamic segments with placeholders
  return path
    .replace(/\/apartments\/[^\/]+/, "/apartments/[id]")
    .replace(/\/lists\/[^\/]+/, "/lists/[id]")
    .replace(/\/users\/[^\/]+/, "/users/[id]")
    .replace(/\/api\/trpc\/[^\/]+/, "/api/trpc/[procedure]")
    .replace(/\/auth\/[^\/]+/, "/auth/[action]");
}

// Specialized monitoring for API routes
export function withApiMonitoring(
  handler: (request: NextRequest, context: MonitoringContext) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    return withMonitoring(request, handler);
  };
}

// Monitoring for tRPC procedures
export function withTrpcMonitoring(procedureName: string) {
  return async function monitoredProcedure(opts: any) {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(7);

    // Set up context
    const userId = opts.ctx?.session?.user?.id;
    
    // Log procedure call
    apiLogger.info({
      requestId,
      procedure: procedureName,
      userId,
      input: opts.input,
    }, `tRPC procedure ${procedureName} called`);

    // Increment counter
    appMetrics.business.searchesPerformed.add(1, {
      procedure: procedureName,
    });

    try {
      // Execute with span
      const result = await withSpan(
        `trpc.${procedureName}`,
        async () => opts.next(),
        {
          tracer: "trpc",
          attributes: {
            "rpc.system": "trpc",
            "rpc.method": procedureName,
            "user.id": userId,
          },
        }
      );

      const duration = Date.now() - startTime;

      // Log success
      apiLogger.info({
        requestId,
        procedure: procedureName,
        userId,
        duration,
      }, `tRPC procedure ${procedureName} completed`);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log error
      logError(apiLogger, error, {
        requestId,
        procedure: procedureName,
        userId,
        duration,
      });

      // Report to Sentry
      Sentry.captureException(error, {
        tags: {
          request_id: requestId,
          procedure: procedureName,
        },
        user: userId ? { id: userId } : undefined,
      });

      throw error;
    }
  };
}