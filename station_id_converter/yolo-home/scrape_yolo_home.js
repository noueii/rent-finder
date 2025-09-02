#!/usr/bin/env node

/**
 * Scraper for yolo-home.com (YOLO JAPAN)
 * Extracts apartment data with building information
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Configuration
const RATE_LIMIT_MS = 2000;
const OUTPUT_DIR = path.join(__dirname, 'scraped_apartments');

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Tokyo municipality codes to names mapping
const MUNICIPALITY_NAMES = {
    '13101': 'Chiyoda-ku',
    '13102': 'Chuo-ku',
    '13103': 'Minato-ku',
    '13104': 'Shinjuku-ku',
    '13105': 'Bunkyo-ku',
    '13106': 'Taito-ku',
    '13107': 'Sumida-ku',
    '13108': 'Koto-ku',
    '13109': 'Shinagawa-ku',
    '13110': 'Meguro-ku',
    '13111': 'Ota-ku',
    '13112': 'Setagaya-ku',
    '13113': 'Shibuya-ku',
    '13114': 'Nakano-ku',
    '13115': 'Suginami-ku',
    '13116': 'Toshima-ku',
    '13117': 'Kita-ku',
    '13118': 'Arakawa-ku',
    '13119': 'Itabashi-ku',
    '13120': 'Nerima-ku',
    '13121': 'Adachi-ku',
    '13122': 'Katsushika-ku',
    '13123': 'Edogawa-ku'
};

// Fetch page
async function fetchPage(url) {
    console.log(`🌐 Fetching: ${url}`);
    
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache'
        }
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    console.log(`✅ Received ${html.length} bytes`);
    
    // Save first page for debugging
    if (url.includes('page=1')) {
        const debugFile = path.join(OUTPUT_DIR, 'yolo_home_sample.html');
        fs.writeFileSync(debugFile, html, 'utf8');
        console.log(`💾 Saved sample HTML to: ${debugFile}`);
    }
    
    return html;
}

// Parse layout type
function parseLayout(layoutText) {
    const result = {
        layout: '',
        layoutType: '',
        bedrooms: 0,
        hasLivingRoom: false,
        hasDiningKitchen: false,
        hasKitchen: false,
        hasServiceRoom: false
    };
    
    // Extract layout pattern (e.g., "1K", "2LDK", "1R")
    const layoutMatch = layoutText.match(/\b([1-9])(R|K|DK|LDK|SLDK)\b/);
    if (layoutMatch) {
        result.layout = layoutMatch[0];
        result.layoutType = layoutMatch[2];
        result.bedrooms = parseInt(layoutMatch[1]);
        
        // Determine room features
        result.hasKitchen = layoutMatch[2].includes('K');
        result.hasDiningKitchen = layoutMatch[2].includes('DK');
        result.hasLivingRoom = layoutMatch[2].includes('L');
        result.hasServiceRoom = layoutMatch[2].includes('S');
    }
    
    return result;
}

// Parse station information
function parseStationInfo(stationText) {
    const stations = [];
    
    // Split by common delimiters for multiple stations
    const stationParts = stationText.split(/[,、]/);
    
    stationParts.forEach(part => {
        const station = {
            name: '',
            line: '',
            walkingMinutes: 0
        };
        
        // Extract station name, line, and walking time
        // Pattern: "Line Name Station Name X min walk"
        const match = part.match(/(?:([^駅]+線))?\s*([^駅\s]+(?:駅)?)\s*(?:(\d+)\s*(?:min|分))?/i);
        
        if (match) {
            station.line = match[1]?.trim() || '';
            station.name = match[2]?.trim().replace(/駅$/, '') || '';
            station.walkingMinutes = parseInt(match[3]) || 0;
            
            if (station.name) {
                stations.push(station);
            }
        }
    });
    
    return stations;
}

// Parse single apartment from YOLO HOME structure
function parseApartment(element, buildingInfo = {}) {
    const apartment = {
        // Identifiers
        id: null,
        url: null,
        
        // Building information
        building: {
            name: buildingInfo.name || '',
            nameJa: buildingInfo.nameJa || '',
            type: buildingInfo.type || 'Apartment',
            yearBuilt: buildingInfo.yearBuilt || null,
            totalFloors: buildingInfo.totalFloors || null,
            totalUnits: buildingInfo.totalUnits || null,
            structure: buildingInfo.structure || '',
            features: buildingInfo.features || []
        },
        
        // Apartment details
        title: '',
        roomNumber: '',
        
        // Layout
        layout: '',
        layoutType: '',
        bedrooms: 0,
        hasLivingRoom: false,
        hasDiningKitchen: false,
        hasKitchen: false,
        
        // Location
        location: {
            address: '',
            area: '',
            ward: '',
            wardJa: '',
            city: 'Tokyo',
            postalCode: '',
            latitude: null,
            longitude: null
        },
        
        // Pricing
        pricing: {
            monthlyRent: 0,
            deposit: 0,
            keyMoney: 0,
            guaranteeFee: 0,
            managementFee: 0,
            commonServiceFee: 0,
            initialCost: 0
        },
        
        // Property details
        size: 0,
        floor: '',
        balcony: false,
        
        // Stations
        nearestStations: [],
        
        // Availability
        availableFrom: '',
        moveInDate: '',
        
        // Features and amenities
        features: [],
        amenities: [],
        
        // Media
        images: [],
        floorPlanImage: '',
        
        // Agent/Company
        agencyName: '',
        agencyContact: '',
        
        // Metadata
        scrapedAt: new Date().toISOString()
    };
    
    try {
        // Extract apartment-specific data from the element
        // This will depend on YOLO HOME's HTML structure
        
        // Get URL and ID
        const linkElement = element.querySelector('a[href*="/room/"], a[href*="/property/"]');
        if (linkElement) {
            const href = linkElement.getAttribute('href');
            apartment.url = href.startsWith('http') ? href : `https://home.yolo-japan.com${href}`;
            
            const idMatch = href.match(/\/(\d+)(?:\/|$)/);
            if (idMatch) {
                apartment.id = idMatch[1];
            }
        }
        
        // Get room number or title
        const titleElement = element.querySelector('.room-title, .property-title, h3, h4');
        if (titleElement) {
            apartment.title = titleElement.textContent.trim();
            
            // Extract room number if present
            const roomMatch = apartment.title.match(/(?:Room\s*|号室\s*)(\d+[A-Z]?)/i);
            if (roomMatch) {
                apartment.roomNumber = roomMatch[1];
            }
        }
        
        // Get layout
        const layoutElement = element.querySelector('.layout, .floor-plan, [class*="layout"]');
        if (layoutElement) {
            const layoutInfo = parseLayout(layoutElement.textContent);
            Object.assign(apartment, layoutInfo);
        }
        
        // Get size
        const sizeElement = element.querySelector('.size, .area, [class*="size"]');
        if (sizeElement) {
            const sizeMatch = sizeElement.textContent.match(/([\d.]+)\s*(?:m²|㎡)/);
            if (sizeMatch) {
                apartment.size = parseFloat(sizeMatch[1]);
            }
        }
        
        // Get pricing
        const priceElement = element.querySelector('.price, .rent, [class*="price"]');
        if (priceElement) {
            const priceText = priceElement.textContent;
            const priceMatch = priceText.match(/¥?([\d,]+)(?:円)?/);
            if (priceMatch) {
                apartment.pricing.monthlyRent = parseInt(priceMatch[1].replace(/,/g, ''));
            }
        }
        
        // Get floor
        const floorElement = element.querySelector('.floor, [class*="floor"]');
        if (floorElement) {
            const floorMatch = floorElement.textContent.match(/(\d+)[階F]/);
            if (floorMatch) {
                apartment.floor = floorMatch[1];
            }
        }
        
        // Get stations
        const stationElement = element.querySelector('.station, .access, [class*="station"]');
        if (stationElement) {
            apartment.nearestStations = parseStationInfo(stationElement.textContent);
        }
        
        // Get images
        const imageElements = element.querySelectorAll('img[src*="property"], img[src*="room"], .property-image img');
        imageElements.forEach(img => {
            const src = img.getAttribute('src');
            if (src && !src.includes('no-image')) {
                const imageUrl = src.startsWith('http') ? src : `https://home.yolo-japan.com${src}`;
                apartment.images.push(imageUrl);
            }
        });
        
        // Get features
        const featureElements = element.querySelectorAll('.feature, .amenity, [class*="feature"] li');
        featureElements.forEach(feat => {
            const feature = feat.textContent.trim();
            if (feature) {
                apartment.features.push(feature);
            }
        });
        
    } catch (error) {
        console.error('Parse error:', error);
    }
    
    return apartment;
}

// Extract all apartments from page
function extractApartments(html) {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    const apartments = [];
    
    // YOLO HOME might group apartments by building
    // First, try to find building containers
    const buildingContainers = document.querySelectorAll('.building-container, .property-group, [class*="building"]');
    
    if (buildingContainers.length > 0) {
        console.log(`🏢 Found ${buildingContainers.length} buildings`);
        
        buildingContainers.forEach(buildingContainer => {
            // Extract building information
            const buildingInfo = {
                name: '',
                nameJa: '',
                type: 'Apartment',
                yearBuilt: null,
                totalFloors: null
            };
            
            // Get building name
            const buildingNameElement = buildingContainer.querySelector('.building-name, h2, h3');
            if (buildingNameElement) {
                buildingInfo.name = buildingNameElement.textContent.trim();
            }
            
            // Get building details
            const buildingDetails = buildingContainer.querySelectorAll('.building-detail, .building-info span');
            buildingDetails.forEach(detail => {
                const text = detail.textContent;
                
                // Year built
                const yearMatch = text.match(/(?:築|Built:?)\s*(\d{4})/);
                if (yearMatch) {
                    buildingInfo.yearBuilt = parseInt(yearMatch[1]);
                }
                
                // Total floors
                const floorMatch = text.match(/(\d+)\s*(?:階建|floors?)/i);
                if (floorMatch) {
                    buildingInfo.totalFloors = parseInt(floorMatch[1]);
                }
            });
            
            // Find apartments within this building
            const apartmentElements = buildingContainer.querySelectorAll('.room-item, .apartment-item, .property-item');
            
            apartmentElements.forEach(aptElement => {
                const apartment = parseApartment(aptElement, buildingInfo);
                if (apartment.id || apartment.title) {
                    apartments.push(apartment);
                }
            });
        });
    } else {
        // Fallback: Look for individual property listings
        console.log('🏠 Looking for individual property listings...');
        
        const listingSelectors = [
            '.property-item',
            '.room-item',
            '.listing-item',
            '.search-result-item',
            'article.property',
            '[class*="property-card"]',
            '[class*="room-card"]'
        ];
        
        let listingElements = [];
        for (const selector of listingSelectors) {
            listingElements = document.querySelectorAll(selector);
            if (listingElements.length > 0) {
                console.log(`✅ Found ${listingElements.length} listings using selector: ${selector}`);
                break;
            }
        }
        
        listingElements.forEach(element => {
            const apartment = parseApartment(element);
            if (apartment.id || apartment.title) {
                apartments.push(apartment);
            }
        });
    }
    
    return apartments;
}

// Get pagination info
function getPaginationInfo(html, currentUrl) {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    const info = {
        currentPage: 1,
        totalPages: 1,
        totalResults: 0,
        hasNextPage: false,
        nextPageUrl: null,
        resultsPerPage: 50
    };
    
    try {
        const urlObj = new URL(currentUrl);
        info.currentPage = parseInt(urlObj.searchParams.get('page') || '1');
        info.resultsPerPage = parseInt(urlObj.searchParams.get('perPage') || '50');
        
        // Look for total results count
        const resultsText = document.body.textContent;
        
        // Try different patterns
        const patterns = [
            /(\d+)\s*件/,  // Japanese style: "100件"
            /(\d+)\s+properties?/i,
            /(\d+)\s+results?/i,
            /Total:\s*(\d+)/i
        ];
        
        for (const pattern of patterns) {
            const match = resultsText.match(pattern);
            if (match) {
                info.totalResults = parseInt(match[1]);
                info.totalPages = Math.ceil(info.totalResults / info.resultsPerPage);
                break;
            }
        }
        
        // Check for next page
        info.hasNextPage = info.currentPage < info.totalPages;
        
        if (info.hasNextPage) {
            urlObj.searchParams.set('page', info.currentPage + 1);
            info.nextPageUrl = urlObj.toString();
        }
        
        // Alternative: Look for next page button
        if (!info.nextPageUrl) {
            const nextButton = document.querySelector('a[rel="next"], .pagination .next, a[href*="page=' + (info.currentPage + 1) + '"]');
            if (nextButton && !nextButton.classList.contains('disabled')) {
                const href = nextButton.getAttribute('href');
                if (href) {
                    info.hasNextPage = true;
                    info.nextPageUrl = href.startsWith('http') ? href : `https://home.yolo-japan.com${href}`;
                }
            }
        }
        
    } catch (error) {
        console.error('Pagination error:', error);
    }
    
    return info;
}

// Main scraper
async function scrapeAllPages(startUrl, options = {}) {
    const maxPages = options.maxPages || 100;
    const saveEvery = options.saveEvery || 5;
    
    console.log('🏠 YOLO HOME Apartment Scraper');
    console.log('==============================\n');
    console.log(`📍 Search URL: ${startUrl}\n`);
    
    const allApartments = [];
    let currentUrl = startUrl;
    let pageCount = 0;
    
    const startTime = Date.now();
    
    try {
        while (currentUrl && pageCount < maxPages) {
            pageCount++;
            
            console.log(`\n📄 Page ${pageCount}`);
            
            // Rate limiting
            if (pageCount > 1) {
                console.log(`⏳ Waiting ${RATE_LIMIT_MS}ms...`);
                await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
            }
            
            // Fetch and extract
            const html = await fetchPage(currentUrl);
            const apartments = extractApartments(html);
            const pagination = getPaginationInfo(html, currentUrl);
            
            console.log(`✅ Found ${apartments.length} apartments`);
            if (pagination.totalResults > 0) {
                console.log(`📊 Total results: ${pagination.totalResults} (${pagination.totalPages} pages)`);
            }
            
            if (apartments.length === 0) {
                console.log('⚠️  No apartments found, stopping');
                break;
            }
            
            allApartments.push(...apartments);
            
            // Show sample
            if (apartments.length > 0) {
                const sample = apartments[0];
                console.log(`📍 Sample: ${sample.layout} in ${sample.building.name || 'Unknown Building'}`);
                console.log(`   Price: ¥${sample.pricing.monthlyRent.toLocaleString()}/month, ${sample.size}m²`);
                if (sample.nearestStations.length > 0) {
                    console.log(`   Station: ${sample.nearestStations[0].name} (${sample.nearestStations[0].walkingMinutes} min)`);
                }
            }
            
            // Save intermediate results
            if (pageCount % saveEvery === 0) {
                const tempFile = path.join(OUTPUT_DIR, `yolo_temp_${pageCount}pages.json`);
                fs.writeFileSync(tempFile, JSON.stringify({
                    pages: pageCount,
                    apartments: allApartments
                }, null, 2));
                console.log(`💾 Saved ${allApartments.length} apartments (intermediate)`);
            }
            
            // Next page
            if (pagination.hasNextPage && pagination.nextPageUrl) {
                currentUrl = pagination.nextPageUrl;
            } else {
                console.log('📍 No more pages');
                break;
            }
        }
        
        // Save final results
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputFile = path.join(OUTPUT_DIR, `yolo_apartments_${timestamp}.json`);
        
        const output = {
            metadata: {
                source: 'YOLO HOME (home.yolo-japan.com)',
                searchUrl: startUrl,
                totalApartments: allApartments.length,
                pagesScraped: pageCount,
                scrapedAt: new Date().toISOString(),
                executionTime: ((Date.now() - startTime) / 1000).toFixed(2) + 's'
            },
            apartments: allApartments
        };
        
        fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
        
        // Create summary
        const summary = createSummary(output);
        const summaryFile = path.join(OUTPUT_DIR, `yolo_summary_${timestamp}.txt`);
        fs.writeFileSync(summaryFile, summary);
        
        console.log('\n✅ Scraping Complete!');
        console.log('====================');
        console.log(`Total apartments: ${allApartments.length}`);
        console.log(`Pages scraped: ${pageCount}`);
        console.log(`Execution time: ${output.metadata.executionTime}`);
        console.log(`\nOutput: ${outputFile}`);
        console.log(`Summary: ${summaryFile}`);
        
        return output;
        
    } catch (error) {
        console.error('\n💥 Error:', error);
        
        if (allApartments.length > 0) {
            const errorFile = path.join(OUTPUT_DIR, `yolo_error_${Date.now()}.json`);
            fs.writeFileSync(errorFile, JSON.stringify({
                error: error.message,
                apartments: allApartments,
                lastPage: pageCount
            }, null, 2));
            console.log(`💾 Saved ${allApartments.length} apartments before error`);
        }
        
        throw error;
    }
}

// Create summary
function createSummary(data) {
    const apts = data.apartments;
    
    if (apts.length === 0) {
        return 'No apartments found';
    }
    
    // Price statistics
    const prices = apts.map(a => a.pricing.monthlyRent).filter(p => p > 0);
    const priceStats = prices.length > 0 ? {
        min: Math.min(...prices),
        max: Math.max(...prices),
        avg: prices.reduce((sum, p) => sum + p, 0) / prices.length
    } : { min: 0, max: 0, avg: 0 };
    
    // Size statistics
    const sizes = apts.map(a => a.size).filter(s => s > 0);
    const sizeStats = sizes.length > 0 ? {
        min: Math.min(...sizes),
        max: Math.max(...sizes),
        avg: sizes.reduce((sum, s) => sum + s, 0) / sizes.length
    } : { min: 0, max: 0, avg: 0 };
    
    // Distributions
    const layoutCounts = {};
    const buildingCounts = {};
    const wardCounts = {};
    const stationCounts = {};
    
    apts.forEach(apt => {
        // Layout
        if (apt.layout) {
            layoutCounts[apt.layout] = (layoutCounts[apt.layout] || 0) + 1;
        }
        
        // Building
        if (apt.building.name) {
            buildingCounts[apt.building.name] = (buildingCounts[apt.building.name] || 0) + 1;
        }
        
        // Ward
        if (apt.location.ward) {
            wardCounts[apt.location.ward] = (wardCounts[apt.location.ward] || 0) + 1;
        }
        
        // Stations
        apt.nearestStations.forEach(station => {
            if (station.name) {
                stationCounts[station.name] = (stationCounts[station.name] || 0) + 1;
            }
        });
    });
    
    return `YOLO HOME Scraping Summary
===========================

Source: ${data.metadata.source}
Search URL: ${data.metadata.searchUrl}
Generated: ${new Date(data.metadata.scrapedAt).toLocaleString()}
Execution Time: ${data.metadata.executionTime}

Overview
--------
Total Apartments: ${apts.length}
Pages Scraped: ${data.metadata.pagesScraped}

Price Analysis
--------------
Monthly Rent Range: ¥${priceStats.min.toLocaleString()} - ¥${priceStats.max.toLocaleString()}
Average Monthly Rent: ¥${Math.round(priceStats.avg).toLocaleString()}

Size Analysis
-------------
Size Range: ${sizeStats.min.toFixed(1)}m² - ${sizeStats.max.toFixed(1)}m²
Average Size: ${sizeStats.avg.toFixed(1)}m²

Layout Distribution
-------------------
${Object.entries(layoutCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([layout, count]) => `${layout}: ${count} apartments (${(count/apts.length*100).toFixed(1)}%)`)
    .join('\n')}

Buildings (Top 10)
------------------
${Object.entries(buildingCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([building, count]) => `${building}: ${count} apartments`)
    .join('\n')}

Ward Distribution
-----------------
${Object.entries(wardCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([ward, count]) => `${ward}: ${count} apartments`)
    .join('\n')}

Popular Stations (Top 10)
-------------------------
${Object.entries(stationCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([station, count]) => `${station}: ${count} apartments`)
    .join('\n')}

Sample Listings
---------------
${apts.slice(0, 5).map((apt, i) => `
${i+1}. ${apt.title || apt.layout + ' Apartment'}
   Building: ${apt.building.name || 'N/A'}
   Room: ${apt.roomNumber || 'N/A'}
   
   Price: ¥${apt.pricing.monthlyRent.toLocaleString()}/month
   Size: ${apt.size}m² | Floor: ${apt.floor}
   
   Location: ${apt.location.area || ''} ${apt.location.ward}
   ${apt.nearestStations.length > 0 ? `Station: ${apt.nearestStations.map(s => `${s.name} (${s.walkingMinutes}min)`).join(', ')}` : ''}
   
   URL: ${apt.url || 'N/A'}
`).join('\n---\n')}`;
}

// CLI
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('Usage: node scrape_yolo_home.js <search_url> [options]');
        console.log('\nOptions:');
        console.log('  --max-pages <n>   Maximum pages to scrape (default: 100)');
        console.log('  --save-every <n>  Save intermediate results every n pages (default: 5)');
        console.log('\nExample:');
        console.log('node scrape_yolo_home.js "https://home.yolo-japan.com/en/tokyo/list?priceTo=150&areaFrom=25&page=1" --max-pages 5');
        process.exit(1);
    }
    
    const searchUrl = args[0];
    const options = {};
    
    // Parse options
    for (let i = 1; i < args.length; i += 2) {
        if (args[i] === '--max-pages') {
            options.maxPages = parseInt(args[i + 1]);
        } else if (args[i] === '--save-every') {
            options.saveEvery = parseInt(args[i + 1]);
        }
    }
    
    scrapeAllPages(searchUrl, options).catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { scrapeAllPages, extractApartments };