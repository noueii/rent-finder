'use server';

import { db } from '~/lib/db';

interface ScrapingResult {
  apartmentId: string;
  mainImageUrl: string | null;
  additionalImages: string[];
  floorPlanUrl: string | null;
  totalImagesFound: number;
  success: boolean;
  error?: string;
}

interface ScrapingJob {
  apartmentId: string;
  sourceUrl: string;
  sourceSite: string;
  title: string;
}

/**
 * Scrape images for apartments using puppeteer
 */
export async function scrapeApartmentImages(
  apartmentIds: string[],
  maxConcurrent: number = 5,
  onProgress?: (completed: number, total: number) => void
): Promise<ScrapingResult[]> {
  // Get apartment data for scraping
  const apartments = await db.apartment.findMany({
    where: {
      id: { in: apartmentIds },
      sourceUrl: {
        not: ""
      },
      isAvailable: true,
    },
    select: {
      id: true,
      sourceUrl: true,
      sourceSite: true,
      title: true,
    },
  });

  const jobs: ScrapingJob[] = apartments
    .filter(apt => apt.sourceUrl)
    .map(apt => ({
      apartmentId: apt.id,
      sourceUrl: apt.sourceUrl!,
      sourceSite: apt.sourceSite || 'unknown',
      title: apt.title || '',
    }));

  console.log(`Starting image scraping for ${jobs.length} apartments`);

  const results: ScrapingResult[] = [];
  let processedCount = 0;
  
  // Process in batches to avoid overwhelming the target sites
  for (let i = 0; i < jobs.length; i += maxConcurrent) {
    const batch = jobs.slice(i, i + maxConcurrent);
    const batchResults = await Promise.allSettled(
      batch.map(job => scrapeIndividualApartment(job))
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        console.error('Scraping job failed:', result.reason);
        results.push({
          apartmentId: 'unknown',
          mainImageUrl: null,
          additionalImages: [],
          floorPlanUrl: null,
          totalImagesFound: 0,
          success: false,
          error: result.reason?.toString(),
        });
      }
    }

    processedCount += batch.length;
    
    // Report progress if callback provided
    if (onProgress) {
      onProgress(processedCount, jobs.length);
    }

    // Small delay between batches to be respectful
    if (i + maxConcurrent < jobs.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Update database with scraped images in batches
  const successfulResults = results.filter(r => r.success && (r.mainImageUrl || r.additionalImages.length > 0));
  
  // Process database updates in smaller batches to avoid memory issues
  const dbBatchSize = 100;
  for (let i = 0; i < successfulResults.length; i += dbBatchSize) {
    const batch = successfulResults.slice(i, i + dbBatchSize);
    await updateDatabaseWithImages(batch);
    console.log(`Updated database: ${Math.min(i + dbBatchSize, successfulResults.length)}/${successfulResults.length} apartments`);
  }

  return results;
}

/**
 * Scrape images from a single apartment listing
 */
async function scrapeIndividualApartment(job: ScrapingJob): Promise<ScrapingResult> {
  try {
    console.log(`Scraping images for apartment ${job.apartmentId} from ${job.sourceUrl}`);

    const imageUrls: string[] = [];
    let floorPlanUrl: string | null = null;

    // Use different scraping strategies based on source site
    console.log(`[scrapeIndividualApartment] Source site: ${job.sourceSite}`);
    
    if (job.sourceSite.includes('realestate.co.jp')) {
      const result = await scrapeRealEstateImages(job.sourceUrl);
      imageUrls.push(...result.imageUrls);
      floorPlanUrl = result.floorPlanUrl;
    } else if (job.sourceSite.includes('home.yolo-japan.com')) {
      const result = await scrapeYoloHomeImages(job.sourceUrl);
      imageUrls.push(...result.imageUrls);
      floorPlanUrl = result.floorPlanUrl;
    } else {
      // Generic scraping for unknown sources
      console.log(`[scrapeIndividualApartment] Using generic scraper for: ${job.sourceSite}`);
      const result = await scrapeGenericImages(job.sourceUrl);
      imageUrls.push(...result.imageUrls);
      floorPlanUrl = result.floorPlanUrl;
    }

    console.log(`[scrapeIndividualApartment] Found ${imageUrls.length} images before validation`);
    const validImageUrls = imageUrls.filter(url => url && url.startsWith('http'));
    console.log(`[scrapeIndividualApartment] ${validImageUrls.length} images after validation`);
    
    return {
      apartmentId: job.apartmentId,
      mainImageUrl: validImageUrls.length > 0 ? validImageUrls[0] : null,
      additionalImages: validImageUrls.slice(1), // All images except the first one
      floorPlanUrl,
      totalImagesFound: validImageUrls.length,
      success: true,
    };
  } catch (error) {
    console.error(`Failed to scrape apartment ${job.apartmentId}:`, error);
    return {
      apartmentId: job.apartmentId,
      mainImageUrl: null,
      additionalImages: [],
      floorPlanUrl: null,
      totalImagesFound: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Scrape images from realestate.co.jp
 */
async function scrapeRealEstateImages(url: string): Promise<{ imageUrls: string[]; floorPlanUrl: string | null }> {
  console.log(`[scrapeRealEstateImages] Fetching URL: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  const html = await response.text();
  console.log(`[scrapeRealEstateImages] HTML length: ${html.length}`);
  
  // Extract images using the exact realestate.co.jp format
  const imageUrls: Set<string> = new Set();
  let floorPlanUrl: string | null = null;

  // Primary pattern: Exact format from realestate.co.jp
  // <a href="https://media.realestate.co.jp/.../image_1.jpeg" ... class="swiper-slide ...">
  const realEstatePattern = /<a[^>]+href="(https:\/\/media\.realestate\.co\.jp\/[^"]+\.(?:jpg|jpeg|png|webp))"[^>]*class="[^"]*swiper-slide[^"]*"/gi;
  const matches = html.matchAll(realEstatePattern);
  
  for (const match of matches) {
    if (match[1]) {
      imageUrls.add(match[1]);
    }
  }

  // Fallback pattern: Look for any media.realestate.co.jp images in href
  if (imageUrls.size === 0) {
    const fallbackPattern = /href="(https:\/\/media\.realestate\.co\.jp\/[^"]+\.(?:jpg|jpeg|png|webp))"/gi;
    const fallbackMatches = html.matchAll(fallbackPattern);
    
    for (const match of fallbackMatches) {
      if (match[1]) {
        imageUrls.add(match[1]);
      }
    }
  }

  // Also look for thumbnail images that might be floor plans
  const floorPlanPattern = /<img[^>]+src="(https:\/\/media\.realestate\.co\.jp\/[^"]+\.(?:jpg|jpeg|png|webp))"/gi;
  const floorPlanMatches = html.matchAll(floorPlanPattern);
  
  for (const match of floorPlanMatches) {
    if (match[1] && (match[1].includes('floor') || match[1].includes('plan') || match[1].includes('layout'))) {
      floorPlanUrl = match[1];
    }
  }

  console.log(`[scrapeRealEstateImages] Found ${imageUrls.size} unique images`);

  // Convert to array (Set already ensures uniqueness)
  const imageArray = Array.from(imageUrls);

  console.log(`[scrapeRealEstateImages] Returning ${imageArray.length} unique images`);
  if (imageArray.length > 0) {
    console.log(`[scrapeRealEstateImages] Sample image: ${imageArray[0]}`);
  }

  return {
    imageUrls: imageArray,
    floorPlanUrl,
  };
}

/**
 * Scrape images from home.yolo-japan.com
 */
export async function scrapeYoloHomeImages(url: string): Promise<{ imageUrls: string[]; floorPlanUrl: string | null }> {
  console.log(`[scrapeYoloHomeImages] Fetching URL: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  const html = await response.text();
  console.log(`[scrapeYoloHomeImages] HTML length: ${html.length}`);
  
  const imageUrls: Set<string> = new Set();
  let floorPlanUrl: string | null = null;

  // Primary pattern: Look for images in gallery-item swiper-slide divs
  // Some have src (loaded), others have data-src (lazy loaded)
  // Updated to handle query parameters (like ?d=1000x1000)
  const galleryPattern = /<div[^>]+class="[^"]*gallery-item\s+swiper-slide[^"]*"[^>]*>[\s\S]*?<img[^>]+(?:src|data-src)="(https:\/\/uploads\.home\.yolo-japan\.com\/[^"]+\.(?:jpg|jpeg|png|webp)(?:\?[^"]*)?)"/gi;
  const galleryMatches = html.matchAll(galleryPattern);
  
  for (const match of galleryMatches) {
    if (match[1]) {
      imageUrls.add(match[1]);
    }
  }

  // Fallback pattern: Look for any yolo-japan images (with or without query params)
  if (imageUrls.size === 0) {
    const yoloPattern = /(?:src|data-src)="(https:\/\/uploads\.home\.yolo-japan\.com\/[^"]+\.(?:jpg|jpeg|png|webp)(?:\?[^"]*)?)"/gi;
    const yoloMatches = html.matchAll(yoloPattern);
    
    for (const match of yoloMatches) {
      if (match[1]) {
        imageUrls.add(match[1]);
      }
    }
  }

  // Floor plan detection - yolo homes might use different naming
  const floorPlanPatterns = [
    /(?:src|data-src)="([^"]*(?:floor|plan|layout|madori)[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/i,
    /(?:src|data-src)="([^"]*properties\/media\/[^"]*_floorplan[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/i,
  ];

  for (const pattern of floorPlanPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      // Strip query parameters from floor plan URL too
      floorPlanUrl = match[1].split('?')[0];
      break;
    }
  }

  console.log(`[scrapeYoloHomeImages] Found ${imageUrls.size} unique images before stripping`);

  // Convert to array, strip query parameters, and remove duplicates
  const strippedUrls = new Set<string>();
  for (const url of imageUrls) {
    // Remove query parameters like ?d=1000x1000
    const urlWithoutQuery = url.split('?')[0];
    strippedUrls.add(urlWithoutQuery);
  }
  
  const imageArray = Array.from(strippedUrls);

  console.log(`[scrapeYoloHomeImages] Returning ${imageArray.length} unique images after stripping`);
  if (imageArray.length > 0) {
    console.log(`[scrapeYoloHomeImages] Sample image: ${imageArray[0]}`);
  }

  return {
    imageUrls: imageArray,
    floorPlanUrl,
  };
}

/**
 * Generic image scraping for unknown sources
 */
async function scrapeGenericImages(url: string): Promise<{ imageUrls: string[]; floorPlanUrl: string | null }> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  const html = await response.text();
  
  const imageUrls: string[] = [];
  let floorPlanUrl: string | null = null;

  // Generic image extraction
  const imageMatches = html.match(/src="([^"]*(?:jpg|jpeg|png|webp)[^"]*)"/gi) || [];
  const allImages = imageMatches
    .map(match => match.replace(/src="([^"]*)"/, '$1'))
    .filter(url => !url.includes('icon') && !url.includes('logo') && !url.includes('banner'))
    .slice(0, 8);

  imageUrls.push(...allImages);

  return {
    imageUrls: imageUrls.map(url => {
      if (url.startsWith('http')) return url;
      if (url.startsWith('//')) return `https:${url}`;
      const baseUrl = new URL(url).origin;
      return `${baseUrl}${url}`;
    }),
    floorPlanUrl,
  };
}

/**
 * Update database with scraped images
 */
async function updateDatabaseWithImages(results: ScrapingResult[]) {
  for (const result of results) {
    try {
      // Start a transaction to update apartment and create images
      await db.$transaction(async (tx) => {
        // Update apartment with main image
        await tx.apartment.update({
          where: { id: result.apartmentId },
          data: {
            mainImageUrl: result.mainImageUrl,
            floorPlanUrl: result.floorPlanUrl,
            lastScraped: new Date(),
            updatedAt: new Date(),
          },
        });

        // Delete existing images for this apartment (if any)
        await tx.apartmentImage.deleteMany({
          where: { apartmentId: result.apartmentId },
        });

        // Create new image records, ensuring no duplicates
        const imageRecords = [];
        const addedUrls = new Set<string>();
        
        // Add main image first (displayOrder: 0)
        if (result.mainImageUrl) {
          imageRecords.push({
            apartmentId: result.apartmentId,
            imageUrl: result.mainImageUrl,
            imageType: 'general',
            displayOrder: 0,
            scrapedAt: new Date(),
          });
          addedUrls.add(result.mainImageUrl);
        }

        // Add additional images (displayOrder: 1, 2, 3, ...)
        // Skip if already added as main image
        result.additionalImages.forEach((imageUrl, index) => {
          if (!addedUrls.has(imageUrl)) {
            imageRecords.push({
              apartmentId: result.apartmentId,
              imageUrl: imageUrl,
              imageType: 'general',
              displayOrder: imageRecords.length, // Use current length for proper ordering
              scrapedAt: new Date(),
            });
            addedUrls.add(imageUrl);
          }
        });

        // Add floor plan as separate image if exists and not already added
        if (result.floorPlanUrl && !addedUrls.has(result.floorPlanUrl)) {
          imageRecords.push({
            apartmentId: result.apartmentId,
            imageUrl: result.floorPlanUrl,
            imageType: 'floorplan',
            displayOrder: 99, // Floor plans go last
            scrapedAt: new Date(),
          });
          addedUrls.add(result.floorPlanUrl);
        }

        // Insert all images at once
        if (imageRecords.length > 0) {
          await tx.apartmentImage.createMany({
            data: imageRecords,
          });
        }
      });

      console.log(`Updated apartment ${result.apartmentId} with ${result.totalImagesFound} images`);
    } catch (error) {
      console.error(`Failed to update apartment ${result.apartmentId}:`, error);
    }
  }
  
  console.log(`Completed updating ${results.length} apartments with images`);
}

/**
 * Get apartments that need image scraping (for filtered results)
 */
export async function getApartmentsNeedingImages(filters: {
  targetStation?: string;
  maxCommuteTime?: number;
  minPrice?: number;
  maxPrice?: number;
  minSize?: number;
  maxSize?: number;
  layouts?: string[];
  maxBuildingAge?: number | null;
  maxWalkingMinutes?: number | null;
  excludeFromLists?: string[];
  limit?: number;
}): Promise<string[]> {
  console.log('getApartmentsNeedingImages called with limit:', filters.limit);
  
  // Build where clause directly instead of using array
  const where: any = {
    isAvailable: true,
    sourceUrl: {
      not: ""
    },
    mainImageUrl: null, // No main image yet
  };

  // Apply price filters
  if (filters.minPrice || filters.maxPrice) {
    where.rentMonthly = {};
    if (filters.minPrice) where.rentMonthly.gte = filters.minPrice;
    if (filters.maxPrice) where.rentMonthly.lte = filters.maxPrice;
  }

  // Apply size filters
  if (filters.minSize || filters.maxSize) {
    where.size = {};
    if (filters.minSize) where.size.gte = filters.minSize;
    if (filters.maxSize) where.size.lte = filters.maxSize;
  }

  // Apply layout filter
  if (filters.layouts && filters.layouts.length > 0) {
    where.layout = { in: filters.layouts };
  }

  // Apply building age filter
  if (filters.maxBuildingAge !== null && filters.maxBuildingAge !== undefined) {
    where.buildingAge = { lte: filters.maxBuildingAge };
  }

  // Apply walking minutes filter
  if (filters.maxWalkingMinutes !== null && filters.maxWalkingMinutes !== undefined) {
    where.stations = {
      some: {
        walkingMinutes: { lte: filters.maxWalkingMinutes }
      }
    };
  }

  // Handle excludeFromLists filter
  if (filters.excludeFromLists && filters.excludeFromLists.length > 0) {
    // Get apartment IDs that are in any of the specified lists
    const apartmentsInLists = await db.apartmentList.findMany({
      where: {
        list: {
          type: { in: filters.excludeFromLists }
        }
      },
      select: {
        apartmentId: true
      }
    });
    
    const apartmentIdsToExclude = apartmentsInLists.map(al => al.apartmentId);
    
    if (apartmentIdsToExclude.length > 0) {
      where.id = { notIn: apartmentIdsToExclude };
    }
  }

  // If no limit specified, get all apartments (no take parameter)
  const queryOptions: any = {
    where,
    select: {
      id: true,
    },
    orderBy: {
      rentMonthly: 'asc', // Start with cheaper apartments
    },
  };

  // Only apply limit if explicitly provided
  if (filters.limit) {
    queryOptions.take = filters.limit;
  }

  const apartments = await db.apartment.findMany(queryOptions);
  
  console.log(`Found ${apartments.length} apartments needing images`);

  return apartments.map(apt => apt.id);
}