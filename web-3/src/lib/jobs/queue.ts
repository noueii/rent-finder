import { EventEmitter } from 'events';

export interface Job<T = any> {
  id: string;
  type: string;
  data: T;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  progressData?: {
    current: number;
    total: number;
    message?: string;
    estimatedTimeRemaining?: number;
    details?: {
      completed?: number;
      failed?: number;
      estimatedTime?: number;
    };
  };
  error?: string;
  result?: any;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  attempts: number;
  maxAttempts: number;
}

export interface QueueOptions {
  concurrency?: number;
  retryDelay?: number;
  maxRetries?: number;
}

export interface ProcessorFunction<T = any> {
  (job: Job<T>, updateProgress: (progress: number, progressData?: { 
    current: number; 
    total: number; 
    message?: string; 
    estimatedTimeRemaining?: number;
    details?: {
      completed?: number;
      failed?: number;
      estimatedTime?: number;
    };
  }) => void): Promise<any>;
}

/**
 * Simple in-memory job queue for MVP
 * In production, this would be replaced with Bull/BullMQ or similar
 */
export class JobQueue extends EventEmitter {
  private jobs = new Map<string, Job>();
  private processors = new Map<string, ProcessorFunction>();
  private processing = new Set<string>();
  private concurrency: number;
  private retryDelay: number;
  private maxRetries: number;
  private processInterval: NodeJS.Timeout | null = null;

  constructor(options: QueueOptions = {}) {
    super();
    this.concurrency = options.concurrency || 1;
    this.retryDelay = options.retryDelay || 5000;
    this.maxRetries = options.maxRetries || 3;
  }

  /**
   * Register a processor for a job type
   */
  process<T = any>(jobType: string, processor: ProcessorFunction<T>): void {
    this.processors.set(jobType, processor);
  }

  /**
   * Add a job to the queue
   */
  async add<T = any>(jobType: string, data: T): Promise<string> {
    const jobId = `${jobType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job: Job<T> = {
      id: jobId,
      type: jobType,
      data,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
      attempts: 0,
      maxAttempts: this.maxRetries,
    };

    this.jobs.set(jobId, job);
    this.emit('job:added', job);
    
    // Start processing if not already running
    this.startProcessing();
    
    return jobId;
  }

  /**
   * Get a job by ID
   */
  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs of a specific type
   */
  getJobsByType(jobType: string): Job[] {
    return Array.from(this.jobs.values()).filter(job => job.type === jobType);
  }

  /**
   * Update job progress
   */
  updateProgress(jobId: string, progress: number, progressData?: { 
    current: number; 
    total: number; 
    message?: string; 
    estimatedTimeRemaining?: number;
    details?: {
      completed?: number;
      failed?: number;
      estimatedTime?: number;
    };
  }): void {
    const job = this.jobs.get(jobId);
    if (job && job.status === 'processing') {
      job.progress = Math.min(100, Math.max(0, progress));
      if (progressData) {
        job.progressData = progressData;
      }
      // Format progress logging for better readability
      if (progressData && progressData.current > 0 && progressData.total > 0) {
        const percentage = Math.round((progressData.current / progressData.total) * 100);
        const eta = progressData.estimatedTimeRemaining 
          ? ` | ETA: ${Math.round(progressData.estimatedTimeRemaining / 1000)}s`
          : '';
        console.log(`[JobQueue] ${job.type}: ${percentage}% (${progressData.current}/${progressData.total})${eta}`);
      }
      this.emit('job:progress', job);
    }
  }

  /**
   * Start processing jobs
   */
  private startProcessing(): void {
    if (this.processInterval) return;

    this.processInterval = setInterval(() => {
      this.processNext();
    }, 1000);

    // Process immediately
    this.processNext();
  }

  /**
   * Stop processing jobs
   */
  stopProcessing(): void {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }
  }

  /**
   * Process the next available job
   */
  private async processNext(): Promise<void> {
    // Check if we can process more jobs
    if (this.processing.size >= this.concurrency) return;

    // Find next pending job that doesn't conflict with currently processing jobs
    const pendingJob = Array.from(this.jobs.values()).find(job => {
      if (job.status !== 'pending' || this.processing.has(job.id)) {
        return false;
      }
      
      // Check if this job type has special concurrency rules
      if ((job.type === 'scrape-apartment-list' || job.type === 'update-apartments-by-urls') && job.data?.scraperType) {
        // Check if the same scraper is already running (for either scraping or updating)
        const isScraperRunning = Array.from(this.jobs.values()).some(
          runningJob => 
            runningJob.status === 'processing' && 
            (runningJob.type === 'scrape-apartment-list' || runningJob.type === 'update-apartments-by-urls') &&
            runningJob.data?.scraperType === job.data?.scraperType
        );
        
        if (isScraperRunning) {
          return false; // Skip this job, same scraper is already running
        }
      }
      
      return true;
    });

    if (!pendingJob) return;

    // Get processor for this job type
    const processor = this.processors.get(pendingJob.type);
    if (!processor) {
      pendingJob.status = 'failed';
      pendingJob.error = `No processor registered for job type: ${pendingJob.type}`;
      this.emit('job:failed', pendingJob);
      return;
    }

    // Mark as processing
    this.processing.add(pendingJob.id);
    pendingJob.status = 'processing';
    pendingJob.startedAt = new Date();
    pendingJob.attempts++;
    
    // Ensure progress starts at 0 for processing jobs
    pendingJob.progress = 0;
    pendingJob.progressData = {
      current: 0,
      total: 0,
      message: 'Initializing...'
    };
    console.log(`[JobQueue] Job ${pendingJob.id} started processing with progress: ${pendingJob.progress}%`);
    
    this.emit('job:started', pendingJob);

    try {
      // Create progress updater
      const updateProgress = (progress: number, progressData?: { 
        current: number; 
        total: number; 
        message?: string; 
        estimatedTimeRemaining?: number;
        details?: {
          completed?: number;
          failed?: number;
          estimatedTime?: number;
        };
      }) => {
        this.updateProgress(pendingJob.id, progress, progressData);
      };

      // Process the job
      const result = await processor(pendingJob, updateProgress);

      // Mark as completed
      pendingJob.status = 'completed';
      pendingJob.progress = 100;
      pendingJob.result = result;
      pendingJob.completedAt = new Date();
      this.emit('job:completed', pendingJob);

    } catch (error) {
      // Handle failure
      pendingJob.error = error instanceof Error ? error.message : String(error);
      
      if (pendingJob.attempts < pendingJob.maxAttempts) {
        // Retry later
        pendingJob.status = 'pending';
        setTimeout(() => {
          this.emit('job:retry', pendingJob);
        }, this.retryDelay);
      } else {
        // Final failure
        pendingJob.status = 'failed';
        pendingJob.completedAt = new Date();
        this.emit('job:failed', pendingJob);
      }
    } finally {
      this.processing.delete(pendingJob.id);
    }
  }

  /**
   * Clean up completed/failed jobs older than specified age
   */
  cleanup(maxAgeMs: number = 3600000): void { // Default 1 hour
    const now = Date.now();
    const jobsToDelete: string[] = [];

    this.jobs.forEach((job, id) => {
      if (
        (job.status === 'completed' || job.status === 'failed') &&
        job.completedAt &&
        now - job.completedAt.getTime() > maxAgeMs
      ) {
        jobsToDelete.push(id);
      }
    });

    jobsToDelete.forEach(id => this.jobs.delete(id));
  }

  /**
   * Check if a specific scraper is already running
   */
  isScraperRunning(scraperType: string): boolean {
    return Array.from(this.jobs.values()).some(
      job => 
        job.status === 'processing' && 
        (job.type === 'scrape-apartment-list' || job.type === 'update-apartments-by-urls') &&
        job.data?.scraperType === scraperType
    );
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  } {
    const stats = {
      total: 0,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    this.jobs.forEach(job => {
      stats.total++;
      stats[job.status]++;
    });

    return stats;
  }

  /**
   * Get all jobs with their current status
   */
  getAllJobs(): Job[] {
    return Array.from(this.jobs.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get jobs by scraper type
   */
  getJobsByScraperType(scraperType: string): Job[] {
    return Array.from(this.jobs.values())
      .filter(job => job.data?.scraperType === scraperType)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

// Singleton instance
let queueInstance: JobQueue | null = null;

export function getJobQueue(): JobQueue {
  if (!queueInstance) {
    queueInstance = new JobQueue({
      concurrency: 3, // Process up to 3 jobs concurrently
      retryDelay: 5000, // 5 seconds
      maxRetries: 3,
    });
  }
  return queueInstance;
}