#!/usr/bin/env node

/**
 * Scrape all apartments from realestate.co.jp search results
 * Handles pagination and extracts detailed apartment information
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Configuration
const RATE_LIMIT_MS = 3000; // 3 seconds between requests to be respectful
const MAX_RETRIES = 3;
const OUTPUT_DIR = path.join(__dirname, 'scraped_apartments');
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Rate limiter
let lastRequestTime = 0;
async function rateLimitedDelay() {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    
    if (timeSinceLastRequest < RATE_LIMIT_MS) {
        const waitTime = RATE_LIMIT_MS - timeSinceLastRequest;
        console.log(`⏳ Rate limiting: waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    lastRequestTime = Date.now();
}

// Parse search parameters from URL
function parseSearchParams(url) {
    const urlObj = new URL(url);
    const params = {};
    
    for (const [key, value] of urlObj.searchParams) {
        if (value) params[key] = value;
    }
    
    return params;
}

// Build URL for a specific page
function buildPageUrl(baseUrl, pageNum) {
    const url = new URL(baseUrl);
    url.searchParams.set('page', pageNum);
    return url.toString();
}

// Fetch a single page
async function fetchPage(url, retryCount = 0) {
    try {
        await rateLimitedDelay();
        
        console.log(`🌐 Fetching: ${url}`);
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const html = await response.text();
        return html;
        
    } catch (error) {
        console.error(`❌ Error fetching page: ${error.message}`);
        
        if (retryCount < MAX_RETRIES) {
            console.log(`🔄 Retrying... (${retryCount + 1}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 2000));
            return fetchPage(url, retryCount + 1);
        }
        
        throw error;
    }
}

// Extract pagination info from page
function extractPaginationInfo(dom) {
    const document = dom.window.document;
    
    // Look for pagination text like "1-20 of 150"
    const paginationTexts = document.querySelectorAll('.pagination-info, .results-count, [class*="pagination"], [class*="result"]');
    
    let totalListings = 0;
    let currentPage = 1;
    let totalPages = 1;
    let listingsPerPage = 20;
    
    // Try to find pagination info
    paginationTexts.forEach(element => {
        const text = element.textContent || '';
        
        // Match patterns like "1-20 of 150" or "Showing 1-20 of 150"
        const match = text.match(/(\d+)\s*-\s*(\d+)\s+of\s+(\d+)/i);
        if (match) {
            const start = parseInt(match[1]);
            const end = parseInt(match[2]);
            totalListings = parseInt(match[3]);
            listingsPerPage = end - start + 1;
            currentPage = Math.floor(start / listingsPerPage) + 1;
            totalPages = Math.ceil(totalListings / listingsPerPage);
        }
    });
    
    // Alternative: look for page numbers in pagination links
    if (totalPages === 1) {
        const pageLinks = document.querySelectorAll('a[href*="page="], .page-link, .pagination a');
        pageLinks.forEach(link => {
            const href = link.getAttribute('href') || '';
            const pageMatch = href.match(/page=(\d+)/);
            if (pageMatch) {
                const pageNum = parseInt(pageMatch[1]);
                if (pageNum > totalPages) totalPages = pageNum;
            }
        });
    }
    
    return {
        totalListings,
        currentPage,
        totalPages,
        listingsPerPage
    };
}

// Extract apartment data from listing element
function extractApartmentData(element, baseUrl) {
    const apartment = {
        id: null,
        title: '',
        price: 0,
        size: 0,
        layout: '',
        address: '',
        station: '',
        walkingTime: '',
        buildingAge: '',
        floor: '',
        detailUrl: '',
        imageUrl: '',
        features: [],
        description: '',
        scrapedAt: new Date().toISOString()
    };
    
    try {
        // Extract ID from link or element attribute
        const linkElement = element.querySelector('a[href*="/rent/view/"], a[href*="/property/"]');
        if (linkElement) {
            const href = linkElement.getAttribute('href') || '';
            apartment.detailUrl = href.startsWith('http') ? href : `https://realestate.co.jp${href}`;
            
            const idMatch = href.match(/view\/(\d+)/);
            if (idMatch) apartment.id = idMatch[1];
        }
        
        // Extract title
        const titleElement = element.querySelector('h3, h2, .title, [class*="title"]');
        if (titleElement) apartment.title = titleElement.textContent.trim();
        
        // Extract price
        const priceElement = element.querySelector('.price, [class*="price"], [class*="rent"]');
        if (priceElement) {
            const priceText = priceElement.textContent || '';
            const priceMatch = priceText.match(/([\d,]+)\s*円/);
            if (priceMatch) {
                apartment.price = parseInt(priceMatch[1].replace(/,/g, ''));
            }
        }
        
        // Extract size
        const sizeElement = element.querySelector('.size, [class*="size"], [class*="area"]');
        if (sizeElement) {
            const sizeText = sizeElement.textContent || '';
            const sizeMatch = sizeText.match(/([\d.]+)\s*m²/);
            if (sizeMatch) {
                apartment.size = parseFloat(sizeMatch[1]);
            }
        }
        
        // Extract layout
        const layoutElement = element.querySelector('.layout, [class*="layout"], [class*="room"]');
        if (layoutElement) {
            const layoutText = layoutElement.textContent || '';
            const layoutMatch = layoutText.match(/([1-9][A-Z]*)/);
            if (layoutMatch) apartment.layout = layoutMatch[1];
        }
        
        // Extract address
        const addressElement = element.querySelector('.address, [class*="address"], [class*="location"]');
        if (addressElement) apartment.address = addressElement.textContent.trim();
        
        // Extract station info
        const stationElement = element.querySelector('.station, [class*="station"]');
        if (stationElement) {
            const stationText = stationElement.textContent || '';
            apartment.station = stationText.trim();
            
            // Try to extract walking time
            const walkMatch = stationText.match(/(\d+)\s*min/i);
            if (walkMatch) apartment.walkingTime = `${walkMatch[1]} min`;
        }
        
        // Extract building age
        const ageElement = element.querySelector('.age, [class*="age"], [class*="built"]');
        if (ageElement) {
            const ageText = ageElement.textContent || '';
            const ageMatch = ageText.match(/(\d+)\s*year/i);
            if (ageMatch) apartment.buildingAge = `${ageMatch[1]} years`;
        }
        
        // Extract floor
        const floorElement = element.querySelector('.floor, [class*="floor"]');
        if (floorElement) apartment.floor = floorElement.textContent.trim();
        
        // Extract image
        const imageElement = element.querySelector('img[src*="property"], img[src*="apartment"], .property-image img');
        if (imageElement) {
            const src = imageElement.getAttribute('src') || '';
            apartment.imageUrl = src.startsWith('http') ? src : `https://realestate.co.jp${src}`;
        }
        
        // Extract features
        const featureElements = element.querySelectorAll('.feature, [class*="feature"], .amenity, [class*="amenity"]');
        featureElements.forEach(feat => {
            const feature = feat.textContent.trim();
            if (feature && !apartment.features.includes(feature)) {
                apartment.features.push(feature);
            }
        });
        
    } catch (error) {
        console.warn(`⚠️  Error extracting apartment data: ${error.message}`);
    }
    
    return apartment;
}

// Extract all apartments from a page
function extractApartments(html, pageUrl) {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    const apartments = [];
    
    // Try multiple selectors for apartment listings
    const selectors = [
        '.property-item',
        '.listing-item',
        '.apartment-card',
        '.search-result-item',
        '[class*="property-list"] > div',
        '[class*="listing"] > div',
        '.result-item',
        'article.property',
        'div[class*="property"][class*="item"]'
    ];
    
    let listingElements = [];
    for (const selector of selectors) {
        listingElements = document.querySelectorAll(selector);
        if (listingElements.length > 0) {
            console.log(`✅ Found ${listingElements.length} listings using selector: ${selector}`);
            break;
        }
    }
    
    if (listingElements.length === 0) {
        console.warn('⚠️  No apartment listings found on page');
        
        // Save HTML for debugging
        const debugFile = path.join(OUTPUT_DIR, `debug_page_${Date.now()}.html`);
        fs.writeFileSync(debugFile, html, 'utf8');
        console.log(`💾 Saved page HTML for debugging: ${debugFile}`);
    }
    
    listingElements.forEach((element, index) => {
        const apartment = extractApartmentData(element, pageUrl);
        if (apartment.id || apartment.title) {
            apartments.push(apartment);
        }
    });
    
    return apartments;
}

// Main scraping function
async function scrapeAllApartments(searchUrl) {
    console.log('🏠 Starting apartment scraper for realestate.co.jp');
    console.log('================================================');
    
    const startTime = Date.now();
    const allApartments = [];
    const searchParams = parseSearchParams(searchUrl);
    
    try {
        // Fetch first page to get pagination info
        console.log('\n📄 Fetching first page to determine total pages...');
        const firstPageHtml = await fetchPage(searchUrl);
        const dom = new JSDOM(firstPageHtml);
        const paginationInfo = extractPaginationInfo(dom);
        
        console.log(`📊 Pagination Info:`);
        console.log(`   Total Listings: ${paginationInfo.totalListings}`);
        console.log(`   Total Pages: ${paginationInfo.totalPages}`);
        console.log(`   Listings Per Page: ${paginationInfo.listingsPerPage}`);
        
        // Extract apartments from first page
        const firstPageApartments = extractApartments(firstPageHtml, searchUrl);
        allApartments.push(...firstPageApartments);
        console.log(`✅ Page 1: Found ${firstPageApartments.length} apartments`);
        
        // Fetch remaining pages
        for (let page = 2; page <= paginationInfo.totalPages; page++) {
            console.log(`\n📄 Fetching page ${page} of ${paginationInfo.totalPages}...`);
            
            const pageUrl = buildPageUrl(searchUrl, page);
            const pageHtml = await fetchPage(pageUrl);
            const apartments = extractApartments(pageHtml, pageUrl);
            
            allApartments.push(...apartments);
            console.log(`✅ Page ${page}: Found ${apartments.length} apartments`);
            
            // Break if we found no apartments (might have reached the end)
            if (apartments.length === 0) {
                console.log('⚠️  No apartments found on page, assuming end of results');
                break;
            }
        }
        
        // Save results
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputFile = path.join(OUTPUT_DIR, `apartments_${timestamp}.json`);
        
        const output = {
            metadata: {
                searchUrl: searchUrl,
                searchParams: searchParams,
                totalApartments: allApartments.length,
                totalPages: paginationInfo.totalPages,
                scrapedAt: new Date().toISOString(),
                executionTime: `${((Date.now() - startTime) / 1000).toFixed(2)} seconds`
            },
            apartments: allApartments
        };
        
        fs.writeFileSync(outputFile, JSON.stringify(output, null, 2), 'utf8');
        
        console.log('\n🎉 Scraping Complete!');
        console.log('====================');
        console.log(`📊 Total Apartments: ${allApartments.length}`);
        console.log(`⏱️  Execution Time: ${output.metadata.executionTime}`);
        console.log(`💾 Output saved to: ${outputFile}`);
        
        // Show sample results
        if (allApartments.length > 0) {
            console.log('\n📋 Sample Results:');
            allApartments.slice(0, 3).forEach((apt, i) => {
                console.log(`\n${i + 1}. ${apt.title || 'Untitled'}`);
                console.log(`   Price: ¥${apt.price.toLocaleString()}`);
                console.log(`   Size: ${apt.size}m²`);
                console.log(`   Layout: ${apt.layout}`);
                console.log(`   Station: ${apt.station}`);
            });
        }
        
        return output;
        
    } catch (error) {
        console.error('\n💥 Fatal error during scraping:', error);
        throw error;
    }
}

// Command line interface
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('Usage: node scrape_apartments.js <search_url>');
        console.log('\nExample:');
        console.log('node scrape_apartments.js "https://realestate.co.jp/en/rent?prefecture=JP-13&max_price=160000&min_meter=25&page=1"');
        process.exit(1);
    }
    
    const searchUrl = args[0];
    
    scrapeAllApartments(searchUrl).catch(error => {
        console.error('Scraping failed:', error);
        process.exit(1);
    });
}

module.exports = { scrapeAllApartments, extractApartments, extractPaginationInfo };