export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      // Server-side instrumentation
      const { initMonitoring } = await import("~/lib/monitoring");
      initMonitoring();
      
      // Initialize job processors
      const { initializeProcessors } = await import("~/lib/jobs/processors");
      initializeProcessors();
    } catch (error) {
      // Log error but don't crash the app
      console.error("Failed to initialize instrumentation:", error);
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    // Edge runtime instrumentation
    // Currently minimal - can be expanded as needed
  }
}