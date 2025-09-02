import { z } from 'zod';
import type * as cheerio from 'cheerio';
import { BaseScraper } from './base-scraper';
import type {
  ScrapedApartmentData,
  ScraperSearchParams,
  ScrapeResult,
  ScrapeProgress,
  ScrapeProgressCallback,
} from '~/types/scraper';
import { ScraperErrorCode } from '~/types/scraper';
import * as fs from 'fs';
import * as path from 'path';
import { ConcurrentProcessor } from './utils/concurrent-processor';

// Zod schema for apartment data validation
const scrapedImageSchema = z.object({
  url: z.string().url(),
  caption: z.string().optional(),
  order: z.number().optional(),
});

const scrapedStationSchema = z.object({
  name: z.string(),
  walkingMinutes: z.number().positive(),
  distance: z.number().positive().optional(),
  lines: z.array(z.string()).optional(),
});

const scrapedApartmentSchema = z.object({
  externalId: z.string(),
  sourceUrl: z.string().url(),
  sourceSite: z.string(),
  
  title: z.string(),
  price: z.number().positive(),
  size: z.number().positive(),
  layout: z.string().optional(),
  floor: z.number().optional(),
  totalFloors: z.number().optional(),
  buildingAge: z.number().optional(),
  
  address: z.string(),
  area: z.string().optional(),
  ward: z.string().optional(),
  city: z.string().optional(),
  prefecture: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  
  description: z.string().optional(),
  amenities: z.array(z.string()),
  availability: z.enum(['available', 'occupied', 'unknown']),
  
  // Fees
  feesTotal: z.number().int().min(0).optional(),
  feesJson: z.object({
    deposit: z.number().optional(),
    keyMoney: z.number().optional(),
    agencyFee: z.number().optional(),
    guarantorFee: z.number().optional(),
    insurance: z.number().optional(),
    managementFee: z.number().optional(),
    other: z.record(z.string(), z.number()).optional(),
  }).optional(),
  
  images: z.array(scrapedImageSchema),
  nearestStations: z.array(scrapedStationSchema),
});

export abstract class ApartmentScraper extends BaseScraper {
  protected logger?: any; // ScraperLogger instance
  protected progressCallback?: ScrapeProgressCallback; // Progress callback
  protected debugMode: boolean = process.env.SCRAPER_DEBUG === 'true' || process.env.NODE_ENV === 'development';
  protected debugDir: string = path.join(process.cwd(), 'debug', 'html-responses');
  
  /**
   * Set logger for this scraper instance
   */
  setLogger(logger: any): void {
    this.logger = logger;
  }
  
  /**
   * Search for apartments based on given parameters
   */
  async search(
    params: ScraperSearchParams,
    progressCallback?: ScrapeProgressCallback,
    onApartmentReady?: (apartment: ScrapedApartmentData) => Promise<void>
  ): Promise<ScrapeResult<ScrapedApartmentData[]>> {
    const apartments: ScrapedApartmentData[] = [];
    const seenApartmentIds = new Set<string>(); // Track unique apartments
    const errors: Array<{ url: string; error: unknown }> = [];
    const startTime = Date.now();
    let actualTotal = 0; // Track the actual total from scraper callback
    
    // Wrap the progress callback to capture total count
    if (progressCallback) {
      this.progressCallback = (progress: ScrapeProgress) => {
        // Capture the total count when first reported
        if (progress.total > 0 && actualTotal === 0) {
          actualTotal = progress.total;
          console.log(`[ApartmentScraper] Captured actual total from scraper: ${actualTotal}`);
        }
        progressCallback(progress);
      };
    } else {
      this.progressCallback = undefined;
    }
    
    try {
      // Check robots.txt before scraping
      const canScrape = await this.checkRobotsTxt();
      if (!canScrape) {
        return {
          success: false,
          error: {
            code: ScraperErrorCode.BLOCKED,
            message: 'Scraping not allowed by robots.txt',
            retryable: false,
            details: null,
          },
        };
      }
      
      // Get initial search URLs
      const initialSearchUrls = await this.buildSearchUrls(params);
      let currentPageNumber = 0;
      let hasMorePages = true;
      let currentUrl = initialSearchUrls[0];
      
      // For dynamic pagination, we'll track URLs as we discover them
      const processedUrls = new Set<string>();
      
      console.log(`\n📋 SCRAPING PLAN:`);
      console.log(`- Starting URL: ${currentUrl}`);
      console.log(`- Scraper: ${this.getName()}`);
      console.log(`- Dynamic pagination: ${params.fetchAll ? 'ENABLED' : 'DISABLED'}\n`);
      
      if (this.logger) {
        this.logger.info('Scraping plan created', {
          startingUrl: currentUrl,
          dynamicPagination: params.fetchAll,
          scraper: this.getName()
        });
      }
      
      const progress: ScrapeProgress = {
        total: 0,
        completed: 0,
        failed: 0,
        currentPage: 0,
        totalPages: params.fetchAll ? 999 : initialSearchUrls.length, // Unknown total for dynamic
        startedAt: new Date(),
      };
      
      // Process initial URLs first, then check for dynamic pagination
      const urlsToProcess = [...initialSearchUrls];
      let urlIndex = 0;
      
      // Continue processing while we have URLs or when dynamic pagination is enabled
      while (urlIndex < urlsToProcess.length || ((params.fetchAll || !params.limit) && hasMorePages)) {
        // Get the current URL to process
        if (urlIndex < urlsToProcess.length) {
          currentUrl = urlsToProcess[urlIndex];
        }
        
        // Skip if already processed
        if (processedUrls.has(currentUrl)) {
          urlIndex++;
          continue;
        }
        
        processedUrls.add(currentUrl);
        currentPageNumber++;
        progress.currentPage = currentPageNumber;
        
        console.log(`\n🔄 Processing search page ${currentPageNumber}`);
        console.log(`- URL: ${currentUrl}`);
        
        if (this.logger) {
          this.logger.info(`Processing search page ${currentPageNumber}`, { 
            url: currentUrl,
            pageNumber: currentPageNumber
          });
        }
        
        if (progressCallback) {
          progressCallback(progress);
        }
        
        // Add delay between pages to avoid overloading servers
        if (currentPageNumber > 1) {
          const delay = this.config.rateLimit || 1000; // Use configured rate limit
          console.log(`- Waiting ${delay}ms before next page...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        // Fetch and parse the page for next page detection
        let $currentPage: cheerio.Root | null = null;
        if ((params.fetchAll || !params.limit) && urlIndex >= initialSearchUrls.length - 1) {
          // For the last page or dynamic pagination, we need to fetch to check for next
          const pageResult = await this.fetchAndParse(currentUrl);
          if (pageResult.success && pageResult.data) {
            $currentPage = pageResult.data;
            
            // Save HTML for debugging if enabled
            if (this.debugMode) {
              await this.saveHtmlDebug(currentUrl, $.html());
            }
          }
        }
        
        const searchResult = await this.scrapeSearchPage(currentUrl, params);
        console.log(`- Search page returned ${searchResult.length} results`);
        
        if (this.logger) {
          this.logger.info(`Search page scraped`, { 
            url: currentUrl,
            resultsCount: searchResult.length
          });
        }
        
        // Handle both URL-based and direct apartment extraction
        if (searchResult.length > 0) {
          console.log(`- Handling ${searchResult.length} search results`);
          // Check if we got URLs or apartment data
          if (typeof searchResult[0] === 'string') {
            // URL-based approach (for scrapers that need detail pages)
            const listingUrls = searchResult as string[];
            progress.total += listingUrls.length;
            
            // Scrape each listing
            for (let urlIdx = 0; urlIdx < listingUrls.length; urlIdx++) {
              const listingUrl = listingUrls[urlIdx];
              try {
                const apartment = await this.scrapeApartment(listingUrl);
                
                if (apartment) {
                  // Validate the scraped data
                  const validated = await this.validateApartmentData(apartment);
                  if (validated) {
                    // Check for duplicates
                    if (!seenApartmentIds.has(validated.externalId)) {
                      seenApartmentIds.add(validated.externalId);
                      apartments.push(validated);
                      
                      // Call onApartmentReady if provided
                      if (onApartmentReady) {
                        onApartmentReady(validated).catch(err => {
                          console.error(`Error in onApartmentReady for ${validated.externalId}:`, err);
                        });
                      }
                      
                      progress.completed++;
                    } else {
                      console.log(`  - Skipping duplicate apartment: ${validated.externalId}`);
                      progress.completed++; // Still count as completed
                    }
                  } else {
                    progress.failed++;
                  }
                } else {
                  progress.failed++;
                }
                
                // Update progress after each apartment
                if (progressCallback && (urlIdx + 1) % 3 === 0) { // Update every 3 apartments
                  progressCallback(progress);
                }
              } catch (error) {
                errors.push({ url: listingUrl, error });
                progress.failed++;
              }
            }
          } else {
            // Direct apartment data approach (for scrapers that extract from search results)
            console.log(`- Using direct apartment data approach`);
            const apartmentData = searchResult as ScrapedApartmentData[];
            
            // Set total from actualTotal if available, otherwise accumulate
            if (actualTotal > 0) {
              progress.total = actualTotal;
            } else {
              progress.total += apartmentData.length;
            }
            
            console.log(`- Processing ${apartmentData.length} apartments (Total expected: ${progress.total})`);
            
            for (let idx = 0; idx < apartmentData.length; idx++) {
              const apartment = apartmentData[idx];
              console.log(`- Processing apartment ${idx + 1}/${apartmentData.length}: ${apartment.externalId}`);
              try {
                // Validate the scraped data
                console.log(`  - Validating apartment ${apartment.externalId}`);
                const validated = await this.validateApartmentData(apartment);
                console.log(`  - Validation result: ${validated ? 'SUCCESS' : 'FAILED'}`);
                
                if (this.logger) {
                  if (validated) {
                    this.logger.debug(`Apartment validated`, { 
                      externalId: apartment.externalId,
                      title: apartment.title,
                      price: apartment.price
                    });
                  } else {
                    this.logger.warn(`Apartment validation failed`, { 
                      externalId: apartment.externalId 
                    });
                  }
                }
                if (validated) {
                  // Check for duplicates
                  if (!seenApartmentIds.has(validated.externalId)) {
                    seenApartmentIds.add(validated.externalId);
                    apartments.push(validated);
                    
                    // Call onApartmentReady if provided
                    if (onApartmentReady) {
                      onApartmentReady(validated).catch(err => {
                        console.error(`Error in onApartmentReady for ${validated.externalId}:`, err);
                      });
                    }
                    
                    progress.completed++;
                  } else {
                    console.log(`  - Skipping duplicate apartment: ${validated.externalId}`);
                    progress.completed++; // Still count as completed
                  }
                  
                  // Log validated data
                  console.log(`\n✅ VALIDATED APARTMENT:`);
                  console.log(`- ID: ${validated.externalId}`);
                  console.log(`- Address: ${validated.address}`);
                  console.log(`- Area: ${validated.area || 'N/A'}`);
                  console.log(`- Ward: ${validated.ward || 'N/A'}`);
                  console.log(`- City: ${validated.city || 'N/A'}`);
                } else {
                  progress.failed++;
                  console.log(`\n❌ VALIDATION FAILED for apartment: ${apartment.externalId}`);
                }
                
                // Update progress after each apartment is processed
                if (progressCallback) {
                  // Ensure we use the actual total if available
                  const progressUpdate = {
                    ...progress,
                    total: actualTotal > 0 ? actualTotal : progress.total
                  };
                  console.log(`[ApartmentScraper] Progress update: ${progressUpdate.completed}/${progressUpdate.total}`);
                  progressCallback(progressUpdate);
                }
              } catch (error) {
                errors.push({ url: apartment.sourceUrl, error });
                progress.failed++;
                console.error(`\n❌ ERROR validating apartment: ${apartment.externalId}`, error);
              }
            }
            console.log(`- Finished processing all apartments`);
          }
        }
        
        // Check for next page if dynamic pagination is enabled
        if (params.fetchAll || !params.limit) {
          // If we haven't fetched this page yet, fetch it now for next page detection
          if (!$currentPage) {
            const pageResult = await this.fetchAndParse(currentUrl);
            if (pageResult.success && pageResult.data) {
              $currentPage = pageResult.data;
            }
          }
          
          if ($currentPage) {
            const nextPageUrl = this.getNextPageUrl($currentPage, currentUrl);
            if (nextPageUrl && !processedUrls.has(nextPageUrl)) {
              console.log(`\n📄 Dynamic pagination: Found next page!`);
              console.log(`- Next URL: ${nextPageUrl}`);
              urlsToProcess.push(nextPageUrl);
              hasMorePages = true;
            } else {
              console.log(`\n✅ Dynamic pagination: No more pages found`);
              hasMorePages = false;
            }
          }
        }
        
        console.log(`- Finished processing search page ${currentPageNumber}`);
        
        // Move to next URL index
        urlIndex++;
        
        // Update progress after each page
        if (progressCallback) {
          const elapsed = Date.now() - startTime;
          const itemsProcessed = progress.completed + progress.failed;
          const totalToProcess = actualTotal > 0 ? actualTotal : progress.total;
          const avgTimePerItem = itemsProcessed > 0 ? elapsed / itemsProcessed : 0;
          const remaining = totalToProcess - itemsProcessed;
          const estimatedTimeRemaining = remaining > 0 && avgTimePerItem > 0 ? Math.round(avgTimePerItem * remaining) : 0;
          
          // Update total pages if we discovered more
          const knownTotalPages = params.fetchAll ? 
            Math.max(currentPageNumber, urlsToProcess.length) : 
            initialSearchUrls.length;
          
          // Ensure we maintain totalPages for progress calculation
          const progressUpdate = {
            ...progress,
            total: totalToProcess,
            currentPage: currentPageNumber,
            totalPages: knownTotalPages,
            estimatedTimeRemaining
          };
          
          console.log(`[ApartmentScraper] Page ${currentPageNumber} complete. Progress: ${itemsProcessed}/${totalToProcess}, Est. time remaining: ${estimatedTimeRemaining}ms`);
          progressCallback(progressUpdate);
        }
      }
      
      console.log(`\n🏁 Creating final result...`);
      
      const finalResult = {
        success: true,
        data: apartments,
        metadata: {
          url: this.config.baseUrl,
          scrapedAt: new Date(),
          duration: Date.now() - startTime,
          retries: 0,
        },
      };
      
      console.log(`\n✅ SEARCH COMPLETED:`);
      console.log(`- Total apartments found: ${apartments.length}`);
      console.log(`- Duration: ${finalResult.metadata.duration}ms`);
      console.log(`- Success: ${finalResult.success}`);
      console.log(`- About to return result`);
      
      if (this.logger) {
        this.logger.success('Search completed', {
          apartmentsFound: apartments.length,
          duration: finalResult.metadata.duration,
          progress: {
            total: progress.total,
            completed: progress.completed,
            failed: progress.failed
          }
        });
      }
      
      return finalResult;
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error),
        metadata: {
          url: this.config.baseUrl,
          scrapedAt: new Date(),
          duration: Date.now() - startTime,
          retries: 0,
        },
      };
    }
  }

  /**
   * Scrape a single apartment listing
   */
  async scrapeApartment(url: string): Promise<ScrapedApartmentData | null> {
    console.log(`\n⚠️  FETCHING INDIVIDUAL APARTMENT DETAIL PAGE:`);
    console.log(`- URL: ${url}`);
    console.log(`- Scraper: ${this.getName()}`);
    console.log(`- Note: This is an additional request beyond search pages\n`);
    
    const result = await this.fetchAndParse(url);
    
    if (!result.success || !result.data) {
      console.error(`Failed to fetch apartment: ${url}`, result.error);
      return null;
    }
    
    try {
      const apartment = await this.extractApartmentData(result.data, url);
      return apartment;
    } catch (error) {
      console.error(`Failed to extract apartment data from: ${url}`, error);
      return null;
    }
  }

  /**
   * Validate scraped apartment data
   */
  protected async validateApartmentData(
    data: ScrapedApartmentData
  ): Promise<ScrapedApartmentData | null> {
    console.log(`    - validateApartmentData called for ${data.externalId}`);
    try {
      console.log(`    - Running zod validation...`);
      const validated = scrapedApartmentSchema.parse(data);
      console.log(`    - Validation successful`);
      return validated;
    } catch (error) {
      console.log(`    - Validation failed`);
      if (error instanceof z.ZodError) {
        console.error('Validation error:', error.errors);
      }
      return null;
    }
  }

  /**
   * Clean and normalize text
   */
  protected cleanText(text: string | undefined): string {
    if (!text) return '';
    
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, ' ')
      .trim();
  }

  /**
   * Extract number from text
   */
  protected extractNumber(text: string | undefined): number | undefined {
    if (!text) return undefined;
    
    // Remove commas and extract numbers
    const cleaned = text.replace(/,/g, '');
    const match = cleaned.match(/[\d.]+/);
    
    if (match) {
      const num = parseFloat(match[0]);
      return isNaN(num) ? undefined : num;
    }
    
    return undefined;
  }

  /**
   * Extract price in yen
   */
  protected extractPrice(text: string | undefined): number | undefined {
    if (!text) return undefined;
    
    // Remove commas and non-numeric characters except dots
    const cleaned = text.replace(/[^\d.万]/g, '');
    
    // Handle 万 (10,000) notation
    if (cleaned.includes('万')) {
      const parts = cleaned.split('万');
      const base = parseFloat(parts[0]) * 10000;
      const remainder = parts[1] ? parseFloat(parts[1]) * 1000 : 0;
      return base + remainder;
    }
    
    return this.extractNumber(text);
  }

  /**
   * Parse walking minutes from station info text
   */
  protected parseWalkingMinutes(text: string): number | undefined {
    // Common patterns: "徒歩5分", "walk 5 min", "5分", "5 minutes"
    const patterns = [
      /徒歩(\d+)分/,
      /walk\s*(\d+)\s*min/i,
      /(\d+)\s*分/,
      /(\d+)\s*minutes?/i,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return parseInt(match[1], 10);
      }
    }
    
    return undefined;
  }

  /**
   * Parse fee amount from text (handles various Japanese fee formats)
   */
  protected parseFeeAmount(text: string | undefined): number | undefined {
    if (!text) return undefined;
    
    // Handle common patterns:
    // "2ヶ月" -> 2 months
    // "1.5ヶ月" -> 1.5 months
    // "なし" / "無" / "-" / "0" -> 0
    // "100,000円" -> 100000
    
    const cleaned = this.cleanText(text);
    
    // Check for "none" patterns
    if (/^(なし|無|無し|ナシ|none|無料|0|-)$/i.test(cleaned)) {
      return 0;
    }
    
    // Check for month-based fees (e.g., "2ヶ月", "2ヵ月", "2か月", "2カ月")
    const monthMatch = cleaned.match(/([\d.]+)\s*[ヶヵかカ]?\s*月/);
    if (monthMatch) {
      return parseFloat(monthMatch[1]);
    }
    
    // Check for direct yen amounts
    const yenMatch = cleaned.match(/([\d,]+)\s*円/);
    if (yenMatch) {
      return parseInt(yenMatch[1].replace(/,/g, ''), 10);
    }
    
    // Check for 万 (10,000) notation
    if (cleaned.includes('万')) {
      return this.extractPrice(cleaned);
    }
    
    // Try to extract any number
    const numberMatch = cleaned.match(/[\d.]+/);
    if (numberMatch) {
      return parseFloat(numberMatch[0]);
    }
    
    return undefined;
  }

  /**
   * Extract fees from common Japanese rental fee structure
   * Returns fees in yen (for month-based fees, multiply by monthly rent)
   */
  protected extractFees(
    $: cheerio.CheerioAPI,
    monthlyRent: number
  ): { feesTotal?: number; feesJson?: any } {
    const fees: any = {};
    let total = 0;
    
    // Common fee selectors and patterns
    const feePatterns = [
      { key: 'deposit', patterns: ['敷金', 'しききん', 'Deposit', '保証金'] },
      { key: 'keyMoney', patterns: ['礼金', 'れいきん', 'Key Money', 'Gift Money'] },
      { key: 'agencyFee', patterns: ['仲介手数料', '仲介料', 'Agency Fee', 'Brokerage Fee'] },
      { key: 'guarantorFee', patterns: ['保証会社', '保証料', 'Guarantor Fee'] },
      { key: 'insurance', patterns: ['火災保険', '保険料', 'Insurance', 'Fire Insurance'] },
      { key: 'maintenanceFee', patterns: ['管理費', '共益費', 'Maintenance', 'Common Service'] },
      { key: 'renewalFee', patterns: ['更新料', '更新手数料', 'Renewal Fee'] },
    ];
    
    // Try to find fee information in various table/list structures
    $('table tr, dl, .fee-item, .initial-cost-item, .cost-item').each((_, element) => {
      const $el = $(element);
      const text = $el.text();
      
      for (const { key, patterns } of feePatterns) {
        for (const pattern of patterns) {
          if (text.includes(pattern)) {
            // Look for the fee value in the same element or adjacent elements
            let feeText = '';
            
            // Try different structures
            if ($el.is('tr')) {
              // Table row structure
              feeText = $el.find('td').last().text();
            } else if ($el.is('dt')) {
              // Definition list structure
              feeText = $el.next('dd').text();
            } else {
              // Generic structure - look for value after label
              const parts = text.split(/[:：]/);
              if (parts.length > 1) {
                feeText = parts[1];
              }
            }
            
            const feeAmount = this.parseFeeAmount(feeText);
            if (feeAmount !== undefined) {
              // If it's a month-based fee (like 2ヶ月), multiply by rent
              if (feeText.includes('月') && feeAmount < 10) {
                fees[key] = Math.round(feeAmount * monthlyRent);
              } else {
                fees[key] = feeAmount;
              }
              break; // Found this fee, move to next
            }
          }
        }
      }
    });
    
    // Calculate total
    for (const [key, value] of Object.entries(fees)) {
      if (typeof value === 'number' && key !== 'maintenanceFee') {
        // Don't include monthly maintenance fee in total
        total += value;
      }
    }
    
    return {
      feesTotal: total > 0 ? total : undefined,
      feesJson: Object.keys(fees).length > 0 ? fees : undefined,
    };
  }


  /**
   * Save HTML to debug folder for analysis
   */
  protected async saveHtmlDebug(url: string, html: string): Promise<void> {
    if (!this.debugMode) return;
    
    try {
      // Extract scraper type from the class name
      const scraperType = this.scraperType || this.getName().toLowerCase().replace(/\s+scraper/i, '').replace(/\s+/g, '-');
      
      // Create debug directory structure
      const scraperDebugDir = path.join(this.debugDir, scraperType);
      if (!fs.existsSync(scraperDebugDir)) {
        fs.mkdirSync(scraperDebugDir, { recursive: true });
      }
      
      // Create filename from URL
      const urlObj = new URL(url);
      const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
      const pathPart = urlObj.pathname.replace(/\//g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
      const queryPart = urlObj.search.replace(/[?&=]/g, '_').replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 100);
      const filename = `${scraperType}_${timestamp}_${pathPart}${queryPart}.html`;
      
      const filePath = path.join(scraperDebugDir, filename);
      
      // Write HTML to file
      fs.writeFileSync(filePath, html, 'utf-8');
      console.log(`📝 Saved HTML debug to: ${path.relative(process.cwd(), filePath)}`);
      
      // Clean up old files (keep only last 50 per scraper)
      const files = fs.readdirSync(scraperDebugDir)
        .filter(f => f.endsWith('.html'))
        .map(f => ({ name: f, path: path.join(scraperDebugDir, f), mtime: fs.statSync(path.join(scraperDebugDir, f)).mtime }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      
      if (files.length > 50) {
        files.slice(50).forEach(f => {
          fs.unlinkSync(f.path);
          console.log(`🗑️  Cleaned up old debug file: ${f.name}`);
        });
      }
    } catch (error) {
      console.error('Failed to save HTML debug:', error);
    }
  }

  /**
   * Abstract methods that must be implemented by specific scrapers
   */
  
  /**
   * Build search URLs based on search parameters
   */
  protected abstract buildSearchUrls(params: ScraperSearchParams): Promise<string[]>;
  
  /**
   * Scrape a search results page and return listing URLs or apartment data
   * Can return either:
   * - string[] for URL-based scrapers that need to fetch detail pages
   * - ScrapedApartmentData[] for scrapers that extract data directly from search results
   */
  protected abstract scrapeSearchPage(
    url: string,
    params: ScraperSearchParams
  ): Promise<string[] | ScrapedApartmentData[]>;
  
  /**
   * Extract apartment data from a listing page
   */
  protected abstract extractApartmentData(
    $: cheerio.CheerioAPI,
    url: string
  ): Promise<ScrapedApartmentData | null>;

  /**
   * Check if the current page is the last page of results
   * Used for fetchAll feature to stop pagination when the last page is reached
   * @param $ Cheerio instance of the current page
   * @param currentPageUrl The URL of the current page being scraped
   * @returns true if this is the last page, false otherwise
   */
  protected abstract isLastScrapePage($: cheerio.Root, currentPageUrl: string): boolean;
  
  /**
   * Get the next page URL if available
   * This is a more reliable way to handle pagination by following actual next page links
   * @param $ Cheerio instance of the current page
   * @param currentPageUrl The URL of the current page being scraped
   * @returns The next page URL or null if no next page exists
   */
  protected abstract getNextPageUrl($: cheerio.Root, currentPageUrl: string): string | null;

  /**
   * Search for an apartment by its external ID
   * This method retrieves detailed information about a specific apartment
   * @param externalId The external ID of the apartment on the source site
   * @returns The apartment data if found, null otherwise
   */
  async searchById(externalId: string): Promise<ScrapeResult<ScrapedApartmentData | null>> {
    const startTime = Date.now();
    
    try {
      // Check robots.txt before scraping
      const canScrape = await this.checkRobotsTxt();
      if (!canScrape) {
        return {
          success: false,
          error: {
            code: ScraperErrorCode.BLOCKED,
            message: 'Scraping not allowed by robots.txt',
            retryable: false,
            details: null,
          },
        };
      }
      
      console.log(`\n🔍 SEARCHING FOR APARTMENT BY ID:`);
      console.log(`- External ID: ${externalId}`);
      console.log(`- Scraper: ${this.getName()}\n`);
      
      if (this.logger) {
        this.logger.info('Searching for apartment by ID', {
          externalId,
          scraper: this.getName()
        });
      }
      
      // Build the URL for the specific apartment
      const apartmentUrl = await this.buildApartmentUrl(externalId);
      
      if (!apartmentUrl) {
        return {
          success: false,
          error: {
            code: ScraperErrorCode.NOT_FOUND,
            message: `Unable to build URL for apartment ID: ${externalId}`,
            retryable: false,
            details: null,
          },
        };
      }
      
      console.log(`- URL: ${apartmentUrl}`);
      
      // Scrape the apartment details
      const apartment = await this.scrapeApartment(apartmentUrl);
      
      if (apartment) {
        // Validate the scraped data
        const validated = await this.validateApartmentData(apartment);
        
        if (validated) {
          console.log(`\n✅ APARTMENT FOUND:`);
          console.log(`- ID: ${validated.externalId}`);
          console.log(`- Title: ${validated.title}`);
          console.log(`- Price: ¥${validated.price.toLocaleString()}`);
          
          if (this.logger) {
            this.logger.success('Apartment found by ID', {
              externalId: validated.externalId,
              title: validated.title,
              price: validated.price
            });
          }
          
          return {
            success: true,
            data: validated,
            metadata: {
              url: apartmentUrl,
              scrapedAt: new Date(),
              duration: Date.now() - startTime,
              retries: 0,
            },
          };
        }
      }
      
      // Apartment not found or validation failed
      return {
        success: false,
        error: {
          code: ScraperErrorCode.NOT_FOUND,
          message: `Apartment with ID ${externalId} not found or validation failed`,
          retryable: false,
          details: null,
        },
        metadata: {
          url: apartmentUrl,
          scrapedAt: new Date(),
          duration: Date.now() - startTime,
          retries: 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error),
        metadata: {
          url: this.config.baseUrl,
          scrapedAt: new Date(),
          duration: Date.now() - startTime,
          retries: 0,
        },
      };
    }
  }

  /**
   * Build the URL for a specific apartment by its external ID
   * Each scraper must implement this to construct the correct detail page URL
   * @param externalId The external ID of the apartment
   * @returns The URL for the apartment detail page, or null if unable to build
   */
  protected abstract buildApartmentUrl(externalId: string): Promise<string | null>;

  /**
   * Fetch multiple apartments by their URLs with progress tracking
   * This method is optimized for updating existing apartments with fresh data
   * particularly station distances and images
   * @param urls Array of apartment URLs to fetch
   * @param progressCallback Optional callback for progress updates
   * @returns Array of successfully fetched apartments
   */
  async fetchApartmentsByUrls(
    urls: string[],
    progressCallback?: ScrapeProgressCallback
  ): Promise<ScrapeResult<ScrapedApartmentData[]>> {
    const apartments: ScrapedApartmentData[] = [];
    const errors: Array<{ url: string; error: unknown }> = [];
    const startTime = Date.now();
    
    try {
      // Check robots.txt before scraping
      const canScrape = await this.checkRobotsTxt();
      if (!canScrape) {
        return {
          success: false,
          error: {
            code: ScraperErrorCode.BLOCKED,
            message: 'Scraping not allowed by robots.txt',
            retryable: false,
            details: null,
          },
        };
      }
      
      console.log(`\n📋 BULK APARTMENT FETCH PLAN:`);
      console.log(`- Total apartments to fetch: ${urls.length}`);
      console.log(`- Scraper: ${this.getName()}`);
      console.log(`- Purpose: Update station distances and images\n`);
      
      if (this.logger) {
        this.logger.info('Bulk apartment fetch started', {
          totalUrls: urls.length,
          scraper: this.getName()
        });
      }
      
      const progress: ScrapeProgress = {
        total: urls.length,
        completed: 0,
        failed: 0,
        startedAt: new Date(),
      };
      
      // Report initial progress
      if (progressCallback) {
        progressCallback(progress);
      }
      
      // Process each URL
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        
        console.log(`\n🔄 Fetching apartment ${i + 1}/${urls.length}`);
        console.log(`- URL: ${url}`);
        
        if (this.logger) {
          this.logger.info(`Fetching apartment ${i + 1}/${urls.length}`, { 
            url,
            index: i + 1,
            total: urls.length
          });
        }
        
        // Add delay between requests to avoid rate limiting
        if (i > 0) {
          const delay = this.config.rateLimit || 1000; // Use configured rate limit or 1 second
          console.log(`- Waiting ${delay}ms before next request...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        try {
          // Check if this URL belongs to this scraper
          if (!this.isUrlSupported(url)) {
            console.log(`- Skipping: URL not supported by ${this.getName()}`);
            progress.failed++;
            errors.push({ 
              url, 
              error: new Error(`URL not supported by ${this.getName()}`) 
            });
            continue;
          }
          
          // Extract apartment ID from URL
          const externalId = await this.extractIdFromUrl(url);
          if (!externalId) {
            console.log(`- Failed to extract ID from URL`);
            progress.failed++;
            errors.push({ 
              url, 
              error: new Error('Failed to extract apartment ID from URL') 
            });
            continue;
          }
          
          console.log(`- Extracted ID: ${externalId}`);
          
          // Fetch the apartment data using getApartmentDetails which checks for removal
          let apartment: ScrapedApartmentData | null = null;
          
          // Check if scraper has getApartmentDetails method (which includes removal check)
          if ('getApartmentDetails' in this && typeof (this as any).getApartmentDetails === 'function') {
            apartment = await (this as any).getApartmentDetails(url);
          } else {
            // Fallback to scrapeApartment if getApartmentDetails is not available
            apartment = await this.scrapeApartment(url);
          }
          
          if (apartment) {
            // Check if apartment was marked as removed
            if ((apartment as any)._isRemoved) {
              console.log(`✅ Apartment marked as removed:`);
              console.log(`  - ID: ${externalId}`);
              console.log(`  - Reason: ${(apartment as any)._removalReason}`);
              console.log(`  - Confidence: ${(apartment as any)._removalConfidence}`);
              
              // Add to results so it can be processed by the updater
              apartments.push(apartment);
              progress.completed++;
            } else {
              // Validate the scraped data
              const validated = await this.validateApartmentData(apartment);
              if (validated) {
                apartments.push(validated);
                
                // Note: onApartmentReady callback is not available in fetchApartmentsByUrls
                // It should be handled by the caller after receiving all results
                
                progress.completed++;
                
                console.log(`✅ Successfully fetched apartment:`);
                console.log(`  - ID: ${validated.externalId}`);
                console.log(`  - Stations: ${validated.nearestStations.length}`);
                console.log(`  - Images: ${validated.images.length}`);
              
              if (this.logger) {
                this.logger.success('Apartment fetched', {
                  externalId: validated.externalId,
                  stationCount: validated.nearestStations.length,
                  imageCount: validated.images.length
                });
              }
            } else {
              progress.failed++;
              errors.push({ url, error: new Error('Validation failed') });
              console.log(`❌ Validation failed for apartment`);
            }
            }
          } else {
            progress.failed++;
            errors.push({ url, error: new Error('Failed to scrape apartment') });
            console.log(`❌ Failed to scrape apartment`);
          }
        } catch (error) {
          console.error(`❌ Error fetching apartment:`, error);
          errors.push({ url, error });
          progress.failed++;
          
          if (this.logger) {
            this.logger.error('Error fetching apartment', {
              url,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
        
        // Update progress
        if (progressCallback) {
          const elapsed = Date.now() - startTime;
          const itemsProcessed = progress.completed + progress.failed;
          const avgTimePerItem = itemsProcessed > 0 ? elapsed / itemsProcessed : 0;
          const remaining = progress.total - itemsProcessed;
          const estimatedTimeRemaining = remaining > 0 && avgTimePerItem > 0 
            ? Math.round(avgTimePerItem * remaining) 
            : 0;
          
          progressCallback({
            ...progress,
            estimatedTimeRemaining
          });
        }
      }
      
      const finalResult = {
        success: true,
        data: apartments,
        metadata: {
          url: this.config.baseUrl,
          scrapedAt: new Date(),
          duration: Date.now() - startTime,
          retries: 0,
        },
      };
      
      console.log(`\n✅ BULK FETCH COMPLETED:`);
      console.log(`- Total apartments fetched: ${apartments.length}/${urls.length}`);
      console.log(`- Failed: ${progress.failed}`);
      console.log(`- Duration: ${finalResult.metadata.duration}ms`);
      
      if (errors.length > 0) {
        console.log(`\n⚠️  ERRORS ENCOUNTERED:`);
        errors.forEach(({ url, error }) => {
          console.log(`- ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        });
      }
      
      if (this.logger) {
        this.logger.success('Bulk fetch completed', {
          totalFetched: apartments.length,
          totalUrls: urls.length,
          failed: progress.failed,
          duration: finalResult.metadata.duration
        });
      }
      
      return finalResult;
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error),
        metadata: {
          url: this.config.baseUrl,
          scrapedAt: new Date(),
          duration: Date.now() - startTime,
          retries: 0,
        },
      };
    }
  }

  /**
   * Fetch multiple apartments concurrently by their URLs
   * Uses proxy rotation and concurrent workers for faster processing
   * @param urls Array of apartment URLs to fetch
   * @param maxConcurrency Maximum number of concurrent requests (default: based on proxy count)
   * @param progressCallback Optional callback for progress updates
   * @returns Array of successfully fetched apartments
   */
  async fetchApartmentsByUrlsConcurrent(
    urls: string[],
    maxConcurrency?: number,
    progressCallback?: ScrapeProgressCallback
  ): Promise<ScrapeResult<ScrapedApartmentData[]>> {
    const startTime = Date.now();
    
    try {
      // Check robots.txt before scraping
      const canScrape = await this.checkRobotsTxt();
      if (!canScrape) {
        return {
          success: false,
          error: {
            code: ScraperErrorCode.BLOCKED,
            message: 'Scraping not allowed by robots.txt',
            retryable: false,
            details: null,
          },
        };
      }
      
      // Calculate optimal concurrency based on proxy availability
      const proxyCount = this.proxyManager.getAvailableCount();
      const optimalConcurrency = maxConcurrency || ConcurrentProcessor.calculateOptimalConcurrency(proxyCount);
      
      console.log(`\n🚀 CONCURRENT APARTMENT FETCH:`);
      console.log(`- Total apartments: ${urls.length}`);
      console.log(`- Available proxies: ${proxyCount}`);
      console.log(`- Concurrent workers: ${optimalConcurrency}`);
      console.log(`- Rate limit per worker: ${this.config.rateLimit}ms`);
      console.log(`- Estimated time: ${Math.ceil(urls.length / optimalConcurrency * this.config.rateLimit / 1000)}s\n`);
      
      if (this.logger) {
        this.logger.info('Concurrent apartment fetch started', {
          totalUrls: urls.length,
          concurrency: optimalConcurrency,
          proxyCount,
          scraper: this.getName()
        });
      }
      
      const progress: ScrapeProgress = {
        total: urls.length,
        completed: 0,
        failed: 0,
        startedAt: new Date(),
      };
      
      // Processor function for each URL
      const processUrl = async (url: string, index: number): Promise<ScrapedApartmentData | null> => {
        console.log(`[Worker] Processing ${index + 1}/${urls.length}: ${url}`);
        
        // Check if URL is supported
        if (!this.isUrlSupported(url)) {
          throw new Error(`URL not supported by ${this.getName()}`);
        }
        
        // Extract apartment ID
        const externalId = await this.extractIdFromUrl(url);
        if (!externalId) {
          throw new Error('Failed to extract apartment ID from URL');
        }
        
        // Fetch the apartment
        const apartment = await this.scrapeApartment(url);
        if (!apartment) {
          throw new Error('Failed to scrape apartment');
        }
        
        // Validate the data
        const validated = await this.validateApartmentData(apartment);
        if (!validated) {
          throw new Error('Validation failed');
        }
        
        return validated;
      };
      
      // Process URLs concurrently
      const { results, errors } = await ConcurrentProcessor.processInBatches(
        urls,
        processUrl,
        {
          maxConcurrency: optimalConcurrency,
          rateLimit: this.config.rateLimit,
          onProgress: (completed, total, failed) => {
            progress.completed = completed;
            progress.failed = failed;
            
            if (progressCallback) {
              progressCallback(progress);
            }
            
            // Log progress every 10 apartments
            if (completed % 10 === 0 || completed === total) {
              const elapsed = Date.now() - startTime;
              const rate = completed / (elapsed / 1000);
              console.log(`Progress: ${completed}/${total} (${failed} failed) - ${rate.toFixed(1)} apartments/sec`);
            }
          }
        }
      );
      
      const duration = Date.now() - startTime;
      
      console.log(`\n✅ Concurrent fetch completed:`);
      console.log(`- Duration: ${(duration / 1000).toFixed(1)}s`);
      console.log(`- Success: ${results.length}/${urls.length}`);
      console.log(`- Failed: ${errors.length}`);
      console.log(`- Rate: ${(results.length / (duration / 1000)).toFixed(1)} apartments/sec`);
      
      if (this.logger) {
        this.logger.success('Concurrent fetch completed', {
          duration,
          successful: results.length,
          failed: errors.length,
          rate: results.length / (duration / 1000)
        });
      }
      
      return {
        success: true,
        data: results,
        metadata: {
          url: this.config.baseUrl,
          scrapedAt: new Date(),
          duration,
          retries: 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error),
        metadata: {
          url: this.config.baseUrl,
          scrapedAt: new Date(),
          duration: Date.now() - startTime,
          retries: 0,
        },
      };
    }
  }

  /**
   * Check if a URL is supported by this scraper
   * @param url The URL to check
   * @returns true if the URL belongs to this scraper's domain
   */
  protected isUrlSupported(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const baseUrlObj = new URL(this.config.baseUrl);
      return urlObj.hostname === baseUrlObj.hostname;
    } catch {
      return false;
    }
  }

  /**
   * Extract apartment ID from a URL
   * Each scraper must implement this to parse their specific URL format
   * @param url The apartment detail page URL
   * @returns The extracted apartment ID, or null if unable to extract
   */
  protected abstract extractIdFromUrl(url: string): Promise<string | null>;
}