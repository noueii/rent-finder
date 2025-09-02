#!/usr/bin/env node

/**
 * Fixed scraper for yolo-home.com (YOLO JAPAN)
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

// Tokyo ward name to Japanese mapping
const TOKYO_WARDS = {
    'Shibuya-ku': '渋谷区',
    'Shinjuku-ku': '新宿区',
    'Minato-ku': '港区',
    'Setagaya-ku': '世田谷区',
    'Toshima-ku': '豊島区',
    'Hachioji-shi': '八王子市',
    'Akishima-shi': '昭島市',
    'Katsushika-ku': '葛飾区',
    'Sumida-ku': '墨田区',
    'Chuo-ku': '中央区',
    'Meguro-ku': '目黒区',
    'Nerima-ku': '練馬区',
    'Koto-ku': '江東区',
    'Ota-ku': '大田区',
    'Bunkyo-ku': '文京区',
    'Taito-ku': '台東区',
    'Shinagawa-ku': '品川区',
    'Nakano-ku': '中野区',
    'Suginami-ku': '杉並区',
    'Kita-ku': '北区',
    'Arakawa-ku': '荒川区',
    'Itabashi-ku': '板橋区',
    'Adachi-ku': '足立区',
    'Edogawa-ku': '江戸川区',
    'Chiyoda-ku': '千代田区'
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

// Parse station information from address text
function parseStationsFromAddress(addressText) {
    const stations = [];
    
    // Common station patterns in addresses
    const stationPatterns = [
        /([^駅\s]+(?:駅|Station))\s*(?:(\d+)\s*(?:min|分|minutes?))?/gi,
        /([^駅\s]+)\s+Station\s*(?:(\d+)\s*(?:min|分|minutes?))?/gi
    ];
    
    for (const pattern of stationPatterns) {
        let match;
        while ((match = pattern.exec(addressText)) !== null) {
            const station = {
                name: match[1].replace(/駅$|Station$/i, '').trim(),
                line: '',
                walkingMinutes: parseInt(match[2]) || 0
            };
            
            if (station.name && !stations.find(s => s.name === station.name)) {
                stations.push(station);
            }
        }
    }
    
    return stations;
}

// Parse price from text
function parsePrice(priceText) {
    // Remove all non-numeric except comma and period
    const cleaned = priceText.replace(/[^\d,]/g, '');
    // Remove commas and parse
    return parseInt(cleaned.replace(/,/g, '')) || 0;
}

// Parse single apartment with building information
function parseApartmentWithBuilding(element, buildingInfo) {
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
        // Get URL and ID from checkbox or link
        const checkbox = element.querySelector('input[type="checkbox"][id^="property"]');
        if (checkbox) {
            apartment.id = checkbox.value;
        }
        
        const linkElement = element.querySelector('a[href*="/property/"]');
        if (linkElement) {
            const href = linkElement.getAttribute('href');
            apartment.url = href.startsWith('http') ? href : `https://home.yolo-japan.com${href}`;
            
            if (!apartment.id) {
                const idMatch = href.match(/property\/(\d+)/);
                if (idMatch) {
                    apartment.id = idMatch[1];
                }
            }
        }
        
        // Set building address and stations from building info
        if (buildingInfo.address) {
            apartment.location.address = buildingInfo.address;
            
            // Extract ward from address
            for (const [wardEn, wardJa] of Object.entries(TOKYO_WARDS)) {
                if (buildingInfo.address.includes(wardEn)) {
                    apartment.location.ward = wardEn;
                    apartment.location.wardJa = wardJa;
                    
                    // Extract area (everything before ward)
                    const parts = buildingInfo.address.split(wardEn);
                    if (parts.length > 0) {
                        apartment.location.area = parts[0].replace('Tokyo', '').trim();
                    }
                    break;
                }
            }
        }
        
        // Set stations from building info
        if (buildingInfo.stations && buildingInfo.stations.length > 0) {
            apartment.nearestStations = buildingInfo.stations;
        }
        
        // Get price from h5 elements (both in .info-detail)
        const infoDetails = element.querySelectorAll('.info-detail h5');
        infoDetails.forEach(h5 => {
            // Get the text content before any span elements
            const firstTextNode = h5.childNodes[0];
            if (firstTextNode && firstTextNode.nodeType === 3) { // Text node
                const priceText = firstTextNode.textContent.trim();
                
                // Look for price pattern with full-width Yen symbol
                const priceMatch = priceText.match(/￥([\d,]+)/);
                if (priceMatch) {
                    apartment.pricing.monthlyRent = parsePrice(priceMatch[1]);
                }
            }
        });
        
        // Get management fee from span tags
        const managementFeeSpans = element.querySelectorAll('span');
        managementFeeSpans.forEach(span => {
            const text = span.textContent;
            if (text.includes('Management fee')) {
                const match = text.match(/¥([\d,]+)/);
                if (match) {
                    apartment.pricing.managementFee = parsePrice(match[1]);
                }
            }
        });
        
        // Get size, floor, and layout from info-size div
        const sizeInfo = element.querySelector('.info-size');
        if (sizeInfo) {
            const sizeText = sizeInfo.textContent;
            
            // Extract floor/layout/size pattern (e.g., "7th floor/1DK/25.35m2")
            const infoMatch = sizeText.match(/(\d+)(?:st|nd|rd|th)?\s*floor\/([^\/]+)\/([0-9.]+)m2/i);
            if (infoMatch) {
                apartment.floor = infoMatch[1];
                
                // Parse layout
                const layoutInfo = parseLayout(infoMatch[2]);
                Object.assign(apartment, layoutInfo);
                
                apartment.size = parseFloat(infoMatch[3]);
            }
            
            // Extract deposit and key money
            const depositMatch = sizeText.match(/Security deposit([\d,]+)\s*yen/i);
            if (depositMatch) {
                apartment.pricing.deposit = parsePrice(depositMatch[1]);
            }
            
            const keyMoneyMatch = sizeText.match(/Key money([\d,]+)\s*yen/i);
            if (keyMoneyMatch) {
                apartment.pricing.keyMoney = parsePrice(keyMoneyMatch[1]);
            }
        }
        
        // Get features
        const featureElements = element.querySelectorAll('.txt-feature');
        featureElements.forEach(feat => {
            const feature = feat.textContent.trim();
            if (feature) {
                apartment.features.push(feature);
                
                // Check for specific features
                if (feature.toLowerCase().includes('balcony')) {
                    apartment.balcony = true;
                }
            }
        });
        
        // Get images
        const imageElements = element.querySelectorAll('img[data-src*="property"], img[src*="property"]');
        imageElements.forEach(img => {
            const src = img.getAttribute('data-src') || img.getAttribute('src');
            if (src && !src.includes('no-image') && !src.includes('.svg')) {
                const imageUrl = src.startsWith('http') ? src : `https://home.yolo-japan.com${src}`;
                
                if (img.alt && img.alt.toLowerCase().includes('floor plan')) {
                    apartment.floorPlanImage = imageUrl;
                } else {
                    apartment.images.push(imageUrl);
                }
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
    
    // YOLO HOME groups apartments by building
    // First find all property wrappers which contain building info and apartments
    const propertyWrappers = document.querySelectorAll('.property-wrapper');
    
    console.log(`🏢 Found ${propertyWrappers.length} property wrappers`);
    
    propertyWrappers.forEach(wrapper => {
        // Extract building information from the preview section
        const buildingInfo = {
            name: '',
            nameJa: '',
            type: 'Apartment',
            yearBuilt: null,
            totalFloors: null,
            address: '',
            stations: []
        };
        
        // Get building info from propery-preview
        const preview = wrapper.querySelector('.propery-preview');
        if (preview) {
            // Building name
            const buildingNameElement = preview.querySelector('h5 a');
            if (buildingNameElement) {
                const fullText = buildingNameElement.textContent.trim();
                // Remove "Apartment complex" prefix if present
                buildingInfo.name = fullText.replace(/^Apartment complex\s+/, '').trim();
            }
            
            // Building address and details
            const addressElement = preview.querySelector('.txt-info span');
            if (addressElement) {
                buildingInfo.address = addressElement.textContent.trim();
            }
            
            // Extract transport info
            const transportElement = preview.querySelector('.getTransportation');
            if (transportElement) {
                const transportText = transportElement.textContent.trim();
                const lines = transportText.split('\n').map(line => line.trim()).filter(line => line);
                
                lines.forEach(line => {
                    // Parse station info like "Tokyo Metro-Hibiya line Iriya 5 minutes on foot"
                    const stationMatch = line.match(/([^\s]+(?:\s+line)?)?\s+([^\s]+)\s+(\d+)\s+minutes?\s+on\s+foot/i);
                    if (stationMatch) {
                        buildingInfo.stations.push({
                            line: stationMatch[1] || '',
                            name: stationMatch[2],
                            walkingMinutes: parseInt(stationMatch[3])
                        });
                    }
                });
            }
            
            // Extract year built and floors
            const buildingDetailsSpan = preview.querySelectorAll('.txt-info span');
            buildingDetailsSpan.forEach(span => {
                const text = span.textContent;
                
                // Built X years ago
                const yearsMatch = text.match(/Built\s+(\d+)\s+years?\s+ago/i);
                if (yearsMatch) {
                    const yearsAgo = parseInt(yearsMatch[1]);
                    buildingInfo.yearBuilt = new Date().getFullYear() - yearsAgo;
                }
                
                // X floor building
                const floorsMatch = text.match(/(\d+)\s+floor\s+building/i);
                if (floorsMatch) {
                    buildingInfo.totalFloors = parseInt(floorsMatch[1]);
                }
            });
        }
        
        // Now get all property items (apartments) in this building
        const propertyItems = wrapper.querySelectorAll('.property-item');
        
        console.log(`   Found ${propertyItems.length} apartments in ${buildingInfo.name || 'Unknown Building'}`);
        
        propertyItems.forEach((element, index) => {
            const apartment = parseApartmentWithBuilding(element, buildingInfo);
            
            if (apartment.id) {
                apartments.push(apartment);
                
                // Log sample for first apartment of first building
                if (apartments.length === 1) {
                    console.log('\n📍 Sample apartment:');
                    console.log(`   ID: ${apartment.id}`);
                    console.log(`   Building: ${apartment.building.name}`);
                    console.log(`   Location: ${apartment.location.area} ${apartment.location.ward}`);
                    console.log(`   Address: ${apartment.location.address}`);
                    console.log(`   Price: ¥${apartment.pricing.monthlyRent.toLocaleString()}/month`);
                    console.log(`   Size: ${apartment.size}m² | Floor: ${apartment.floor}`);
                    console.log(`   Layout: ${apartment.layout}`);
                    if (apartment.nearestStations.length > 0) {
                        console.log(`   Stations: ${apartment.nearestStations.map(s => `${s.name} (${s.walkingMinutes}min)`).join(', ')}`);
                    }
                }
            }
        });
    });
    
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
        
        // Look for pagination element to get total pages
        const paginationElement = document.querySelector('.el-pagination');
        if (paginationElement) {
            // Find the last page number
            const pageNumbers = paginationElement.querySelectorAll('.el-pager .number');
            if (pageNumbers.length > 0) {
                const lastPageElement = pageNumbers[pageNumbers.length - 1];
                info.totalPages = parseInt(lastPageElement.textContent);
            }
        }
        
        // Check if there's a next button that's not disabled
        const nextButton = document.querySelector('.el-pagination .btn-next:not([disabled])');
        if (nextButton && info.currentPage < info.totalPages) {
            info.hasNextPage = true;
            urlObj.searchParams.set('page', info.currentPage + 1);
            info.nextPageUrl = urlObj.toString();
        }
        
        // Calculate total results
        info.totalResults = info.totalPages * info.resultsPerPage;
        
    } catch (error) {
        console.error('Pagination error:', error);
    }
    
    return info;
}

// Main scraper
async function scrapeAllPages(startUrl, options = {}) {
    const maxPages = options.maxPages || 100;
    const saveEvery = options.saveEvery || 5;
    
    console.log('🏠 YOLO HOME Apartment Scraper (Fixed)');
    console.log('=====================================\n');
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
            if (pagination.totalPages > 1) {
                console.log(`📊 Total pages: ${pagination.totalPages}`);
            }
            
            if (apartments.length === 0) {
                console.log('⚠️  No apartments found, stopping');
                break;
            }
            
            allApartments.push(...apartments);
            
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
   Management Fee: ¥${apt.pricing.managementFee.toLocaleString()}/month
   Size: ${apt.size}m² | Floor: ${apt.floor}
   Layout: ${apt.layout}
   
   Location: ${apt.location.area || ''} ${apt.location.ward}
   Address: ${apt.location.address}
   ${apt.nearestStations.length > 0 ? `Stations: ${apt.nearestStations.map(s => `${s.name} (${s.walkingMinutes}min)`).join(', ')}` : ''}
   
   Features: ${apt.features.join(', ') || 'N/A'}
   
   URL: ${apt.url || 'N/A'}
`).join('\n---\n')}`;
}

// CLI
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('Usage: node scrape_yolo_home_fixed.js <search_url> [options]');
        console.log('\nOptions:');
        console.log('  --max-pages <n>   Maximum pages to scrape (default: 100)');
        console.log('  --save-every <n>  Save intermediate results every n pages (default: 5)');
        console.log('\nExample:');
        console.log('node scrape_yolo_home_fixed.js "https://home.yolo-japan.com/en/tokyo/list?priceTo=150&areaFrom=25&page=1" --max-pages 5');
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