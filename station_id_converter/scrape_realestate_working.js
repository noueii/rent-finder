#!/usr/bin/env node

/**
 * Working scraper for realestate.co.jp based on actual HTML structure
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

// Fetch page with retries
async function fetchPage(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
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
            
        } catch (error) {
            console.error(`❌ Attempt ${i + 1} failed: ${error.message}`);
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
                throw error;
            }
        }
    }
}

// Parse apartment from listing element
function parseApartment(element) {
    try {
        const apartment = {
            id: null,
            url: null,
            title: '',
            location: '',
            district: '',
            city: '',
            price: 0,
            size: 0,
            layout: '',
            nearestStation: '',
            walkingMinutes: 0,
            deposit: '',
            keyMoney: '',
            managementFee: 0,
            availableFrom: '',
            imageUrl: '',
            agencyLogo: '',
            features: []
        };
        
        // Get property ID and URL
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
            const titleLink = titleElement.querySelector('a');
            if (titleLink) {
                const titleText = titleLink.querySelector('.text-semi-strong');
                if (titleText) {
                    apartment.title = titleText.textContent.trim();
                    
                    // Extract layout from title (e.g., "1K Apartment" -> "1K")
                    const layoutMatch = apartment.title.match(/^([1-9][A-Z]*)/);
                    if (layoutMatch) {
                        apartment.layout = layoutMatch[1];
                    }
                }
            }
            
            // Get location details
            const locationSpan = titleElement.querySelector('span:not(.text-semi-strong)');
            if (locationSpan) {
                const locationText = locationSpan.textContent;
                const locationParts = locationText.split(/[\n,]/).map(s => s.trim()).filter(s => s);
                
                if (locationParts.length > 0) apartment.location = locationParts[0];
                if (locationParts.length > 1) apartment.district = locationParts[1];
                if (locationParts.length > 2) apartment.city = locationParts[2];
            }
        }
        
        // Get price
        const priceElement = element.querySelector('.listing-price');
        if (priceElement) {
            const priceText = priceElement.textContent;
            const priceMatch = priceText.match(/¥?([\d,]+)/);
            if (priceMatch) {
                apartment.price = parseInt(priceMatch[1].replace(/,/g, ''));
            }
        }
        
        // Get size
        const sizeElement = element.querySelector('.listing-sqm');
        if (sizeElement) {
            const sizeText = sizeElement.textContent;
            const sizeMatch = sizeText.match(/([\d.]+)\s*m²/);
            if (sizeMatch) {
                apartment.size = parseFloat(sizeMatch[1]);
            }
        }
        
        // Get station info
        const stationElements = element.querySelectorAll('.listing-station');
        if (stationElements.length > 0) {
            const stationText = stationElements[0].textContent;
            const stationMatch = stationText.match(/([^,]+),?\s*(\d+)\s*min/);
            if (stationMatch) {
                apartment.nearestStation = stationMatch[1].trim();
                apartment.walkingMinutes = parseInt(stationMatch[2]);
            }
        }
        
        // Get fees
        const itemElements = element.querySelectorAll('.listing-item');
        itemElements.forEach(item => {
            const text = item.textContent;
            
            // Deposit
            if (text.includes('Deposit')) {
                const depositMatch = text.match(/¥?([\d,]+)/);
                if (depositMatch) {
                    apartment.deposit = depositMatch[1];
                }
            }
            
            // Key money
            if (text.includes('Key Money')) {
                const keyMatch = text.match(/¥?([\d,]+)/);
                if (keyMatch) {
                    apartment.keyMoney = keyMatch[1];
                }
            }
            
            // Management fee
            if (text.includes('Management')) {
                const mgmtMatch = text.match(/¥?([\d,]+)/);
                if (mgmtMatch) {
                    apartment.managementFee = parseInt(mgmtMatch[1].replace(/,/g, ''));
                }
            }
            
            // Available from
            if (text.includes('Available From')) {
                apartment.availableFrom = text.replace('Available From', '').trim();
            }
        });
        
        // Get images
        const mainImage = element.querySelector('.listing-image');
        if (mainImage) {
            apartment.imageUrl = mainImage.getAttribute('src');
        }
        
        const logoImage = element.querySelector('.listing-logo img');
        if (logoImage) {
            apartment.agencyLogo = logoImage.getAttribute('src');
        }
        
        return apartment;
        
    } catch (error) {
        console.error('Error parsing apartment:', error);
        return null;
    }
}

// Extract all apartments from page
function extractApartments(html) {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // Find all property listings
    const listings = document.querySelectorAll('.property-listing');
    console.log(`🏠 Found ${listings.length} property listings`);
    
    const apartments = [];
    listings.forEach((listing, index) => {
        const apartment = parseApartment(listing);
        if (apartment && apartment.id) {
            apartments.push(apartment);
        }
    });
    
    return apartments;
}

// Check for next page
function getNextPageUrl(html, currentUrl) {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // Look for pagination
    const currentUrlObj = new URL(currentUrl);
    const currentPage = parseInt(currentUrlObj.searchParams.get('page') || '1');
    
    // Method 1: Look for next page link
    const nextLink = document.querySelector('a[rel="next"], .pagination a.next');
    if (nextLink && !nextLink.classList.contains('disabled')) {
        const href = nextLink.getAttribute('href');
        if (href) {
            return href.startsWith('http') ? href : `https://realestate.co.jp${href}`;
        }
    }
    
    // Method 2: Check if there's a link to next page number
    const nextPageLink = document.querySelector(`a[href*="page=${currentPage + 1}"]`);
    if (nextPageLink) {
        currentUrlObj.searchParams.set('page', currentPage + 1);
        return currentUrlObj.toString();
    }
    
    // Method 3: Check results count
    const resultsText = document.body.textContent;
    const resultsMatch = resultsText.match(/(\d+)\s*-\s*(\d+)\s+of\s+(\d+)/);
    if (resultsMatch) {
        const showingTo = parseInt(resultsMatch[2]);
        const total = parseInt(resultsMatch[3]);
        if (showingTo < total) {
            currentUrlObj.searchParams.set('page', currentPage + 1);
            return currentUrlObj.toString();
        }
    }
    
    return null;
}

// Main scraping function
async function scrapeAllPages(startUrl, maxPages = 100) {
    console.log('🏠 Realestate.co.jp Scraper');
    console.log('===========================\n');
    
    const allApartments = [];
    let currentUrl = startUrl;
    let pageCount = 0;
    
    try {
        while (currentUrl && pageCount < maxPages) {
            pageCount++;
            console.log(`\n📄 Page ${pageCount}`);
            console.log(`URL: ${currentUrl}`);
            
            // Rate limiting
            if (pageCount > 1) {
                console.log(`⏳ Waiting ${RATE_LIMIT_MS}ms...`);
                await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
            }
            
            // Fetch page
            const html = await fetchPage(currentUrl);
            
            // Extract apartments
            const apartments = extractApartments(html);
            console.log(`✅ Extracted ${apartments.length} apartments`);
            
            if (apartments.length === 0) {
                console.log('⚠️  No apartments found, stopping');
                break;
            }
            
            allApartments.push(...apartments);
            
            // Show sample
            if (apartments.length > 0) {
                const sample = apartments[0];
                console.log(`Sample: ${sample.layout} in ${sample.location}, ¥${sample.price.toLocaleString()}`);
            }
            
            // Get next page
            const nextUrl = getNextPageUrl(html, currentUrl);
            if (nextUrl) {
                currentUrl = nextUrl;
            } else {
                console.log('📍 No more pages found');
                currentUrl = null;
            }
            
            // Save intermediate results
            if (pageCount % 5 === 0) {
                const tempFile = path.join(OUTPUT_DIR, `temp_${pageCount}_pages.json`);
                fs.writeFileSync(tempFile, JSON.stringify({
                    pages: pageCount,
                    apartments: allApartments
                }, null, 2));
                console.log(`💾 Saved ${allApartments.length} apartments (intermediate)`);
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
                scrapedAt: new Date().toISOString()
            },
            apartments: allApartments
        };
        
        fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
        
        // Create summary
        const summary = createSummary(allApartments);
        const summaryFile = path.join(OUTPUT_DIR, `summary_${timestamp}.txt`);
        fs.writeFileSync(summaryFile, summary);
        
        console.log('\n✅ Scraping Complete!');
        console.log('====================');
        console.log(`Total apartments: ${allApartments.length}`);
        console.log(`Pages scraped: ${pageCount}`);
        console.log(`Output: ${outputFile}`);
        console.log(`Summary: ${summaryFile}`);
        
        return output;
        
    } catch (error) {
        console.error('\n💥 Error:', error);
        
        // Save partial results
        if (allApartments.length > 0) {
            const errorFile = path.join(OUTPUT_DIR, `partial_${Date.now()}.json`);
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

// Create summary report
function createSummary(apartments) {
    const priceRange = {
        min: Math.min(...apartments.map(a => a.price).filter(p => p > 0)),
        max: Math.max(...apartments.map(a => a.price).filter(p => p > 0)),
        avg: apartments.reduce((sum, a) => sum + a.price, 0) / apartments.length
    };
    
    const sizeRange = {
        min: Math.min(...apartments.map(a => a.size).filter(s => s > 0)),
        max: Math.max(...apartments.map(a => a.size).filter(s => s > 0)),
        avg: apartments.reduce((sum, a) => sum + a.size, 0) / apartments.filter(a => a.size > 0).length
    };
    
    const layoutCounts = {};
    apartments.forEach(a => {
        if (a.layout) layoutCounts[a.layout] = (layoutCounts[a.layout] || 0) + 1;
    });
    
    const districtCounts = {};
    apartments.forEach(a => {
        if (a.district) districtCounts[a.district] = (districtCounts[a.district] || 0) + 1;
    });
    
    return `Realestate.co.jp Scraping Summary
=================================

Total Apartments: ${apartments.length}

Price Range:
  Min: ¥${priceRange.min.toLocaleString()}
  Max: ¥${priceRange.max.toLocaleString()}
  Avg: ¥${Math.round(priceRange.avg).toLocaleString()}

Size Range:
  Min: ${sizeRange.min}m²
  Max: ${sizeRange.max}m²
  Avg: ${sizeRange.avg.toFixed(1)}m²

Layouts:
${Object.entries(layoutCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([layout, count]) => `  ${layout}: ${count}`)
    .join('\n')}

Top Districts:
${Object.entries(districtCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([district, count]) => `  ${district}: ${count}`)
    .join('\n')}

Sample Listings:
${apartments.slice(0, 5).map((a, i) => `
${i + 1}. ${a.title} in ${a.location}
   Price: ¥${a.price.toLocaleString()} | Size: ${a.size}m²
   Station: ${a.nearestStation} (${a.walkingMinutes} min)
   URL: ${a.url}
`).join('')}`;
}

// CLI
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('Usage: node scrape_realestate_working.js <search_url> [max_pages]');
        console.log('\nExample:');
        console.log('node scrape_realestate_working.js "https://realestate.co.jp/en/rent?prefecture=JP-13&max_price=160000&page=1" 5');
        process.exit(1);
    }
    
    const searchUrl = args[0];
    const maxPages = args[1] ? parseInt(args[1]) : 100;
    
    scrapeAllPages(searchUrl, maxPages).catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { scrapeAllPages, extractApartments };