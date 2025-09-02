#!/usr/bin/env node

/**
 * Fixed scraper for realestate.co.jp with correct selectors
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

// Parse single apartment
function parseApartment(element) {
    const apartment = {
        id: null,
        url: null,
        title: '',
        layout: '',
        location: '',
        district: '',
        city: '',
        monthlyCost: 0,
        deposit: 0,
        keyMoney: 0,
        managementFee: 0,
        size: 0,
        floor: '',
        yearBuilt: null,
        nearestStation: '',
        walkingMinutes: 0,
        availableFrom: '',
        imageUrl: '',
        features: []
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
        
        // Get title and location
        const titleElement = element.querySelector('.listing-title');
        if (titleElement) {
            // Get apartment type
            const titleLink = titleElement.querySelector('.text-semi-strong');
            if (titleLink) {
                apartment.title = titleLink.textContent.trim();
                const layoutMatch = apartment.title.match(/^([1-9][A-Z]*)/);
                if (layoutMatch) {
                    apartment.layout = layoutMatch[1];
                }
            }
            
            // Get location
            const locationText = titleElement.textContent.replace(apartment.title, '').trim();
            const locationMatch = locationText.match(/in\s+([^,\n]+)(?:[,\n]\s*([^,\n]+))?(?:[,\n]\s*([^,\n]+))?/);
            if (locationMatch) {
                apartment.location = locationMatch[1]?.trim() || '';
                apartment.district = locationMatch[2]?.trim() || '';
                apartment.city = locationMatch[3]?.trim() || 'Tokyo';
            }
        }
        
        // Get all listing items
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
                        apartment.monthlyCost = parseInt(monthlyMatch[1].replace(/,/g, ''));
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
                        apartment.deposit = parseInt(depositMatch[1].replace(/,/g, ''));
                    }
                    break;
                    
                case 'Key Money':
                    const keyMatch = valueText.match(/¥?([\d,]+)/);
                    if (keyMatch) {
                        apartment.keyMoney = parseInt(keyMatch[1].replace(/,/g, ''));
                    }
                    break;
                    
                case 'Floor':
                    apartment.floor = valueText;
                    break;
                    
                case 'Year Built':
                    const yearMatch = valueText.match(/(\d{4})/);
                    if (yearMatch) {
                        apartment.yearBuilt = parseInt(yearMatch[1]);
                    }
                    break;
                    
                case 'Nearest Station':
                    const stationMatch = valueText.match(/([^(]+)\s*\((\d+)\s*min/);
                    if (stationMatch) {
                        apartment.nearestStation = stationMatch[1].trim();
                        apartment.walkingMinutes = parseInt(stationMatch[2]);
                    } else {
                        apartment.nearestStation = valueText;
                    }
                    break;
                    
                case 'Available From':
                    apartment.availableFrom = valueText;
                    break;
            }
        });
        
        // Get image
        const imageElement = element.querySelector('.listing-image');
        if (imageElement) {
            apartment.imageUrl = imageElement.getAttribute('src');
        }
        
        // Get features if any
        const featureElements = element.querySelectorAll('.feature-item, .amenity');
        featureElements.forEach(feat => {
            const feature = feat.textContent.trim();
            if (feature) apartment.features.push(feature);
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
        // Get current page from URL
        const urlObj = new URL(currentUrl);
        info.currentPage = parseInt(urlObj.searchParams.get('page') || '1');
        
        // Look for results count (e.g., "1-20 of 150")
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
    
    console.log('🏠 Realestate.co.jp Apartment Scraper');
    console.log('====================================\n');
    
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
                console.log(`📍 Sample: ${sample.layout} in ${sample.location}, ¥${sample.monthlyCost.toLocaleString()}/month, ${sample.size}m²`);
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
        
        // Create summary
        const summary = createSummary(output);
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

// Create summary
function createSummary(data) {
    const apts = data.apartments;
    
    if (apts.length === 0) {
        return 'No apartments found';
    }
    
    const priceStats = {
        min: Math.min(...apts.map(a => a.monthlyCost).filter(p => p > 0)),
        max: Math.max(...apts.map(a => a.monthlyCost).filter(p => p > 0)),
        avg: apts.reduce((sum, a) => sum + a.monthlyCost, 0) / apts.filter(a => a.monthlyCost > 0).length
    };
    
    const sizeStats = {
        min: Math.min(...apts.map(a => a.size).filter(s => s > 0)),
        max: Math.max(...apts.map(a => a.size).filter(s => s > 0)),
        avg: apts.reduce((sum, a) => sum + a.size, 0) / apts.filter(a => a.size > 0).length
    };
    
    const layoutCounts = {};
    const districtCounts = {};
    const stationCounts = {};
    
    apts.forEach(apt => {
        if (apt.layout) layoutCounts[apt.layout] = (layoutCounts[apt.layout] || 0) + 1;
        if (apt.district) districtCounts[apt.district] = (districtCounts[apt.district] || 0) + 1;
        if (apt.nearestStation) stationCounts[apt.nearestStation] = (stationCounts[apt.nearestStation] || 0) + 1;
    });
    
    const avgWalkTime = apts.reduce((sum, a) => sum + a.walkingMinutes, 0) / apts.filter(a => a.walkingMinutes > 0).length;
    
    return `Realestate.co.jp Scraping Summary
=================================

Search URL: ${data.metadata.searchUrl}
Scraped At: ${data.metadata.scrapedAt}
Execution Time: ${data.metadata.executionTime}

Total Apartments: ${apts.length}
Pages Scraped: ${data.metadata.pagesScraped}

Price Statistics:
  Min: ¥${priceStats.min.toLocaleString()}/month
  Max: ¥${priceStats.max.toLocaleString()}/month
  Avg: ¥${Math.round(priceStats.avg).toLocaleString()}/month

Size Statistics:
  Min: ${sizeStats.min.toFixed(1)}m²
  Max: ${sizeStats.max.toFixed(1)}m²
  Avg: ${sizeStats.avg.toFixed(1)}m²

Average Walking Time: ${avgWalkTime.toFixed(1)} minutes

Layout Distribution:
${Object.entries(layoutCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([layout, count]) => `  ${layout}: ${count} (${(count/apts.length*100).toFixed(1)}%)`)
    .join('\n')}

Top Districts:
${Object.entries(districtCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([district, count]) => `  ${district}: ${count}`)
    .join('\n')}

Top Stations:
${Object.entries(stationCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([station, count]) => `  ${station}: ${count}`)
    .join('\n')}

Sample Listings:
${apts.slice(0, 5).map((apt, i) => `
${i+1}. ${apt.title} in ${apt.location}
   Price: ¥${apt.monthlyCost.toLocaleString()}/month (¥${apt.deposit.toLocaleString()} deposit)
   Size: ${apt.size}m² | Floor: ${apt.floor}
   Station: ${apt.nearestStation} (${apt.walkingMinutes} min walk)
   Available: ${apt.availableFrom}
   URL: ${apt.url}
`).join('')}`;
}

// CLI
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('Usage: node scrape_realestate_fixed.js <search_url> [options]');
        console.log('\nOptions:');
        console.log('  --max-pages <n>   Maximum pages to scrape (default: 100)');
        console.log('  --save-every <n>  Save intermediate results every n pages (default: 5)');
        console.log('\nExample:');
        console.log('node scrape_realestate_fixed.js "https://realestate.co.jp/en/rent?prefecture=JP-13&max_price=160000&page=1" --max-pages 5');
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