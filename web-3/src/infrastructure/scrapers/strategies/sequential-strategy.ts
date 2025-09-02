/**
 * Sequential Strategy
 * Processes URLs one at a time - safest for rate-limited sites
 */

import { BaseStrategy } from './base-strategy';
import type { ScraperContext, ExecutionResult } from './interfaces';

export class SequentialStrategy<T> extends BaseStrategy<T> {
  protected async executeInternal(
    urls: string[],
    processor: (url: string) => Promise<T>,
    context?: ScraperContext
  ): Promise<ExecutionResult<T>> {
    const result: ExecutionResult<T> = {
      success: [],
      failed: [],
      skipped: []
    };
    
    for (const url of urls) {
      // Check if stopped
      if (this.stopped) {
        result.skipped.push(...urls.slice(urls.indexOf(url)));
        break;
      }
      
      // Check error threshold
      if (this.stats.failedUrls >= this.config.errorThreshold) {
        context?.logger?.error('Error threshold reached, stopping execution');
        result.skipped.push(...urls.slice(urls.indexOf(url)));
        break;
      }
      
      // Send progress update
      this.sendProgress(context, url);
      
      // Process URL
      const { success, data, error, retries } = await this.processWithRetry(
        url, 
        processor, 
        context
      );
      
      // Update stats
      this.stats.processedUrls++;
      
      if (success && data) {
        this.stats.successfulUrls++;
        result.success.push(data);
        
        context?.logger?.info(`Successfully processed ${url}`, {
          retries,
          total: this.stats.processedUrls,
          remaining: urls.length - this.stats.processedUrls
        });
      } else {
        this.stats.failedUrls++;
        result.failed.push({ url, error: error!, retries });
        
        context?.logger?.error(`Failed to process ${url}`, {
          error: error?.message,
          retries,
          continueOnError: this.config.continueOnError
        });
        
        if (!this.config.continueOnError) {
          result.skipped.push(...urls.slice(urls.indexOf(url) + 1));
          break;
        }
      }
      
      // Send updated progress
      this.sendProgress(context);
    }
    
    return result;
  }
}