#!/usr/bin/env node

/**
 * Enhanced scraper for realestate.co.jp with better parsing
 * Handles their specific HTML structure and pagination
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Configuration
const RATE_LIMIT_MS = 3000; // 3 seconds between requests
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

// Fetch page with proper headers and cookies
async function fetchPage(url, retryCount = 0) {
    try {
        await rateLimitedDelay();
        
        console.log(`🌐 Fetching: ${url}`);
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Cache-Control': 'max-age=0'
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

// Extract pagination from specific realestate.co.jp structure
function extractPaginationInfo(dom) {
    const document = dom.window.document;
    
    let totalListings = 0;
    let currentPage = 1;
    let totalPages = 1;
    
    // Method 1: Look for results count text (e.g., "1-20 of 150 results")
    const resultTexts = document.querySelectorAll('*');
    for (const element of resultTexts) {
        const text = element.textContent || '';
        
        // Match various patterns
        const patterns = [
            /(\d+)\s*-\s*(\d+)\s+of\s+(\d+)/i,  // "1-20 of 150"
            /Showing\s+(\d+)\s*-\s*(\d+)\s+of\s+(\d+)/i,  // "Showing 1-20 of 150"
            /Results:\s*(\d+)\s*-\s*(\d+)\s+of\s+(\d+)/i,  // "Results: 1-20 of 150"
            /(\d+)\s+results?\s+found/i  // "150 results found"
        ];
        
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                if (match.length === 4) {
                    // Pattern with range
                    const start = parseInt(match[1]);
                    const end = parseInt(match[2]);
                    totalListings = parseInt(match[3]);
                    const perPage = end - start + 1;
                    currentPage = Math.floor(start / perPage) + 1;
                    totalPages = Math.ceil(totalListings / perPage);
                } else if (match.length === 2) {
                    // Pattern with total only
                    totalListings = parseInt(match[1]);
                    totalPages = Math.ceil(totalListings / 20); // Assume 20 per page
                }
                
                if (totalListings > 0) break;
            }
        }
        
        if (totalListings > 0) break;
    }
    
    // Method 2: Check pagination links
    if (totalPages === 1) {
        const paginationContainer = document.querySelector('.pagination, nav[aria-label="Pagination"], .page-numbers');
        if (paginationContainer) {
            const pageLinks = paginationContainer.querySelectorAll('a');
            pageLinks.forEach(link => {
                const href = link.getAttribute('href') || '';
                const pageMatch = href.match(/page=(\d+)/);
                if (pageMatch) {
                    const pageNum = parseInt(pageMatch[1]);
                    if (pageNum > totalPages) totalPages = pageNum;
                }
                
                // Also check link text
                const linkText = link.textContent || '';
                if (/^\d+$/.test(linkText.trim())) {
                    const pageNum = parseInt(linkText.trim());
                    if (pageNum > totalPages) totalPages = pageNum;
                }
            });
        }
    }
    
    // Method 3: Look for "Next" button to determine if there are more pages
    const nextButton = document.querySelector('a[rel="next"], .next-page, a:contains("Next"), a:contains("次へ")');
    const hasNextPage = nextButton && !nextButton.classList.contains('disabled');
    
    return {
        totalListings,
        currentPage,
        totalPages,
        hasNextPage,
        listingsPerPage: 20  // Default assumption
    };
}

// Extract detailed apartment information
function extractApartmentData(element) {
    const apartment = {
        id: null,
        title: '',
        price: 0,
        size: 0,
        layout: '',
        address: '',
        district: '',
        nearestStation: '',
        walkingTime: 0,
        trainLines: [],
        buildingType: '',
        buildingAge: null,
        floor: '',
        totalFloors: '',
        detailUrl: '',
        imageUrls: [],
        features: [],
        managementFee: 0,
        deposit: '',
        keyMoney: '',
        scrapedAt: new Date().toISOString()
    };
    
    try {
        // Extract URL and ID
        const linkElement = element.querySelector('a[href*="/rent/view/"]');
        if (linkElement) {
            const href = linkElement.getAttribute('href') || '';
            apartment.detailUrl = href.startsWith('http') ? href : `https://realestate.co.jp${href}`;
            
            const idMatch = href.match(/view\/(\d+)/);
            if (idMatch) apartment.id = `apt_${idMatch[1]}`;
        }
        
        // Extract title/property name
        const titleElement = element.querySelector('h3, h2, .property-title, .listing-title');
        if (titleElement) apartment.title = titleElement.textContent.trim();
        
        // Extract price (monthly rent)
        const priceElement = element.querySelector('.price, .rent, [class*="price"]');
        if (priceElement) {
            const priceText = priceElement.textContent || '';
            
            // Match various price formats
            const pricePatterns = [
                /([\d,]+)\s*円/,  // "150,000円"
                /¥\s*([\d,]+)/,   // "¥150,000"
                /JPY\s*([\d,]+)/i // "JPY 150,000"
            ];
            
            for (const pattern of pricePatterns) {
                const match = priceText.match(pattern);
                if (match) {
                    apartment.price = parseInt(match[1].replace(/,/g, ''));
                    break;
                }
            }
        }
        
        // Extract size
        const sizeElement = element.querySelector('.size, .area, [class*="size"]');
        if (sizeElement) {
            const sizeText = sizeElement.textContent || '';
            const sizeMatch = sizeText.match(/([\d.]+)\s*m²/);
            if (sizeMatch) {
                apartment.size = parseFloat(sizeMatch[1]);
            }
        }
        
        // Extract layout (1K, 1LDK, etc.)
        const layoutElement = element.querySelector('.layout, .floor-plan, [class*="layout"]');
        if (layoutElement) {
            const layoutText = layoutElement.textContent || '';
            const layoutMatch = layoutText.match(/([1-9][A-Z]*)/);
            if (layoutMatch) apartment.layout = layoutMatch[0];
        }
        
        // Extract address and district
        const addressElement = element.querySelector('.address, .location, [class*="address"]');
        if (addressElement) {
            const addressText = addressElement.textContent.trim();
            apartment.address = addressText;
            
            // Try to extract district (ku/shi)
            const districtMatch = addressText.match(/([^,]+(?:区|市))/);
            if (districtMatch) apartment.district = districtMatch[1];
        }
        
        // Extract station and walking time
        const stationElement = element.querySelector('.station, .access, [class*="station"]');
        if (stationElement) {
            const stationText = stationElement.textContent || '';
            
            // Match station name and walking time
            const stationMatch = stationText.match(/([^駅]+駅?)\s*(?:徒歩|walk)?\s*(\d+)\s*(?:分|min)/i);
            if (stationMatch) {
                apartment.nearestStation = stationMatch[1].trim();
                apartment.walkingTime = parseInt(stationMatch[2]);
            } else {
                apartment.nearestStation = stationText.trim();
            }
            
            // Extract train lines if mentioned
            const lineMatch = stationText.match(/\(([^)]+線[^)]*)\)/);
            if (lineMatch) {
                apartment.trainLines = lineMatch[1].split(/[,、]/).map(line => line.trim());
            }
        }
        
        // Extract building details
        const buildingElements = element.querySelectorAll('.building-info span, .property-info span, dd');
        buildingElements.forEach(elem => {
            const text = elem.textContent || '';
            
            // Building type
            if (text.includes('マンション') || text.includes('Mansion')) {
                apartment.buildingType = 'Mansion';
            } else if (text.includes('アパート') || text.includes('Apartment')) {
                apartment.buildingType = 'Apartment';
            }
            
            // Building age
            const ageMatch = text.match(/築(\d+)年|(\d+)\s*years?\s*old/i);
            if (ageMatch) {
                apartment.buildingAge = parseInt(ageMatch[1] || ageMatch[2]);
            }
            
            // Floor
            const floorMatch = text.match(/(\d+)階/);
            if (floorMatch) {
                apartment.floor = `${floorMatch[1]}F`;
            }
        });
        
        // Extract images
        const imageElements = element.querySelectorAll('img[src*="property"], img[src*="apartment"], .property-image img');
        imageElements.forEach(img => {
            const src = img.getAttribute('src') || '';
            if (src && !src.includes('no-image')) {
                const imageUrl = src.startsWith('http') ? src : `https://realestate.co.jp${src}`;
                if (!apartment.imageUrls.includes(imageUrl)) {
                    apartment.imageUrls.push(imageUrl);
                }
            }
        });
        
        // Extract features/amenities
        const featureElements = element.querySelectorAll('.feature, .amenity, [class*="feature"] li');
        featureElements.forEach(feat => {
            const feature = feat.textContent.trim();
            if (feature && feature.length < 50 && !apartment.features.includes(feature)) {
                apartment.features.push(feature);
            }
        });
        
    } catch (error) {
        console.warn(`⚠️  Error extracting apartment data: ${error.message}`);
    }
    
    return apartment;
}

// Extract all apartments from page
function extractApartments(html, pageUrl) {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    const apartments = [];
    
    // Common selectors for realestate.co.jp
    const selectors = [
        '.property-list-item',
        '.search-result-item',
        '.listing-item',
        'article.property',
        '.property-box',
        '.result-box',
        '[data-property-id]',
        '.rent-listing',
        'div[class*="property-item"]'
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
        console.warn('⚠️  No apartment listings found, trying broader search...');
        
        // Fallback: look for any repeated structure
        const allDivs = document.querySelectorAll('div');
        const candidateDivs = [];
        
        allDivs.forEach(div => {
            // Check if div contains price-like content
            const text = div.textContent || '';
            if (text.includes('円') && text.includes('m²') && div.querySelector('a[href*="/rent/"]')) {
                candidateDivs.push(div);
            }
        });
        
        if (candidateDivs.length > 0) {
            listingElements = candidateDivs;
            console.log(`🔍 Found ${listingElements.length} potential listings using fallback method`);
        }
    }
    
    listingElements.forEach((element, index) => {
        const apartment = extractApartmentData(element);
        
        // Only add if we have at least some basic info
        if (apartment.price > 0 || apartment.title || apartment.id) {
            apartments.push(apartment);
        }
    });
    
    return apartments;
}

// Main scraping function
async function scrapeAllApartments(searchUrl, options = {}) {
    const maxPages = options.maxPages || Infinity;
    const saveEveryNPages = options.saveEveryNPages || 10;
    
    console.log('🏠 Enhanced Apartment Scraper for realestate.co.jp');
    console.log('=================================================');
    console.log(`🔗 Search URL: ${searchUrl}`);
    if (maxPages !== Infinity) console.log(`📄 Max pages: ${maxPages}`);
    
    const startTime = Date.now();
    const allApartments = [];
    let currentPage = 1;
    let hasMorePages = true;
    
    try {
        while (hasMorePages && currentPage <= maxPages) {
            // Build URL for current page
            const pageUrl = new URL(searchUrl);
            pageUrl.searchParams.set('page', currentPage);
            
            console.log(`\n📄 Fetching page ${currentPage}...`);
            const html = await fetchPage(pageUrl.toString());
            
            // Extract pagination info
            const dom = new JSDOM(html);
            const paginationInfo = extractPaginationInfo(dom);
            
            if (currentPage === 1 && paginationInfo.totalListings > 0) {
                console.log(`📊 Total listings found: ${paginationInfo.totalListings}`);
                console.log(`📄 Estimated total pages: ${paginationInfo.totalPages}`);
            }
            
            // Extract apartments
            const apartments = extractApartments(html, pageUrl.toString());
            console.log(`✅ Found ${apartments.length} apartments on page ${currentPage}`);
            
            if (apartments.length === 0) {
                console.log('⚠️  No apartments found, checking if we\'ve reached the end...');
                
                // Save HTML for debugging
                const debugFile = path.join(OUTPUT_DIR, `debug_page_${currentPage}.html`);
                fs.writeFileSync(debugFile, html, 'utf8');
                console.log(`💾 Saved page HTML for debugging: ${debugFile}`);
                
                hasMorePages = false;
            } else {
                allApartments.push(...apartments);
                
                // Check if there's a next page
                hasMorePages = paginationInfo.hasNextPage || currentPage < paginationInfo.totalPages;
                
                // Save intermediate results
                if (currentPage % saveEveryNPages === 0) {
                    const tempFile = path.join(OUTPUT_DIR, `apartments_temp_${currentPage}.json`);
                    fs.writeFileSync(tempFile, JSON.stringify({
                        apartments: allApartments,
                        lastPage: currentPage
                    }, null, 2), 'utf8');
                    console.log(`💾 Saved intermediate results (${allApartments.length} apartments)`);
                }
            }
            
            currentPage++;
        }
        
        // Save final results
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputFile = path.join(OUTPUT_DIR, `apartments_${timestamp}.json`);
        
        const output = {
            metadata: {
                searchUrl: searchUrl,
                totalApartments: allApartments.length,
                pagesScraped: currentPage - 1,
                scrapedAt: new Date().toISOString(),
                executionTime: `${((Date.now() - startTime) / 1000).toFixed(2)} seconds`
            },
            apartments: allApartments
        };
        
        fs.writeFileSync(outputFile, JSON.stringify(output, null, 2), 'utf8');
        
        // Create summary file
        const summaryFile = path.join(OUTPUT_DIR, `summary_${timestamp}.txt`);
        const summary = generateSummary(output);
        fs.writeFileSync(summaryFile, summary, 'utf8');
        
        console.log('\n🎉 Scraping Complete!');
        console.log('====================');
        console.log(`📊 Total Apartments: ${allApartments.length}`);
        console.log(`📄 Pages Scraped: ${currentPage - 1}`);
        console.log(`⏱️  Execution Time: ${output.metadata.executionTime}`);
        console.log(`💾 Output saved to: ${outputFile}`);
        console.log(`📋 Summary saved to: ${summaryFile}`);
        
        return output;
        
    } catch (error) {
        console.error('\n💥 Fatal error during scraping:', error);
        
        // Save what we have so far
        if (allApartments.length > 0) {
            const errorFile = path.join(OUTPUT_DIR, `apartments_error_${Date.now()}.json`);
            fs.writeFileSync(errorFile, JSON.stringify({
                apartments: allApartments,
                error: error.message,
                lastPage: currentPage
            }, null, 2), 'utf8');
            console.log(`💾 Saved ${allApartments.length} apartments before error: ${errorFile}`);
        }
        
        throw error;
    }
}

// Generate summary report
function generateSummary(data) {
    const apartments = data.apartments;
    
    // Calculate statistics
    const priceStats = {
        min: Math.min(...apartments.map(a => a.price).filter(p => p > 0)),
        max: Math.max(...apartments.map(a => a.price).filter(p => p > 0)),
        avg: apartments.reduce((sum, a) => sum + a.price, 0) / apartments.length
    };
    
    const sizeStats = {
        min: Math.min(...apartments.map(a => a.size).filter(s => s > 0)),
        max: Math.max(...apartments.map(a => a.size).filter(s => s > 0)),
        avg: apartments.reduce((sum, a) => sum + a.size, 0) / apartments.filter(a => a.size > 0).length
    };
    
    // Count by layout
    const layoutCounts = {};
    apartments.forEach(apt => {
        if (apt.layout) {
            layoutCounts[apt.layout] = (layoutCounts[apt.layout] || 0) + 1;
        }
    });
    
    // Count by district
    const districtCounts = {};
    apartments.forEach(apt => {
        if (apt.district) {
            districtCounts[apt.district] = (districtCounts[apt.district] || 0) + 1;
        }
    });
    
    let summary = `Apartment Scraping Summary
==========================

Search URL: ${data.metadata.searchUrl}
Scraped At: ${data.metadata.scrapedAt}
Execution Time: ${data.metadata.executionTime}

Total Apartments: ${data.metadata.totalApartments}
Pages Scraped: ${data.metadata.pagesScraped}

Price Statistics:
  Min: ¥${priceStats.min.toLocaleString()}
  Max: ¥${priceStats.max.toLocaleString()}
  Average: ¥${Math.round(priceStats.avg).toLocaleString()}

Size Statistics:
  Min: ${sizeStats.min.toFixed(1)}m²
  Max: ${sizeStats.max.toFixed(1)}m²
  Average: ${sizeStats.avg.toFixed(1)}m²

Layout Distribution:
`;

    Object.entries(layoutCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([layout, count]) => {
            summary += `  ${layout}: ${count} (${(count / apartments.length * 100).toFixed(1)}%)\n`;
        });

    summary += `\nTop Districts:
`;

    Object.entries(districtCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([district, count]) => {
            summary += `  ${district}: ${count}\n`;
        });

    summary += `\nSample Listings:
`;

    apartments.slice(0, 5).forEach((apt, i) => {
        summary += `
${i + 1}. ${apt.title || 'Apartment ' + (i + 1)}
   Price: ¥${apt.price.toLocaleString()} | Size: ${apt.size}m² | Layout: ${apt.layout}
   Location: ${apt.address || apt.district || 'Unknown'}
   Station: ${apt.nearestStation} (${apt.walkingTime} min walk)
   URL: ${apt.detailUrl}
`;
    });

    return summary;
}

// Command line interface
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('Usage: node scrape_apartments_enhanced.js <search_url> [options]');
        console.log('\nOptions:');
        console.log('  --max-pages <n>    Maximum number of pages to scrape');
        console.log('  --save-every <n>   Save intermediate results every n pages');
        console.log('\nExample:');
        console.log('node scrape_apartments_enhanced.js "https://realestate.co.jp/en/rent?prefecture=JP-13&max_price=160000&page=1" --max-pages 5');
        process.exit(1);
    }
    
    const searchUrl = args[0];
    const options = {};
    
    // Parse options
    for (let i = 1; i < args.length; i += 2) {
        if (args[i] === '--max-pages' && args[i + 1]) {
            options.maxPages = parseInt(args[i + 1]);
        } else if (args[i] === '--save-every' && args[i + 1]) {
            options.saveEveryNPages = parseInt(args[i + 1]);
        }
    }
    
    scrapeAllApartments(searchUrl, options).catch(error => {
        console.error('Scraping failed:', error);
        process.exit(1);
    });
}

module.exports = { scrapeAllApartments, extractApartments, extractPaginationInfo, extractApartmentData };