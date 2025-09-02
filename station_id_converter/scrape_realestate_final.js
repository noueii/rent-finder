#!/usr/bin/env node

/**
 * Final optimized scraper for realestate.co.jp
 * Properly extracts and organizes apartment data
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

// Tokyo wards and cities mapping
const TOKYO_WARDS = {
    'Chiyoda-ku': '千代田区',
    'Chuo-ku': '中央区',
    'Minato-ku': '港区',
    'Shinjuku-ku': '新宿区',
    'Bunkyo-ku': '文京区',
    'Taito-ku': '台東区',
    'Sumida-ku': '墨田区',
    'Koto-ku': '江東区',
    'Shinagawa-ku': '品川区',
    'Meguro-ku': '目黒区',
    'Ota-ku': '大田区',
    'Setagaya-ku': '世田谷区',
    'Shibuya-ku': '渋谷区',
    'Nakano-ku': '中野区',
    'Suginami-ku': '杉並区',
    'Toshima-ku': '豊島区',
    'Kita-ku': '北区',
    'Arakawa-ku': '荒川区',
    'Itabashi-ku': '板橋区',
    'Nerima-ku': '練馬区',
    'Adachi-ku': '足立区',
    'Katsushika-ku': '葛飾区',
    'Edogawa-ku': '江戸川区'
};

// Property type mapping
const PROPERTY_TYPES = {
    'Apartment': 'アパート',
    'Mansion': 'マンション',
    'House': '一戸建て',
    'Terrace House': 'テラスハウス'
};

// Fetch page
async function fetchPage(url) {
    console.log(`🌐 Fetching: ${url}`);
    
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9'
        }
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    console.log(`✅ Received ${html.length} bytes`);
    return html;
}

// Parse location string into structured data
function parseLocation(locationText) {
    const location = {
        area: '',        // Neighborhood/area name (e.g., "Hiroo")
        ward: '',        // Ward or city (e.g., "Shibuya-ku")
        wardJa: '',      // Japanese ward name
        city: 'Tokyo',   // Prefecture/city
        fullAddress: locationText
    };
    
    // Clean up the location text
    const cleaned = locationText.replace(/^in\s+/, '').trim();
    
    // Split by common delimiters
    const parts = cleaned.split(/[,\n]/).map(p => p.trim()).filter(p => p);
    
    if (parts.length > 0) {
        // First part is usually the area/neighborhood
        location.area = parts[0];
        
        // Remove area from the full text to find ward
        const remainingText = cleaned.substring(location.area.length);
        
        // Look for ward patterns
        for (const [wardEn, wardJa] of Object.entries(TOKYO_WARDS)) {
            if (remainingText.includes(wardEn) || cleaned.includes(wardEn)) {
                location.ward = wardEn;
                location.wardJa = wardJa;
                break;
            }
        }
        
        // If no ward found, check for city patterns (e.g., "Mitaka-shi")
        if (!location.ward && remainingText.match(/-shi\b/)) {
            const cityMatch = remainingText.match(/([A-Za-z]+-shi)/);
            if (cityMatch) {
                location.ward = cityMatch[1];
            }
        }
    }
    
    // Special case: sometimes area and ward are concatenated
    if (!location.ward && location.area) {
        for (const wardEn of Object.keys(TOKYO_WARDS)) {
            const wardWithoutKu = wardEn.replace('-ku', '');
            if (location.area.includes(wardWithoutKu)) {
                location.ward = wardEn;
                location.wardJa = TOKYO_WARDS[wardEn];
                // Extract the actual area name
                location.area = location.area.replace(wardWithoutKu, '').trim();
                break;
            }
        }
    }
    
    return location;
}

// Parse apartment title to extract layout and property type
function parseTitle(titleText) {
    const result = {
        layout: '',
        propertyType: 'Apartment',
        bedrooms: 0,
        hasLivingRoom: false,
        hasDiningKitchen: false,
        hasKitchen: false
    };
    
    // Extract layout (e.g., 1K, 2LDK, 3DK)
    const layoutMatch = titleText.match(/\b([1-9])(R|K|DK|LDK|SLDK)\b/);
    if (layoutMatch) {
        result.layout = layoutMatch[0];
        result.bedrooms = parseInt(layoutMatch[1]);
        
        const layoutType = layoutMatch[2];
        result.hasKitchen = layoutType.includes('K');
        result.hasDiningKitchen = layoutType.includes('DK');
        result.hasLivingRoom = layoutType.includes('L');
    }
    
    // Extract property type
    for (const propType of Object.keys(PROPERTY_TYPES)) {
        if (titleText.includes(propType)) {
            result.propertyType = propType;
            break;
        }
    }
    
    return result;
}

// Parse station info
function parseStationInfo(stationText) {
    const info = {
        stationName: '',
        stationNameJa: '',
        walkingMinutes: 0,
        trainLines: []
    };
    
    // Match station name and walking time
    const match = stationText.match(/([^(]+?)\s*(?:Station)?\s*\((\d+)\s*min/);
    if (match) {
        info.stationName = match[1].trim().replace(/\s*Station\s*$/, '');
        info.walkingMinutes = parseInt(match[2]);
    } else {
        info.stationName = stationText.trim();
    }
    
    // Extract train lines if mentioned
    const lineMatch = stationText.match(/\(([^)]+Line[^)]*)\)/);
    if (lineMatch) {
        info.trainLines = lineMatch[1].split(/[,、]/).map(line => line.trim());
    }
    
    return info;
}

// Parse single apartment with better organization
function parseApartment(element) {
    const apartment = {
        // Identifiers
        id: null,
        url: null,
        
        // Title and type
        title: '',
        propertyType: 'Apartment',
        
        // Layout details
        layout: '',
        bedrooms: 0,
        hasLivingRoom: false,
        hasDiningKitchen: false,
        hasKitchen: false,
        
        // Location details
        location: {
            area: '',
            ward: '',
            wardJa: '',
            city: 'Tokyo',
            fullAddress: ''
        },
        
        // Pricing
        pricing: {
            monthlyRent: 0,
            deposit: 0,
            keyMoney: 0,
            managementFee: 0,
            totalMonthlyCost: 0
        },
        
        // Property details
        size: 0,
        floor: '',
        totalFloors: '',
        yearBuilt: null,
        buildingAge: null,
        
        // Station/Transit
        station: {
            name: '',
            nameJa: '',
            walkingMinutes: 0,
            trainLines: []
        },
        
        // Availability
        availableFrom: '',
        
        // Media
        imageUrl: '',
        agencyLogo: '',
        
        // Features
        features: [],
        
        // Metadata
        scrapedAt: new Date().toISOString()
    };
    
    try {
        // Get ID and URL
        const linkElement = element.querySelector('a[href*="/en/rent/view/"]');
        if (linkElement) {
            const href = linkElement.getAttribute('href');
            const idMatch = href.match(/\/view\/(\d+)/);
            if (idMatch) {
                apartment.id = idMatch[1];
                apartment.url = `https://realestate.co.jp${href}`;
            }
        }
        
        // Get title and parse layout/property type
        const titleElement = element.querySelector('.listing-title');
        if (titleElement) {
            const titleLink = titleElement.querySelector('.text-semi-strong');
            if (titleLink) {
                apartment.title = titleLink.textContent.trim();
                
                // Parse title for layout and property type
                const titleInfo = parseTitle(apartment.title);
                apartment.layout = titleInfo.layout;
                apartment.propertyType = titleInfo.propertyType;
                apartment.bedrooms = titleInfo.bedrooms;
                apartment.hasLivingRoom = titleInfo.hasLivingRoom;
                apartment.hasDiningKitchen = titleInfo.hasDiningKitchen;
                apartment.hasKitchen = titleInfo.hasKitchen;
            }
            
            // Get and parse location
            const locationText = titleElement.textContent.replace(apartment.title, '').trim();
            apartment.location = parseLocation(locationText);
        }
        
        // Get all listing items for detailed parsing
        const listingItems = element.querySelectorAll('.listing-item');
        listingItems.forEach(item => {
            const label = item.querySelector('.text-strong');
            if (!label) return;
            
            const labelText = label.textContent.trim();
            const valueText = item.textContent.replace(labelText, '').trim();
            
            switch(labelText) {
                case 'Monthly Costs':
                    const monthlyMatch = valueText.match(/¥?([\d,]+)/);
                    if (monthlyMatch) {
                        apartment.pricing.totalMonthlyCost = parseInt(monthlyMatch[1].replace(/,/g, ''));
                        // If no separate rent listed, monthly cost is the rent
                        if (apartment.pricing.monthlyRent === 0) {
                            apartment.pricing.monthlyRent = apartment.pricing.totalMonthlyCost;
                        }
                    }
                    break;
                    
                case 'Size':
                    const sizeMatch = valueText.match(/([\d.]+)\s*m²/);
                    if (sizeMatch) {
                        apartment.size = parseFloat(sizeMatch[1]);
                    }
                    break;
                    
                case 'Deposit':
                    const depositMatch = valueText.match(/¥?([\d,]+)/);
                    if (depositMatch) {
                        apartment.pricing.deposit = parseInt(depositMatch[1].replace(/,/g, ''));
                    }
                    break;
                    
                case 'Key Money':
                    const keyMatch = valueText.match(/¥?([\d,]+)/);
                    if (keyMatch) {
                        apartment.pricing.keyMoney = parseInt(keyMatch[1].replace(/,/g, ''));
                    }
                    break;
                    
                case 'Floor':
                    apartment.floor = valueText;
                    // Try to extract current floor and total floors
                    const floorMatch = valueText.match(/(\d+)\s*\/\s*(\d+)/);
                    if (floorMatch) {
                        apartment.floor = floorMatch[1];
                        apartment.totalFloors = floorMatch[2];
                    }
                    break;
                    
                case 'Year Built':
                    const yearMatch = valueText.match(/(\d{4})/);
                    if (yearMatch) {
                        apartment.yearBuilt = parseInt(yearMatch[1]);
                        apartment.buildingAge = new Date().getFullYear() - apartment.yearBuilt;
                    }
                    break;
                    
                case 'Nearest Station':
                    apartment.station = parseStationInfo(valueText);
                    break;
                    
                case 'Available From':
                    apartment.availableFrom = valueText;
                    break;
                    
                case 'Management Fee':
                    const mgmtMatch = valueText.match(/¥?([\d,]+)/);
                    if (mgmtMatch) {
                        apartment.pricing.managementFee = parseInt(mgmtMatch[1].replace(/,/g, ''));
                    }
                    break;
            }
        });
        
        // Calculate monthly rent if we have total cost and management fee
        if (apartment.pricing.totalMonthlyCost > 0 && apartment.pricing.managementFee > 0) {
            apartment.pricing.monthlyRent = apartment.pricing.totalMonthlyCost - apartment.pricing.managementFee;
        }
        
        // Get image
        const imageElement = element.querySelector('.listing-image');
        if (imageElement) {
            apartment.imageUrl = imageElement.getAttribute('src');
        }
        
        // Get agency logo
        const logoElement = element.querySelector('.listing-logo img');
        if (logoElement) {
            apartment.agencyLogo = logoElement.getAttribute('src');
        }
        
        // Get features
        const featureElements = element.querySelectorAll('.feature-item, .amenity, .facility');
        featureElements.forEach(feat => {
            const feature = feat.textContent.trim();
            if (feature && !apartment.features.includes(feature)) {
                apartment.features.push(feature);
            }
        });
        
    } catch (error) {
        console.error('Parse error:', error);
    }
    
    return apartment;
}

// Extract apartments from page
function extractApartments(html) {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    const listings = document.querySelectorAll('.property-listing');
    console.log(`🏠 Found ${listings.length} listings`);
    
    const apartments = [];
    listings.forEach(listing => {
        const apartment = parseApartment(listing);
        if (apartment.id) {
            apartments.push(apartment);
        }
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
        nextPageUrl: null
    };
    
    try {
        const urlObj = new URL(currentUrl);
        info.currentPage = parseInt(urlObj.searchParams.get('page') || '1');
        
        // Look for results count
        const bodyText = document.body.textContent;
        const resultsMatch = bodyText.match(/(\d+)\s*-\s*(\d+)\s+of\s+(\d+)/);
        if (resultsMatch) {
            const showingFrom = parseInt(resultsMatch[1]);
            const showingTo = parseInt(resultsMatch[2]);
            info.totalResults = parseInt(resultsMatch[3]);
            
            const perPage = showingTo - showingFrom + 1;
            info.totalPages = Math.ceil(info.totalResults / perPage);
            info.hasNextPage = showingTo < info.totalResults;
            
            if (info.hasNextPage) {
                urlObj.searchParams.set('page', info.currentPage + 1);
                info.nextPageUrl = urlObj.toString();
            }
        }
        
        // Alternative: Look for next page link
        if (!info.nextPageUrl) {
            const nextLink = document.querySelector('a[rel="next"], .pagination .next:not(.disabled)');
            if (nextLink) {
                const href = nextLink.getAttribute('href');
                if (href) {
                    info.hasNextPage = true;
                    info.nextPageUrl = href.startsWith('http') ? href : `https://realestate.co.jp${href}`;
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
    
    console.log('🏠 Realestate.co.jp Apartment Scraper (Final Version)');
    console.log('===================================================\n');
    
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
                console.log(`📊 Showing page ${pagination.currentPage} of ${pagination.totalPages} (${pagination.totalResults} total)`);
            }
            
            if (apartments.length === 0) {
                console.log('⚠️  No apartments found, stopping');
                break;
            }
            
            allApartments.push(...apartments);
            
            // Show sample
            if (apartments.length > 0) {
                const sample = apartments[0];
                console.log(`📍 Sample: ${sample.layout} ${sample.propertyType} in ${sample.location.area}, ${sample.location.ward}`);
                console.log(`   Price: ¥${sample.pricing.monthlyRent.toLocaleString()}/month, ${sample.size}m²`);
                console.log(`   Station: ${sample.station.name} (${sample.station.walkingMinutes} min walk)`);
            }
            
            // Save intermediate results
            if (pageCount % saveEvery === 0) {
                const tempFile = path.join(OUTPUT_DIR, `temp_${pageCount}pages.json`);
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
        const outputFile = path.join(OUTPUT_DIR, `apartments_${timestamp}.json`);
        
        const output = {
            metadata: {
                searchUrl: startUrl,
                totalApartments: allApartments.length,
                pagesScraped: pageCount,
                scrapedAt: new Date().toISOString(),
                executionTime: ((Date.now() - startTime) / 1000).toFixed(2) + 's'
            },
            apartments: allApartments
        };
        
        fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
        
        // Create detailed summary
        const summary = createDetailedSummary(output);
        const summaryFile = path.join(OUTPUT_DIR, `summary_${timestamp}.txt`);
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
            const errorFile = path.join(OUTPUT_DIR, `error_${Date.now()}.json`);
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

// Create detailed summary
function createDetailedSummary(data) {
    const apts = data.apartments;
    
    if (apts.length === 0) {
        return 'No apartments found';
    }
    
    // Price statistics
    const prices = apts.map(a => a.pricing.monthlyRent).filter(p => p > 0);
    const priceStats = {
        min: Math.min(...prices),
        max: Math.max(...prices),
        avg: prices.reduce((sum, p) => sum + p, 0) / prices.length
    };
    
    // Size statistics
    const sizes = apts.map(a => a.size).filter(s => s > 0);
    const sizeStats = {
        min: Math.min(...sizes),
        max: Math.max(...sizes),
        avg: sizes.reduce((sum, s) => sum + s, 0) / sizes.length
    };
    
    // Layout distribution
    const layoutCounts = {};
    apts.forEach(apt => {
        if (apt.layout) {
            layoutCounts[apt.layout] = (layoutCounts[apt.layout] || 0) + 1;
        }
    });
    
    // Ward distribution
    const wardCounts = {};
    apts.forEach(apt => {
        if (apt.location.ward) {
            wardCounts[apt.location.ward] = (wardCounts[apt.location.ward] || 0) + 1;
        }
    });
    
    // Area distribution
    const areaCounts = {};
    apts.forEach(apt => {
        if (apt.location.area) {
            areaCounts[apt.location.area] = (areaCounts[apt.location.area] || 0) + 1;
        }
    });
    
    // Station distribution
    const stationCounts = {};
    apts.forEach(apt => {
        if (apt.station.name) {
            stationCounts[apt.station.name] = (stationCounts[apt.station.name] || 0) + 1;
        }
    });
    
    // Property type distribution
    const propertyTypeCounts = {};
    apts.forEach(apt => {
        propertyTypeCounts[apt.propertyType] = (propertyTypeCounts[apt.propertyType] || 0) + 1;
    });
    
    // Walking time statistics
    const walkingTimes = apts.map(a => a.station.walkingMinutes).filter(t => t > 0);
    const avgWalkTime = walkingTimes.reduce((sum, t) => sum + t, 0) / walkingTimes.length;
    
    return `Realestate.co.jp Apartment Analysis Report
=========================================

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

Property Types
--------------
${Object.entries(propertyTypeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `${type}: ${count} (${(count/apts.length*100).toFixed(1)}%)`)
    .join('\n')}

Layout Distribution
-------------------
${Object.entries(layoutCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([layout, count]) => `${layout}: ${count} properties (${(count/apts.length*100).toFixed(1)}%)`)
    .join('\n')}

Ward Distribution (Top 10)
--------------------------
${Object.entries(wardCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ward, count]) => `${ward}: ${count} properties`)
    .join('\n')}

Popular Areas (Top 15)
----------------------
${Object.entries(areaCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([area, count]) => `${area}: ${count} properties`)
    .join('\n')}

Station Accessibility
--------------------
Average Walking Time: ${avgWalkTime.toFixed(1)} minutes

Popular Stations (Top 10)
-------------------------
${Object.entries(stationCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([station, count]) => `${station}: ${count} properties`)
    .join('\n')}

Sample Listings
---------------
${apts.slice(0, 5).map((apt, i) => `
${i+1}. ${apt.layout} ${apt.propertyType} in ${apt.location.area}, ${apt.location.ward}
   
   Pricing:
   - Monthly Rent: ¥${apt.pricing.monthlyRent.toLocaleString()}
   - Deposit: ¥${apt.pricing.deposit.toLocaleString()}
   - Key Money: ¥${apt.pricing.keyMoney.toLocaleString()}
   ${apt.pricing.managementFee ? `- Management Fee: ¥${apt.pricing.managementFee.toLocaleString()}` : ''}
   
   Details:
   - Size: ${apt.size}m²
   - Floor: ${apt.floor}${apt.totalFloors ? ` of ${apt.totalFloors}F` : ''}
   ${apt.yearBuilt ? `- Built: ${apt.yearBuilt} (${apt.buildingAge} years old)` : ''}
   
   Location:
   - Area: ${apt.location.area}
   - Ward: ${apt.location.ward}${apt.location.wardJa ? ` (${apt.location.wardJa})` : ''}
   - Station: ${apt.station.name} (${apt.station.walkingMinutes} min walk)
   ${apt.station.trainLines.length > 0 ? `- Lines: ${apt.station.trainLines.join(', ')}` : ''}
   
   Availability: ${apt.availableFrom || 'Immediate'}
   
   URL: ${apt.url}
`).join('\n---\n')}

Data Quality Notes
------------------
- Properties with valid price data: ${prices.length} (${(prices.length/apts.length*100).toFixed(1)}%)
- Properties with valid size data: ${sizes.length} (${(sizes.length/apts.length*100).toFixed(1)}%)
- Properties with station data: ${walkingTimes.length} (${(walkingTimes.length/apts.length*100).toFixed(1)}%)
- Properties with ward data: ${Object.values(wardCounts).reduce((a,b) => a+b, 0)} (${(Object.values(wardCounts).reduce((a,b) => a+b, 0)/apts.length*100).toFixed(1)}%)

Generated by Realestate.co.jp Scraper v2.0`;
}

// CLI
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('Usage: node scrape_realestate_final.js <search_url> [options]');
        console.log('\nOptions:');
        console.log('  --max-pages <n>   Maximum pages to scrape (default: 100)');
        console.log('  --save-every <n>  Save intermediate results every n pages (default: 5)');
        console.log('\nExample:');
        console.log('node scrape_realestate_final.js "https://realestate.co.jp/en/rent?prefecture=JP-13&max_price=160000&page=1" --max-pages 5');
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