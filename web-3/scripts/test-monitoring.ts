import { logger, apiLogger, scraperLogger, dbLogger } from "@/lib/logging";
import { appMetrics, withSpan } from "@/lib/telemetry";
import { 
  trackSearch, 
  trackApartmentView, 
  monitorDatabaseQuery,
  monitorScraperRun
} from "@/lib/monitoring";

async function testMonitoring() {
  console.log("🔍 Testing Monitoring Setup...\n");

  // Test 1: Logging
  console.log("1️⃣ Testing Logging...");
  logger.info("Main logger test");
  apiLogger.info({ endpoint: "/test", method: "GET" }, "API logger test");
  scraperLogger.warn({ scraper: "test", url: "https://example.com" }, "Scraper logger test");
  dbLogger.debug({ query: "SELECT * FROM test", duration: 25 }, "Database logger test");
  
  // Test error logging
  try {
    throw new Error("Test error for monitoring");
  } catch (error) {
    logger.error(error, "Caught test error");
  }
  
  console.log("✅ Logging test complete\n");

  // Test 2: Metrics
  console.log("2️⃣ Testing Metrics...");
  
  // HTTP metrics
  appMetrics.http.requestsTotal.add(1, { method: "GET", path: "/test", status: "200" });
  appMetrics.http.requestDuration.record(125, { method: "GET", path: "/test", status: "200" });
  
  // Business metrics
  trackSearch("standard", { priceMin: 50000, priceMax: 100000 });
  trackApartmentView("test-123", "search_results");
  
  // Cache metrics
  appMetrics.cache.hits.add(5, { cache: "search" });
  appMetrics.cache.misses.add(2, { cache: "search" });
  
  console.log("✅ Metrics test complete\n");

  // Test 3: Tracing
  console.log("3️⃣ Testing Tracing...");
  
  const result = await withSpan("test-operation", async () => {
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 100));
    return { success: true };
  }, {
    attributes: { testId: "123", environment: "test" }
  });
  
  console.log("✅ Tracing test complete:", result, "\n");

  // Test 4: Database Monitoring
  console.log("4️⃣ Testing Database Monitoring...");
  
  await monitorDatabaseQuery("test-query", async () => {
    // Simulate database query
    await new Promise(resolve => setTimeout(resolve, 50));
    return { rows: 10 };
  });
  
  console.log("✅ Database monitoring test complete\n");

  // Test 5: Scraper Monitoring
  console.log("5️⃣ Testing Scraper Monitoring...");
  
  try {
    await monitorScraperRun("test-scraper", async () => {
      // Simulate scraper work
      await new Promise(resolve => setTimeout(resolve, 200));
      appMetrics.scraper.itemsScraped.add(10, { scraper: "test-scraper" });
      return { itemsScraped: 10 };
    });
  } catch (error) {
    console.error("Scraper test error:", error);
  }
  
  console.log("✅ Scraper monitoring test complete\n");

  // Test 6: Check metrics endpoint
  console.log("6️⃣ Checking Metrics Endpoint...");
  try {
    const response = await fetch("http://localhost:9464/metrics");
    if (response.ok) {
      const text = await response.text();
      console.log("✅ Metrics endpoint is accessible");
      console.log("Sample metrics:", text.substring(0, 200) + "...");
    } else {
      console.log("❌ Metrics endpoint returned:", response.status);
    }
  } catch (error) {
    console.log("ℹ️ Metrics endpoint not available (this is normal if telemetry is disabled)");
  }

  console.log("\n✨ Monitoring test complete!");
  console.log("\nNext steps:");
  console.log("1. Check logs output above");
  console.log("2. If telemetry is enabled, visit http://localhost:9464/metrics");
  console.log("3. Configure Sentry DSN for error tracking");
  console.log("4. Start monitoring stack: docker-compose -f docker-compose.monitoring.yml up -d");
}

// Run tests
testMonitoring().catch(console.error);