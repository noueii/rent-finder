export interface RateLimiterConfig {
  maxRequests: number;      // Maximum requests allowed
  windowMs: number;         // Time window in milliseconds
  minDelayMs?: number;      // Minimum delay between requests
  maxDelayMs?: number;      // Maximum delay for backoff
  backoffMultiplier?: number; // Multiplier for exponential backoff
}

export class RateLimiter {
  private config: Required<RateLimiterConfig>;
  private requests: number[] = []; // Timestamps of requests
  private lastRequestTime: number = 0;
  private consecutiveErrors: number = 0;

  constructor(config: RateLimiterConfig) {
    this.config = {
      maxRequests: config.maxRequests,
      windowMs: config.windowMs,
      minDelayMs: config.minDelayMs || 0,
      maxDelayMs: config.maxDelayMs || 60000,
      backoffMultiplier: config.backoffMultiplier || 2,
    };
  }

  /**
   * Check if a request can be made now
   */
  canMakeRequest(): boolean {
    this.cleanupOldRequests();
    return this.requests.length < this.config.maxRequests;
  }

  /**
   * Get the time to wait before the next request can be made
   */
  getWaitTime(): number {
    this.cleanupOldRequests();
    
    // If we're under the limit, calculate minimum delay
    if (this.requests.length < this.config.maxRequests) {
      const timeSinceLastRequest = Date.now() - this.lastRequestTime;
      const minDelay = this.getBackoffDelay();
      
      if (timeSinceLastRequest < minDelay) {
        return minDelay - timeSinceLastRequest;
      }
      
      return 0;
    }
    
    // If we're at the limit, calculate when the oldest request expires
    const oldestRequest = this.requests[0];
    const timeUntilExpiry = (oldestRequest + this.config.windowMs) - Date.now();
    
    return Math.max(0, timeUntilExpiry);
  }

  /**
   * Wait until a request can be made
   */
  async waitForSlot(): Promise<void> {
    const waitTime = this.getWaitTime();
    
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  /**
   * Record a request
   */
  recordRequest(): void {
    const now = Date.now();
    this.requests.push(now);
    this.lastRequestTime = now;
    
    // Reset consecutive errors on successful request
    this.consecutiveErrors = 0;
  }

  /**
   * Record an error (for backoff calculation)
   */
  recordError(): void {
    this.consecutiveErrors++;
  }

  /**
   * Reset error count
   */
  resetErrors(): void {
    this.consecutiveErrors = 0;
  }

  /**
   * Get current backoff delay based on consecutive errors
   */
  private getBackoffDelay(): number {
    if (this.consecutiveErrors === 0) {
      return this.config.minDelayMs;
    }
    
    const delay = this.config.minDelayMs * 
      Math.pow(this.config.backoffMultiplier, this.consecutiveErrors);
    
    return Math.min(delay, this.config.maxDelayMs);
  }

  /**
   * Remove requests outside the current time window
   */
  private cleanupOldRequests(): void {
    const now = Date.now();
    const cutoff = now - this.config.windowMs;
    
    this.requests = this.requests.filter(timestamp => timestamp > cutoff);
  }

  /**
   * Get current request count in the window
   */
  getCurrentRequestCount(): number {
    this.cleanupOldRequests();
    return this.requests.length;
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.requests = [];
    this.lastRequestTime = 0;
    this.consecutiveErrors = 0;
  }

  /**
   * Get statistics about the rate limiter
   */
  getStats(): {
    currentRequests: number;
    maxRequests: number;
    windowMs: number;
    consecutiveErrors: number;
    currentBackoffMs: number;
  } {
    this.cleanupOldRequests();
    
    return {
      currentRequests: this.requests.length,
      maxRequests: this.config.maxRequests,
      windowMs: this.config.windowMs,
      consecutiveErrors: this.consecutiveErrors,
      currentBackoffMs: this.getBackoffDelay(),
    };
  }
}

/**
 * Token bucket rate limiter for more smooth rate limiting
 */
export class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per millisecond

  constructor(maxTokens: number, refillRatePerSecond: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRatePerSecond / 1000;
    this.lastRefill = Date.now();
  }

  /**
   * Try to consume tokens
   */
  tryConsume(tokens: number = 1): boolean {
    this.refill();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    
    return false;
  }

  /**
   * Wait until tokens are available
   */
  async waitForTokens(tokens: number = 1): Promise<void> {
    this.refill();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return;
    }
    
    const tokensNeeded = tokens - this.tokens;
    const waitTime = tokensNeeded / this.refillRate;
    
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    this.refill();
    this.tokens -= tokens;
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = elapsed * this.refillRate;
    
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Get current token count
   */
  getTokens(): number {
    this.refill();
    return this.tokens;
  }

  /**
   * Reset the bucket to full
   */
  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }
}