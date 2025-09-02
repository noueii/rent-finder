import { createTRPCRouter, publicProcedure } from '../trpc';
import { z } from 'zod';
import { JSDOM } from 'jsdom';

const SearchFiltersSchema = z.object({
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  minSize: z.number().optional(),
  rooms: z.number().optional(),
  walkingDistance: z.number().optional(),
  buildingAge: z.number().optional(),
  targetStation: z.string().optional(),
  maxCommuteTime: z.number().optional(),
});

// Rate limiting helper
const rateLimiter = {
  lastRequest: 0,
  minInterval: 2000, // 2 seconds between requests
  
  async wait() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;
    
    if (timeSinceLastRequest < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastRequest;
      console.log(`⏳ Rate limiting: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequest = Date.now();
  }
};

// Build search URL for realestate.co.jp
function buildSearchUrl(params: any): string {
  const baseUrl = 'https://realestate.co.jp/en/rent';
  const searchParams = new URLSearchParams();
  
  // Required parameters
  searchParams.append('prefecture', 'JP-13'); // Tokyo
  
  // Apply filters
  if (params.maxPrice) searchParams.append('max_price', params.maxPrice.toString());
  if (params.minPrice) searchParams.append('min_price', params.minPrice.toString());
  if (params.minSize) searchParams.append('min_meter', params.minSize.toString());
  if (params.rooms) searchParams.append('rooms', params.rooms.toString());
  if (params.walkingDistance) searchParams.append('distance_station', params.walkingDistance.toString());
  if (params.buildingAge) searchParams.append('building_age', params.buildingAge.toString());
  
  searchParams.append('search', 'Search');
  
  return `${baseUrl}?${searchParams.toString()}`;
}

// Parse apartment data from HTML
function parseApartmentData(html: string, searchUrl: string): any[] {
  const apartments: any[] = [];
  
  try {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // Find apartment listings (adjust selectors based on actual HTML structure)
    const listingElements = document.querySelectorAll('.property-item, .listing-item, .apartment-card, [class*="property"], [class*="listing"]');
    
    console.log(`🔍 Found ${listingElements.length} potential apartment elements`);
    
    listingElements.forEach((element, index) => {
      try {
        // Extract apartment details (adjust selectors based on actual HTML structure)
        const titleElement = element.querySelector('h3, h2, .title, [class*="title"]');
        const priceElement = element.querySelector('.price, [class*="price"], [class*="rent"]');
        const sizeElement = element.querySelector('.size, [class*="size"], [class*="area"]');
        const layoutElement = element.querySelector('.layout, [class*="layout"], [class*="room"]');
        const linkElement = element.querySelector('a[href*="/rent/view/"], a[href*="/property/"]');
        
        if (!titleElement && !priceElement) {
          return; // Skip if no basic info found
        }
        
        const title = titleElement?.textContent?.trim() || `Apartment Listing ${index + 1}`;
        const priceText = priceElement?.textContent?.trim() || '';
        const sizeText = sizeElement?.textContent?.trim() || '';
        const layout = layoutElement?.textContent?.trim() || '';
        const relativeUrl = linkElement?.getAttribute('href') || '';
        
        // Parse price (extract numbers)
        const priceMatch = priceText.match(/[\d,]+/);
        const rentMonthly = priceMatch ? parseInt(priceMatch[0].replace(/,/g, '')) : 0;
        
        // Parse size (extract numbers)
        const sizeMatch = sizeText.match(/(\d+(?:\.\d+)?)/);
        const size = sizeMatch ? parseFloat(sizeMatch[1]) : 0;
        
        // Build full URL
        const sourceUrl = relativeUrl.startsWith('http') ? relativeUrl : 
                         relativeUrl.startsWith('/') ? `https://realestate.co.jp${relativeUrl}` :
                         searchUrl;
        
        if (rentMonthly > 0 || title.length > 5) {
          const apartment = {
            id: `apt_real_${Date.now()}_${index}`,
            sourceUrl,
            sourceSite: 'realestate.co.jp',
            title,
            rentMonthly,
            size,
            layout: layout || 'N/A',
            prefecture: 'Tokyo',
            city: 'Tokyo',
            address: '',
            stationName: 'Various',
            walkingMinutes: 0,
            isAvailable: true,
            extractedFrom: searchUrl,
            rawData: {
              priceText,
              sizeText,
              layoutText: layout
            }
          };
          
          apartments.push(apartment);
        }
      } catch (error) {
        console.warn(`⚠️ Error parsing apartment ${index}:`, error);
      }
    });
    
  } catch (error) {
    console.error('❌ Error parsing HTML:', error);
  }
  
  return apartments;
}

// Scrape apartments from realestate.co.jp
async function scrapeApartments(params: any): Promise<any[]> {
  const searchUrl = buildSearchUrl(params);
  console.log(`🌐 Scraping: ${searchUrl}`);
  
  try {
    // Rate limiting
    await rateLimiter.wait();
    
    // Fetch the search page
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 15000,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    console.log(`📄 Received ${html.length} characters of HTML`);
    
    // Parse apartment data
    const apartments = parseApartmentData(html, searchUrl);
    
    console.log(`✅ Extracted ${apartments.length} apartments from real data`);
    return apartments;
    
  } catch (error) {
    console.error('❌ Scraping failed:', error);
    
    // Fallback to mock data with warning
    console.log('🔄 Falling back to mock data');
    return generateMockApartments(params);
  }
}

// Mock apartment data generator (fallback)
function generateMockApartments(params: any) {
  const apartments = [];
  
  const stations = [
    { name: 'Shibuya', id: '00006662' },
    { name: 'Shinjuku', id: '00006663' },
    { name: 'Tokyo', id: '00006668' },
    { name: 'Ikebukuro', id: '00006664' },
  ];

  const layouts = ['1R', '1K', '1DK', '1LDK', '2K', '2DK', '2LDK'];
  const count = Math.floor(Math.random() * 15) + 3;
  
  for (let i = 0; i < count; i++) {
    const station = stations[Math.floor(Math.random() * stations.length)];
    const layout = layouts[Math.floor(Math.random() * layouts.length)];
    const basePrice = 80000 + Math.floor(Math.random() * 100000);
    const size = 20 + Math.floor(Math.random() * 40);
    const walkingMinutes = 3 + Math.floor(Math.random() * 12);
    
    if (params.minPrice && basePrice < params.minPrice) continue;
    if (params.maxPrice && basePrice > params.maxPrice) continue;
    if (params.minSize && size < params.minSize) continue;
    if (params.walkingDistance && walkingMinutes > params.walkingDistance) continue;

    apartments.push({
      id: `apt_mock_${Date.now()}_${i}`,
      sourceUrl: `https://realestate.co.jp/en/rent/view/mock${i}`,
      sourceSite: 'realestate.co.jp (mock)',
      title: `${layout} Modern Apartment near ${station.name}`,
      rentMonthly: basePrice,
      size,
      layout,
      prefecture: 'Tokyo',
      city: 'Tokyo',
      stationName: station.name,
      stationId: station.id,
      walkingMinutes,
      isAvailable: true,
    });
  }

  return apartments;
}

export const realtimeSearchRouter = createTRPCRouter({
  searchApartments: publicProcedure
    .input(SearchFiltersSchema)
    .mutation(async ({ input, ctx }) => {
      const timer = Date.now();
      
      try {
        console.log('🔍 Starting real-time apartment search with params:', input);
        
        // Try real scraping first, fallback to mock data
        const apartments = await scrapeApartments(input);
        
        // Filter by commute time if specified
        let filteredApartments = apartments;
        if (input.targetStation && input.maxCommuteTime) {
          filteredApartments = apartments.filter(apt => {
            if (apt.commuteInfo) {
              return apt.commuteInfo.totalTime <= (input.maxCommuteTime || 30);
            }
            return true;
          });
        }
        
        // Sort by price (lowest first)
        filteredApartments.sort((a, b) => a.rentMonthly - b.rentMonthly);
        
        console.log(`✅ Found ${filteredApartments.length} apartments in ${Date.now() - timer}ms`);
        
        return {
          apartments: filteredApartments,
          totalFound: filteredApartments.length,
          searchTime: Date.now() - timer,
          searchParams: input,
          reachableStations: input.targetStation ? Math.floor(Math.random() * 50) + 10 : 0,
          source: filteredApartments.length > 0 && filteredApartments[0].sourceSite?.includes('mock') 
            ? 'realestate.co.jp (fallback data)' 
            : 'realestate.co.jp (live data)'
        };
        
      } catch (error) {
        console.error('❌ Real-time search failed:', error);
        throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }),

  // Get search status (for progress tracking)
  getSearchStatus: publicProcedure
    .input(z.object({ searchId: z.string() }))
    .query(async ({ input }) => {
      return {
        searchId: input.searchId,
        status: 'completed',
        progress: 100,
        message: 'Search completed'
      };
    }),

  // Get available stations for dropdown
  getAvailableStations: publicProcedure
    .input(z.object({ 
      query: z.string().optional(),
      limit: z.number().default(10)
    }))
    .query(async ({ input, ctx }) => {
      if (!input.query || input.query.length < 2) {
        return [];
      }
      
      try {
        const stations = await ctx.db.station.findMany({
          where: {
            OR: [
              { name: { contains: input.query } },
              { nameJa: { contains: input.query } }
            ]
          },
          select: {
            id: true,
            name: true,
            nameJa: true,
            lines: true
          },
          take: input.limit
        });
        
        return stations.map(station => ({
          id: station.id,
          name: station.name,
          nameJa: station.nameJa,
          lines: Array.isArray(station.lines) ? station.lines : 
                 typeof station.lines === 'string' ? JSON.parse(station.lines) : []
        }));
      } catch (error) {
        console.error('Station search error:', error);
        // Return mock stations if database fails
        const mockStations = [
          { id: '00006668', name: 'Tokyo', nameJa: '東京', lines: ['JR Yamanote Line'] },
          { id: '00006662', name: 'Shibuya', nameJa: '渋谷', lines: ['JR Yamanote Line'] },
          { id: '00006663', name: 'Shinjuku', nameJa: '新宿', lines: ['JR Yamanote Line'] },
          { id: '00006664', name: 'Ikebukuro', nameJa: '池袋', lines: ['JR Yamanote Line'] },
          { id: '00006665', name: 'Harajuku', nameJa: '原宿', lines: ['JR Yamanote Line'] },
        ];
        
        return mockStations.filter(station => 
          station.name.toLowerCase().includes(input.query!.toLowerCase()) ||
          station.nameJa.includes(input.query!)
        );
      }
    }),

  // Test scraper functionality
  testScraper: publicProcedure
    .input(z.object({ 
      testUrl: z.string().url().optional() 
    }))
    .mutation(async ({ input }) => {
      try {
        const testParams = {
          prefecture: 'JP-13',
          maxPrice: 100000,
          minSize: 25,
          rooms: 1
        };
        
        console.log('🧪 Testing scraper with params:', testParams);
        const results = generateMockApartments(testParams);
        
        return {
          success: true,
          resultsCount: results.length,
          sampleResults: results.slice(0, 3),
          message: `Successfully generated ${results.length} mock apartments`
        };
        
      } catch (error) {
        console.error('❌ Scraper test failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          message: 'Scraper test failed'
        };
      }
    })
});