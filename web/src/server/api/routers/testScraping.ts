import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../trpc';
import { db } from '~/lib/db';
import { scrapeApartmentImages } from '~/lib/imageScraper';

export const testScrapingRouter = createTRPCRouter({
  // Get a test apartment that has sourceUrl but no mainImageUrl
  getTestApartment: publicProcedure.query(async () => {
    const apartment = await db.apartment.findFirst({
      where: {
        sourceUrl: {
          not: "",
        },
        mainImageUrl: null,
        isAvailable: true,
      },
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        sourceSite: true,
        buildingName: true,
      },
    });

    return { apartment };
  }),

  // Test scraping a single apartment
  testScrapeOne: publicProcedure
    .input(
      z.object({
        apartmentId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      console.log('=== TEST SCRAPE START ===');
      console.log('Apartment ID:', input.apartmentId);

      // Get apartment details
      const apartment = await db.apartment.findUnique({
        where: { id: input.apartmentId },
        select: {
          id: true,
          title: true,
          sourceUrl: true,
          sourceSite: true,
        },
      });

      if (!apartment || !apartment.sourceUrl) {
        throw new Error('Apartment not found or has no source URL');
      }

      console.log('Source URL:', apartment.sourceUrl);
      console.log('Source Site:', apartment.sourceSite);

      // First, let's fetch the page directly to see what we're working with
      let debugInfo: any = {};
      try {
        const response = await fetch(apartment.sourceUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
          },
        });

        const html = await response.text();
        debugInfo.htmlLength = html.length;
        debugInfo.responseStatus = response.status;
        
        // Check for swiper elements
        const swiperSlides = html.match(/class="[^"]*swiper-slide[^"]*"/g);
        debugInfo.swiperSlideCount = swiperSlides?.length || 0;
        
        // Find all image URLs
        const allImages = html.match(/(?:src|data-src|data-lazy|data-background)="([^"]+\.(?:jpg|jpeg|png|webp))"/gi);
        debugInfo.totalImagesInHtml = allImages?.length || 0;
        
        // Find image URLs in <a> tags
        const linkImages = html.match(/<a[^>]+href="([^"]+\.(?:jpg|jpeg|png|webp))"/gi);
        debugInfo.imagesInLinks = linkImages?.length || 0;
        
        // Sample swiper HTML
        const swiperMatch = html.match(/(<div[^>]*class="[^"]*swiper-slide[^"]*"[^>]*>[\s\S]{0,500})/);
        debugInfo.swiperSample = swiperMatch ? swiperMatch[1].substring(0, 400) + '...' : 'No swiper found';
        
        // Check if images are in script tags (sometimes lazy loaded via JS)
        const scriptImages = html.match(/["']([^"']+\.(?:jpg|jpeg|png|webp))["']/g);
        debugInfo.imagesInScripts = scriptImages?.length || 0;
        
      } catch (error) {
        debugInfo.fetchError = error instanceof Error ? error.message : 'Unknown error';
      }

      // Run the scraper
      const results = await scrapeApartmentImages([input.apartmentId], 1);
      console.log('Scraping results:', JSON.stringify(results, null, 2));

      // Check the database to see if it was updated
      const dbCheck = await db.apartment.findUnique({
        where: { id: input.apartmentId },
        select: {
          mainImageUrl: true,
          floorPlanUrl: true,
          images: {
            select: {
              id: true,
              imageUrl: true,
              imageType: true,
              displayOrder: true,
            },
          },
        },
      });

      console.log('Database check:', JSON.stringify(dbCheck, null, 2));
      console.log('Debug info:', JSON.stringify(debugInfo, null, 2));
      console.log('=== TEST SCRAPE END ===');

      return {
        apartment,
        scrapingResult: results[0],
        dbCheck: {
          mainImageUrl: dbCheck?.mainImageUrl,
          floorPlanUrl: dbCheck?.floorPlanUrl,
          imageCount: dbCheck?.images.length || 0,
          images: dbCheck?.images || [],
        },
        debugInfo,
      };
    }),

  // Test the image extraction functions directly
  testImageExtraction: publicProcedure
    .input(
      z.object({
        url: z.string().url(),
        sourceSite: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      console.log('=== TEST IMAGE EXTRACTION ===');
      console.log('URL:', input.url);
      console.log('Source Site:', input.sourceSite);

      try {
        // Fetch the page
        const response = await fetch(input.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();
        console.log('HTML length:', html.length);

        // Check for swiper elements
        const swiperSlides = html.match(/class="[^"]*swiper-slide[^"]*"/g);
        console.log('Swiper slides found:', swiperSlides?.length || 0);

        // Try to find images with different patterns
        const patterns = [
          /class="[^"]*swiper-slide[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+(?:jpg|jpeg|png|webp))"/gi,
          /<a[^>]+href="([^"]+(?:jpg|jpeg|png|webp))"/gi,
          /src="([^"]*(?:jpg|jpeg|png|webp)[^"]*)"/gi,
          /data-src="([^"]*(?:jpg|jpeg|png|webp)[^"]*)"/gi,
          /data-lazy="([^"]*(?:jpg|jpeg|png|webp)[^"]*)"/gi,
          /data-background="([^"]*(?:jpg|jpeg|png|webp)[^"]*)"/gi,
        ];

        const foundImages: string[] = [];
        const imagesByPattern: Record<string, string[]> = {};
        
        patterns.forEach((pattern, index) => {
          const patternImages: string[] = [];
          const matches = html.matchAll(pattern);
          for (const match of matches) {
            if (match[1]) {
              foundImages.push(match[1]);
              patternImages.push(match[1]);
            }
          }
          imagesByPattern[`pattern${index}`] = patternImages;
        });

        console.log('Found images:', foundImages.length);
        console.log('Images by pattern:', Object.entries(imagesByPattern).map(([k, v]) => `${k}: ${v.length}`));

        // Extract a sample of HTML around swiper-slide
        let swiperSample = '';
        const swiperMatch = html.match(/(<div[^>]*class="[^"]*swiper-slide[^"]*"[^>]*>[\s\S]{0,500})/);
        if (swiperMatch) {
          swiperSample = swiperMatch[1];
        }

        return {
          success: true,
          htmlLength: html.length,
          imageCount: foundImages.length,
          sampleImages: foundImages.slice(0, 10),
          sourceSite: input.sourceSite,
          swiperSlideCount: swiperSlides?.length || 0,
          swiperSampleHtml: swiperSample,
          imagesByPattern: Object.entries(imagesByPattern).map(([k, v]) => ({ pattern: k, count: v.length, samples: v.slice(0, 2) })),
        };
      } catch (error) {
        console.error('Test extraction failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }),

  // Get a test apartment specifically from home.yolo-japan.com
  getYoloTestApartment: publicProcedure.query(async () => {
    const apartment = await db.apartment.findFirst({
      where: {
        sourceUrl: {
          contains: "home.yolo-japan.com",
        },
        mainImageUrl: null,
        isAvailable: true,
      },
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        sourceSite: true,
        buildingName: true,
      },
    });

    return { apartment };
  }),

  // Test the home.yolo-japan.com specific scraper
  testYoloScraper: publicProcedure
    .input(
      z.object({
        url: z.string().url(),
      })
    )
    .mutation(async ({ input }) => {
      console.log('=== TEST YOLO SCRAPER ===');
      console.log('URL:', input.url);

      try {
        // Import the scrapeYoloHomeImages function directly
        const { scrapeYoloHomeImages } = await import('~/lib/imageScraper');
        
        // Call the yolo-specific scraper
        const result = await (scrapeYoloHomeImages as any)(input.url);
        
        console.log('Yolo scraper result:', result);

        // Also test with the provided HTML sample
        const sampleHtml = `<div class="gallery-item swiper-slide" data-v-2142628a="" style="width: 730px;" data-swiper-slide-index="0"><img data-v-2142628a="" class="lazyLoad isLoaded" src="https://uploads.home.yolo-japan.com/images/properties/media/1298166_1.jpg?d=1000x1000"></div>`;
        
        // Test the patterns directly on the sample
        const galleryPattern = /<div[^>]+class="[^"]*gallery-item\s+swiper-slide[^"]*"[^>]*>[\s\S]*?<img[^>]+(?:src|data-src)="(https:\/\/uploads\.home\.yolo-japan\.com\/[^"]+\.(?:jpg|jpeg|png|webp))"/gi;
        const sampleMatches = sampleHtml.matchAll(galleryPattern);
        const sampleImages = [];
        for (const match of sampleMatches) {
          if (match[1]) {
            sampleImages.push(match[1]);
          }
        }

        // Also fetch the actual HTML to verify
        let actualHtmlDebug: any = {};
        try {
          const testResponse = await fetch(input.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
          });
          const testHtml = await testResponse.text();
          
          // Check for gallery items
          const galleryItems = testHtml.match(/class="[^"]*gallery-item[^"]*"/g);
          actualHtmlDebug.galleryItemCount = galleryItems?.length || 0;
          
          // Check for swiper slides
          const swiperSlides = testHtml.match(/class="[^"]*swiper-slide[^"]*"/g);
          actualHtmlDebug.swiperSlideCount = swiperSlides?.length || 0;
          
          // Sample of actual HTML
          const galleryMatch = testHtml.match(/(<div[^>]*class="[^"]*gallery-item[^"]*"[^>]*>[\s\S]{0,300})/);
          actualHtmlDebug.sampleHtml = galleryMatch ? galleryMatch[1].substring(0, 250) + '...' : 'No gallery items found';
        } catch (e) {
          actualHtmlDebug.error = e instanceof Error ? e.message : 'Failed to fetch';
        }

        return {
          success: true,
          scrapedImages: result.imageUrls,
          floorPlanUrl: result.floorPlanUrl,
          imageCount: result.imageUrls.length,
          samplePatternTest: {
            worked: sampleImages.length > 0,
            foundInSample: sampleImages,
          },
          debugInfo: {
            url: input.url,
            sourceSite: 'home.yolo-japan.com',
            actualHtml: actualHtmlDebug,
          },
        };
      } catch (error) {
        console.error('Yolo scraper test failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }),
});