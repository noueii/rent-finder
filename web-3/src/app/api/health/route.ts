import { NextResponse } from "next/server";
import { db } from "~/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  const checks = {
    status: "healthy" as "healthy" | "unhealthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    checks: {
      database: {
        status: "unknown" as "ok" | "error" | "unknown",
        message: "",
        responseTime: 0,
      },
      memory: {
        status: "ok" as "ok" | "warning" | "error",
        usage: {} as Record<string, number>,
      },
    },
  };

  // Check database connection
  try {
    const dbStartTime = Date.now();
    await db.$queryRaw`SELECT 1`;
    const dbResponseTime = Date.now() - dbStartTime;
    
    checks.checks.database = {
      status: "ok",
      message: "Database connection successful",
      responseTime: dbResponseTime,
    };
  } catch (error) {
    checks.status = "unhealthy";
    checks.checks.database = {
      status: "error",
      message: error instanceof Error ? error.message : "Database connection failed",
      responseTime: 0,
    };
  }

  // Check memory usage
  const memoryUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
  const rssMB = Math.round(memoryUsage.rss / 1024 / 1024);
  
  checks.checks.memory = {
    status: heapUsedMB / heapTotalMB > 0.9 ? "warning" : "ok",
    usage: {
      heapUsedMB,
      heapTotalMB,
      rssMB,
      heapUsagePercent: Math.round((heapUsedMB / heapTotalMB) * 100),
    },
  };

  // Set overall health status
  if (checks.checks.database.status === "error") {
    checks.status = "unhealthy";
  }

  const responseTime = Date.now() - startTime;
  
  return NextResponse.json(
    {
      ...checks,
      responseTime,
    },
    {
      status: checks.status === "healthy" ? 200 : 503,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    }
  );
}