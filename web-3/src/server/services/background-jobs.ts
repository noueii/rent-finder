import { getJobQueue } from '~/lib/jobs/queue';
import { db } from '~/server/db';
import { getSearchIntegrationService } from '~/lib/search/search-integration';

/**
 * Initialize background job processing
 * This should be called when the server starts
 */
export function initializeBackgroundJobs(): void {
  // console.log('Initializing background job processing...');

  // Get job queue instance
  const queue = getJobQueue();

  // Initialize search integration service (which registers job processors)
  const searchService = getSearchIntegrationService(db);

  // Start processing jobs
  queue.startProcessing();

  // Set up cleanup interval (every hour)
  setInterval(() => {
    queue.cleanup(3600000); // Clean up jobs older than 1 hour
  }, 3600000);

  // Log queue statistics every 5 minutes in development
  if (process.env.NODE_ENV === 'development') {
    setInterval(() => {
      const stats = queue.getStats();
      // console.log('Job Queue Stats:', stats);
    }, 300000);
  }

  // console.log('Background job processing initialized');
}

// Initialize on module load if running in production
if (process.env.NODE_ENV === 'production') {
  initializeBackgroundJobs();
}