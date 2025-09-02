import { getJobQueue } from './queue';
import { UnifiedScraperFactory } from '~/lib/scrapers/unified-scraper-factory';
import { ScraperLogger } from '~/lib/logging/scraper-logger';
import { ApartmentSaver, ApartmentUpdater } from '~/lib/scrapers/utils';
import { ApartmentDetailService } from '~/lib/scrapers/services/apartment-detail-service';
import { db } from '~/server/db';
import { getSearchIntegrationService } from '~/lib/search/search-integration';
import type { Job } from './queue';
import type { ScrapeProgress } from '~/types/scraper';

// Track if processors have been initialized
let processorsInitialized = false;

interface ScrapeJobData {
  scraperType: string;
  scraperName: string;
  scraperUrl: string;
  params: {
    minPrice?: number;
    maxPrice?: number;
    minSize?: number;
    maxSize?: number;
    layout?: string[];
    limit?: number;
    fetchAll?: boolean;
  };
  userId: string;
  userName: string;
  timestamp: Date;
  action: 'search' | 'fetch-all';
  expectedLimit: number | string;
}

interface UpdateJobData {
  scraperType: string;
  scraperName: string;
  scraperUrl: string;
  urls: string[];
  userId: string;
  userName: string;
  timestamp: Date;
  action: 'update-by-urls';
  expectedLimit: number;
}

interface UpdateListDetailsJobData {
  listId: string;
  listName: string;
  filters: {
    minSize?: number;
    minScore?: number;
    limit?: number;
    source?: string;
  };
  mode: 'fast' | 'normal';
  userId: string;
  userName: string;
  timestamp: Date;
  action: 'update-list-details';
}

/**
 * Initialize all job processors
 */
export function initializeProcessors() {
  if (processorsInitialized) {
    console.log('[Job Processors] Processors already initialized, skipping...');
    return;
  }
  
  console.log('[Job Processors] Initializing processors...');
  const queue = getJobQueue();

  // Register scrape-apartment-list processor
  console.log('[Job Processors] Registering scrape-apartment-list processor');
  queue.process<ScrapeJobData>('scrape-apartment-list', async (job, updateProgress) => {
    const logger = new ScraperLogger(`job-${job.id}`, job.data.scraperType);
    logger.info(`Starting ${job.data.action} job for ${job.data.scraperName}`, { 
      jobId: job.id,
      scraper: job.data.scraperName,
      url: job.data.scraperUrl,
      action: job.data.action,
      expectedLimit: job.data.expectedLimit,
      params: job.data.params,
      user: job.data.userName,
    });

    try {
      // Update progress: Starting
      console.log('[Job Processor] Setting initial progress to 0%');
      updateProgress(0, { current: 0, total: 0, message: 'Starting job...' });
      
      // Small delay to ensure the 0% update is processed
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Update progress: Initializing
      console.log('[Job Processor] Setting progress to 5% - Initializing');
      updateProgress(5, { current: 0, total: 0, message: 'Initializing scraper...' });
      
      // Set environment variable so scraper knows it's in job context
      process.env.SCRAPER_JOB_ID = job.id;
      
      // Create scraper instance - explicitly use normal mode for update jobs
      const scraper = UnifiedScraperFactory.create(job.data.scraperType as any, undefined, 'normal');
      if (typeof scraper.setLogger === 'function') {
        scraper.setLogger(logger);
      }

      // Update progress: Ready to scrape
      updateProgress(10, { current: 0, total: 0, message: 'Starting search...' });
      
      // Track actual total from scraper
      let actualTotal = 0;
      let startTime = Date.now();
      
      // Create progress callback for scraper
      const onScraperProgress = (scrapeProgress: ScrapeProgress) => {
        console.log('[Job Processor] onScraperProgress called with:', scrapeProgress);
        
        if (scrapeProgress.total > 0 && actualTotal === 0) {
          actualTotal = scrapeProgress.total;
          logger.info(`Scraper reported total count: ${actualTotal}`);
          
          // Update job data with actual total
          if (job.data.action === 'fetch-all') {
            job.data.expectedLimit = actualTotal;
          }
        }
        
        // More granular progress calculation
        let overallProgress = 10; // Start at 10% (scraper initialized)
        
        // If we have completion info, use that for most accurate progress
        if (scrapeProgress.completed >= 0 && scrapeProgress.total > 0) {
          const completionProgress = scrapeProgress.completed / scrapeProgress.total;
          // Use 10-90% range for scraping (80% of total progress)
          overallProgress = 10 + Math.floor(completionProgress * 80);
          logger.info(`Completion-based progress: ${scrapeProgress.completed}/${scrapeProgress.total} = ${overallProgress}%`);
        } else if (scrapeProgress.currentPage && scrapeProgress.totalPages) {
          // Fallback to page-based progress if no completion info
          const pageProgress = scrapeProgress.currentPage / scrapeProgress.totalPages;
          overallProgress = 10 + Math.floor(pageProgress * 80); // 10-90% range
          logger.info(`Page-based progress: page ${scrapeProgress.currentPage}/${scrapeProgress.totalPages} = ${overallProgress}%`);
        }
        
        // Calculate estimated time remaining based on actual completion rate
        const elapsed = Date.now() - startTime;
        let estimatedTimeRemaining = 0;
        
        if (scrapeProgress.completed > 0 && scrapeProgress.total > 0) {
          // Calculate based on actual items completed
          const timePerItem = elapsed / scrapeProgress.completed;
          const remainingItems = scrapeProgress.total - scrapeProgress.completed;
          estimatedTimeRemaining = Math.round(timePerItem * remainingItems);
        } else if (overallProgress > 20) {
          // Fallback to percentage-based calculation
          const progressMade = overallProgress - 20;
          const timePerPercent = elapsed / progressMade;
          const remainingPercent = 100 - overallProgress;
          estimatedTimeRemaining = Math.round(timePerPercent * remainingPercent);
        }
        
        // Use the estimated time from scraper if available, otherwise use our calculation
        const finalEstimatedTime = scrapeProgress.estimatedTimeRemaining || estimatedTimeRemaining;
        
        console.log('[Job Processor] Calling updateProgress with:', {
          overallProgress,
          current: scrapeProgress.completed,
          total: scrapeProgress.total || actualTotal,
          estimatedTimeRemaining: finalEstimatedTime,
        });
        
        updateProgress(overallProgress, {
          current: scrapeProgress.completed,
          total: scrapeProgress.total || actualTotal,
          message: `Scraping page ${scrapeProgress.currentPage || 0} of ${scrapeProgress.totalPages || 0}`,
          estimatedTimeRemaining: finalEstimatedTime,
        });
        
        logger.info(`Progress update: ${overallProgress}%`, {
          current: scrapeProgress.completed,
          total: scrapeProgress.total,
          page: scrapeProgress.currentPage,
          totalPages: scrapeProgress.totalPages,
          estimatedTimeRemaining,
        });
      };
      
      // Create apartment saver instance for real-time saving
      const apartmentSaver = new ApartmentSaver(db);
      let savedCount = 0;
      let updatedCount = 0;
      let errorCount = 0;
      
      // Create callback for saving apartments as they're scraped
      const onApartmentReady = async (apartmentData: any) => {
        try {
          const saveResult = await apartmentSaver.saveApartments(
            [apartmentData],
            { logger }
          );
          
          savedCount += saveResult.saved;
          updatedCount += saveResult.updated;
          errorCount += saveResult.errors;
          
          logger.info(`Saved/updated apartment ${apartmentData.externalId} in real-time`, {
            saved: saveResult.saved,
            updated: saveResult.updated,
            error: saveResult.errors,
          });
        } catch (error) {
          errorCount++;
          logger.error(`Failed to save apartment ${apartmentData.externalId} in real-time`, {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      };
      
      // Run the scraper with progress callback and real-time save
      console.log('[Job Processor] Calling scraper.scrape with mapped parameters');
      
      // Map job params to scraper params
      const scrapeParams = {
        priceRange: job.data.params.minPrice || job.data.params.maxPrice ? {
          min: job.data.params.minPrice || 0,
          max: job.data.params.maxPrice || 999999999
        } : undefined,
        sizeRange: job.data.params.minSize || job.data.params.maxSize ? {
          min: job.data.params.minSize || 0,
          max: job.data.params.maxSize || 999999
        } : undefined,
        limit: job.data.params.fetchAll ? undefined : job.data.params.limit,
        updatedWithin: job.data.params.updatedWithin
      };
      
      console.log('[Job Processor] Scrape params:', scrapeParams);
      
      // Unified scrapers use 'scrape' method, not 'search'
      const result = await scraper.scrape(scrapeParams);
      
      // Update progress: Processing results
      const apartmentsFound = result.data?.length || 0;
      updateProgress(90, { 
        current: apartmentsFound, 
        total: actualTotal || apartmentsFound, 
        message: 'Saving results...' 
      });
      
      // Save the results (unified scrapers don't support real-time saving)
      let saveResults = { saved: 0, updated: 0, errors: 0 };
      if (result.success && result.data && result.data.length > 0) {
        try {
          saveResults = await apartmentSaver.saveApartments(
            result.data,
            { logger }
          );
          logger.info('Batch save complete:', saveResults);
        } catch (error) {
          logger.error('Failed to save apartments:', { 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
          saveResults.errors = result.data.length;
        }
      }
      
      logger.info(`Scraper complete:`, {
        found: apartmentsFound,
        saved: saveResults.saved,
        updated: saveResults.updated,
        errors: saveResults.errors,
      });
      
      // Update timestamps if any apartments were saved/updated
      if ((saveResults.saved > 0 || saveResults.updated > 0) && apartmentSaver) {
        await apartmentSaver.updateScrapingSourceTimestamp(job.data.scraperType);
      }
      
      // Update progress: Complete
      updateProgress(100, {
        current: apartmentsFound,
        total: actualTotal || apartmentsFound,
        message: 'Completed'
      });
      
      logger.success('Scrape job completed', {
        jobId: job.id,
        apartmentsFound,
        duration: result.metadata?.duration,
      });

      return {
        success: true,
        apartmentsFound,
        totalExpected: actualTotal || job.data.expectedLimit,
        saved: saveResults.saved,
        updated: saveResults.updated,
        saveErrors: saveResults.errors,
        metadata: result.metadata,
      };
    } catch (error) {
      logger.error('Scrape job failed', { 
        jobId: job.id, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    } finally {
      // Clean up environment variable
      delete process.env.SCRAPER_JOB_ID;
    }
  });

  // Register update-apartments-by-urls processor
  console.log('[Job Processors] Registering update-apartments-by-urls processor');
  queue.process<UpdateJobData>('update-apartments-by-urls', async (job, updateProgress) => {
    const logger = new ScraperLogger(`job-${job.id}`, job.data.scraperType);
    logger.info(`Starting apartment update job for ${job.data.scraperName}`, { 
      jobId: job.id,
      scraper: job.data.scraperName,
      urlCount: job.data.urls.length,
      user: job.data.userName,
    });

    try {
      // Update progress: Starting
      updateProgress(0, { current: 0, total: job.data.urls.length, message: 'Starting update job...' });
      
      // Create scraper instance - explicitly use normal mode for update jobs
      const scraper = UnifiedScraperFactory.create(job.data.scraperType as any, undefined, 'normal');
      if (typeof scraper.setLogger === 'function') {
        scraper.setLogger(logger);
      }

      // Update progress: Ready to fetch
      updateProgress(10, { current: 0, total: job.data.urls.length, message: 'Fetching apartment data...' });
      
      let processed = 0;
      let fetchedCount = 0;
      let updatedCount = 0;
      
      // Create progress callback for scraper
      const onFetchProgress = (scrapeProgress: ScrapeProgress) => {
        processed = scrapeProgress.completed + scrapeProgress.failed;
        
        // Calculate progress (10% to 90% for fetching and updating)
        const fetchProgress = 10 + (processed / job.data.urls.length) * 80;
        
        updateProgress(Math.round(fetchProgress), {
          current: processed,
          total: job.data.urls.length,
          message: `Fetching and updating apartments: ${processed}/${job.data.urls.length}`,
          details: {
            completed: scrapeProgress.completed,
            failed: scrapeProgress.failed,
            updated: updatedCount,
            estimatedTime: scrapeProgress.estimatedTimeRemaining,
          }
        });
      };
      
      // Callback to update DB immediately as apartments are ready
      const onApartmentReady = async (apartment: any) => {
        try {
          // Convert from BaseApartment format to ScrapedApartmentData format
          // Map scraper types to source sites
          let sourceSite = apartment.source;
          if (job.data.scraperType === 'realestate') {
            sourceSite = 'realestate.co.jp';
          } else if (job.data.scraperType === 'yolo-japan') {
            sourceSite = 'yolo-japan';
          } else if (job.data.scraperType === 'wagaya-japan') {
            sourceSite = 'wagaya-japan';
          } else if (job.data.scraperType === 'e-housing') {
            sourceSite = 'e-housing';
          } else if (job.data.scraperType === 'metro-residences') {
            sourceSite = 'metro-residences';
          }
          
          console.log(`[UPDATE JOB] Converting apartment data:`, {
            id: apartment.id,
            url: apartment.url,
            source: apartment.source,
            scraperType: job.data.scraperType,
            sourceSite: sourceSite
          });
          
          const scrapedData = {
            externalId: apartment.id,
            sourceUrl: apartment.url,
            sourceSite: sourceSite,
            agent: apartment.agent,
            title: apartment.title,
            price: apartment.rent,
            size: apartment.size,
            layout: apartment.layout,
            floor: apartment.floor ? parseInt(apartment.floor) || null : null,
            totalFloors: apartment.totalFloors,
            buildingAge: apartment.age,
            address: apartment.address,
            area: apartment.area,
            ward: apartment.ward,
            city: apartment.city,
            prefecture: apartment.prefecture,
            latitude: apartment.coordinates?.lat,
            longitude: apartment.coordinates?.lng,
            nearestStation: apartment.station?.name,
            walkingTime: apartment.station?.walkTime,
            buildingType: apartment.buildingType,
            features: apartment.features || [],
            amenities: apartment.features || [],
            images: apartment.images?.map((url, index) => ({
              url: typeof url === 'string' ? url : url.url,
              caption: '',
              order: index
            })) || [],
            managementFee: apartment.management,
            deposit: apartment.deposit,
            keyMoney: apartment.keyMoney,
            availability: 'available',
            fetchedDetails: true,
            feesTotal: (apartment.management || 0) + (apartment.deposit || 0) + (apartment.keyMoney || 0),
            feesJson: JSON.stringify({
              management: apartment.management || 0,
              deposit: apartment.deposit || 0,
              keyMoney: apartment.keyMoney || 0
            })
          };
          
          const updateResult = await ApartmentUpdater.updateApartments([scrapedData]);
          if (updateResult[0]?.updated) {
            updatedCount++;
          }
          console.log(`[UPDATE JOB] JOB -> DB: STATUS: FINISH UPDATE APT ${apartment.id} - Updated: ${updateResult[0]?.updated}`);
        } catch (error) {
          console.error(`[UPDATE JOB] JOB -> DB: STATUS: FAIL UPDATE APT ${apartment.id}: ${error}`);
        }
      };
      
      // Fetch apartments by URLs
      console.log(`[UPDATE JOB] Starting fetchApartmentsByUrls with ${job.data.urls.length} URLs`);
      
      // All scrapers now extend ApartmentScraper and have fetchApartmentsByUrls method
      console.log(`[UPDATE JOB] Calling fetchApartmentsByUrls with real-time updates...`);
      const result = await scraper.fetchApartmentsByUrls(
        job.data.urls,
        onFetchProgress,
        onApartmentReady  // Pass the callback for real-time updates
      );
      
      console.log(`[UPDATE JOB] fetchApartmentsByUrls returned:`, {
        success: result.success,
        dataLength: result.data?.length,
        dataType: Array.isArray(result.data) ? 'array' : typeof result.data,
        hasData: !!result.data,
        firstItem: result.data?.[0] ? Object.keys(result.data[0]) : null
      });
      
      // No need to process apartments here anymore - they're updated in real-time during fetch
      console.log(`[UPDATE JOB] All apartments have been processed in real-time during fetch`);
      
      console.log(`[UPDATE JOB] Fetch completed:`, {
        success: result.success,
        dataLength: result.data?.length || 0,
        errors: result.errors?.length || 0,
        stats: result.stats
      });
      
      if (!result.success && result.data?.length === 0) {
        const errorMessage = result.errors?.length > 0 ? result.errors[0].message : 'Failed to fetch apartments';
        throw new Error(errorMessage);
      }
      
      fetchedCount = result.data?.length || 0;
      console.log(`[UPDATE JOB] fetchedCount = ${fetchedCount}`);
      logger.info(`Fetched ${fetchedCount} apartments successfully`);
      
      // Final progress update
      updateProgress(95, {
        current: fetchedCount,
        total: job.data.urls.length,
        message: 'Finalizing results...'
      });
      
      // All apartments were updated in real-time
      console.log(`[UPDATE JOB] All apartments already updated in real-time`);
      console.log(`[UPDATE JOB] Final counts - Fetched: ${fetchedCount}, Updated: ${updatedCount}`);
      
      logger.info(`Database update completed`, {
        total: fetchedCount,
        updated: updatedCount,
        failed: fetchedCount - updatedCount,
      });
      
      // Update progress: Complete
      updateProgress(100, {
        current: job.data.urls.length,
        total: job.data.urls.length,
        message: 'Completed'
      });
      
      logger.success('Update job completed', {
        jobId: job.id,
        urlsProcessed: job.data.urls.length,
        apartmentsFetched: fetchedCount,
        apartmentsUpdated: updatedCount,
      });

      return {
        success: true,
        urlsProcessed: job.data.urls.length,
        apartmentsFetched: fetchedCount,
        apartmentsUpdated: updatedCount,
        updateErrors: fetchedCount - updatedCount,
        results: [], // Empty since we update in real-time
      };
    } catch (error) {
      logger.error('Update job failed', { 
        jobId: job.id, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  });

  // Register update-apartment-details-for-list processor
  console.log('[Job Processors] Registering update-apartment-details-for-list processor');
  queue.process<UpdateListDetailsJobData>('update-apartment-details-for-list', async (job, updateProgress) => {
    const logger = new ScraperLogger(`job-${job.id}`, 'list-detail-updater');
    logger.info(`Starting apartment detail update job for list ${job.data.listName}`, { 
      jobId: job.id,
      listId: job.data.listId,
      listName: job.data.listName,
      filters: job.data.filters,
      mode: job.data.mode,
      user: job.data.userName,
    });

    try {
      // Update progress: Starting
      updateProgress(0, { current: 0, total: 0, message: 'Starting list update job...' });
      
      // Update progress: Loading list
      updateProgress(5, { current: 0, total: 0, message: 'Loading list apartments...' });
      
      // Track progress
      let lastReportedProgress = 5;
      
      // Use ApartmentDetailService to update apartments with progress callback
      const results = await ApartmentDetailService.updateApartmentDetailsForList(
        job.data.listId,
        job.data.filters,
        (current, total) => {
          // Calculate progress between 5% and 95%
          const progressPercentage = 5 + Math.floor((current / total) * 90);
          
          // Only update if progress changed by at least 1%
          if (progressPercentage > lastReportedProgress) {
            lastReportedProgress = progressPercentage;
            updateProgress(progressPercentage, {
              current,
              total,
              message: `Processing apartment ${current + 1} of ${total}...`
            });
          }
        }
      );
      
      // Count results
      const totalProcessed = results.length;
      const successfulFetches = results.filter(r => r.fetchSuccess).length;
      const successfulUpdates = results.filter(r => r.updateSuccess).length;
      const fetchFailures = results.filter(r => !r.fetchSuccess).length;
      const updateFailures = results.filter(r => r.fetchSuccess && !r.updateSuccess).length;
      
      // Log individual errors for debugging
      results.filter(r => r.error).forEach(r => {
        logger.warn(`Failed to process apartment ${r.externalId}`, {
          apartmentId: r.apartmentId,
          error: r.error,
          fetchSuccess: r.fetchSuccess,
          updateSuccess: r.updateSuccess,
        });
      });
      
      // Update progress: Final processing
      updateProgress(95, {
        current: totalProcessed,
        total: totalProcessed,
        message: 'Finalizing results...'
      });
      
      // Update progress: Complete
      updateProgress(100, {
        current: totalProcessed,
        total: totalProcessed,
        message: 'Completed',
        details: {
          successfulFetches,
          successfulUpdates,
          fetchFailures,
          updateFailures,
        }
      });
      
      logger.success('List detail update job completed', {
        jobId: job.id,
        totalProcessed,
        successfulFetches,
        successfulUpdates,
        fetchFailures,
        updateFailures,
      });

      return {
        success: true,
        totalProcessed,
        successfulFetches,
        successfulUpdates,
        fetchFailures,
        updateFailures,
        results: results.map(r => ({
          apartmentId: r.apartmentId,
          externalId: r.externalId,
          success: r.updateSuccess,
          updatedFields: r.updatedFields,
          error: r.error,
        })),
      };
    } catch (error) {
      logger.error('List detail update job failed', { 
        jobId: job.id, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  });

  // Initialize search integration service (which registers commute search processors)
  console.log('[Job Processors] Initializing search integration service...');
  const searchService = getSearchIntegrationService(db);
  
  console.log('[Job Processors] All processors initialized successfully');
  processorsInitialized = true;
}

/**
 * Ensure processors are initialized
 */
export function ensureProcessorsInitialized() {
  if (!processorsInitialized) {
    initializeProcessors();
  }
}

// Export a function to get job stats for monitoring
export function getProcessorStats() {
  const queue = getJobQueue();
  return queue.getStats();
}