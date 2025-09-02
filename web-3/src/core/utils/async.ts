/**
 * @module core/utils/async
 * @description Async utility functions for common patterns
 */

/**
 * Sleep for a specified number of milliseconds
 */
export const sleep = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry options
 */
export interface RetryOptions {
  attempts?: number;
  delay?: number;
  backoff?: 'linear' | 'exponential';
  maxDelay?: number;
  onRetry?: (error: Error, attempt: number) => void;
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    attempts = 3,
    delay = 1000,
    backoff = 'exponential',
    maxDelay = 30000,
    onRetry,
  } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === attempts) {
        throw lastError;
      }

      if (onRetry) {
        onRetry(lastError, attempt);
      }

      const waitTime = backoff === 'exponential'
        ? Math.min(delay * Math.pow(2, attempt - 1), maxDelay)
        : delay;

      await sleep(waitTime);
    }
  }

  throw lastError!;
}

/**
 * Run promises with concurrency limit
 */
export async function concurrent<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  limit: number
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  const executing: Promise<void>[] = [];

  for (let i = 0; i < items.length; i++) {
    const promise = fn(items[i]!, i).then(result => {
      results[i] = result;
    });

    executing.push(promise);

    if (executing.length >= limit) {
      await Promise.race(executing);
      executing.splice(executing.findIndex(p => p === promise), 1);
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * Timeout a promise
 */
export async function timeout<T>(
  promise: Promise<T>,
  ms: number,
  timeoutError = new Error(`Operation timed out after ${ms}ms`)
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(timeoutError), ms);
  });

  return Promise.race([promise, timeoutPromise]);
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle a function
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Queue for sequential processing
 */
export class Queue<T> {
  private items: T[] = [];
  private processing = false;
  private processor?: (item: T) => Promise<void>;

  constructor(processor?: (item: T) => Promise<void>) {
    this.processor = processor;
  }

  add(item: T): void {
    this.items.push(item);
    this.process();
  }

  addMany(items: T[]): void {
    this.items.push(...items);
    this.process();
  }

  setProcessor(processor: (item: T) => Promise<void>): void {
    this.processor = processor;
    this.process();
  }

  private async process(): Promise<void> {
    if (this.processing || !this.processor || this.items.length === 0) {
      return;
    }

    this.processing = true;

    while (this.items.length > 0) {
      const item = this.items.shift()!;
      try {
        await this.processor(item);
      } catch (error) {
        console.error('Queue processing error:', error);
      }
    }

    this.processing = false;
  }

  size(): number {
    return this.items.length;
  }

  clear(): void {
    this.items = [];
  }
}

/**
 * Batch items for processing
 */
export class Batcher<T> {
  private batch: T[] = [];
  private timer?: NodeJS.Timeout;

  constructor(
    private processor: (items: T[]) => Promise<void>,
    private maxSize = 100,
    private maxWait = 1000
  ) {}

  add(item: T): void {
    this.batch.push(item);

    if (this.batch.length >= this.maxSize) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.maxWait);
    }
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }

    if (this.batch.length === 0) return;

    const items = [...this.batch];
    this.batch = [];

    try {
      await this.processor(items);
    } catch (error) {
      console.error('Batch processing error:', error);
    }
  }
}

/**
 * Create a promise that can be resolved/rejected externally
 */
export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

export function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void;
  let reject: (error: Error) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve: resolve!, reject: reject! };
}