#!/usr/bin/env node

/**
 * Simple, robust scraper for realestate.co.jp
 * Focuses on reliability over features
 */

const fs = require('fs');
const path = require('path');

// Configuration
const RATE_LIMIT_MS = 3000;
const OUTPUT_DIR = path.join(__dirname, 'scraped_apartments');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Simple fetch wrapper without JSDOM
async function fetchPageSimple(url) {
    console.log(`🌐 Fetching: ${url}`);
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const html = await response.text();
        console.log(`✅ Received ${html.length} bytes`);
        
        // Save the HTML for debugging
        const debugFile = path.join(OUTPUT_DIR, `page_${Date.now()}.html`);
        fs.writeFileSync(debugFile, html, 'utf8');
        console.log(`💾 Saved HTML to: ${debugFile}`);
        
        return html;
        
    } catch (error) {
        console.error(`❌ Fetch error: ${error.message}`);
        throw error;
    }
}

// Extract apartments using regex (more reliable than JSDOM for some sites)
function extractApartmentsSimple(html) {
    console.log('🔍 Extracting apartments from HTML...');
    
    const apartments = [];
    
    // Look for common patterns in realestate.co.jp HTML
    // This is a simple regex approach that's less likely to crash
    
    // Pattern 1: Look for links to property views
    const linkPattern = /href="\/en\/rent\/view\/(\d+)"/g;
    const links = [];
    let match;
    
    while ((match = linkPattern.exec(html)) !== null) {
        links.push({
            id: match[1],
            url: `https://realestate.co.jp/en/rent/view/${match[1]}`
        });
    }
    
    console.log(`📎 Found ${links.length} property links`);
    
    // Pattern 2: Extract prices (look for yen symbol)
    const pricePattern = /([0-9,]+)\s*円|¥\s*([0-9,]+)/g;
    const prices = [];
    
    while ((match = pricePattern.exec(html)) !== null) {
        const price = parseInt((match[1] || match[2]).replace(/,/g, ''));
        if (price > 10000 && price < 1000000) { // Reasonable rent range
            prices.push(price);
        }
    }
    
    console.log(`💰 Found ${prices.length} prices`);
    
    // Pattern 3: Extract sizes
    const sizePattern = /([0-9.]+)\s*m²/g;
    const sizes = [];
    
    while ((match = sizePattern.exec(html)) !== null) {
        const size = parseFloat(match[1]);
        if (size > 10 && size < 200) { // Reasonable apartment size
            sizes.push(size);
        }
    }
    
    console.log(`📏 Found ${sizes.length} sizes`);
    
    // Combine data (simple approach - may not be perfectly matched)
    const count = Math.min(links.length, prices.length, sizes.length);
    
    for (let i = 0; i < count; i++) {
        apartments.push({
            id: `apt_${links[i].id}`,
            url: links[i].url,
            price: prices[i] || 0,
            size: sizes[i] || 0,
            pricePerSqm: prices[i] && sizes[i] ? Math.round(prices[i] / sizes[i]) : 0,
            scrapedAt: new Date().toISOString()
        });
    }
    
    return apartments;
}

// Check if there's a next page
function hasNextPage(html, currentPage) {
    // Look for next page indicators
    const nextPagePattern = new RegExp(`page=${currentPage + 1}|ページ${currentPage + 1}|Next|次へ`, 'i');
    return nextPagePattern.test(html);
}

// Main scraping function
async function scrapeWithSimpleApproach(baseUrl) {
    console.log('🏠 Simple Scraper for realestate.co.jp');
    console.log('=====================================\n');
    
    const allApartments = [];
    let currentPage = 1;
    let continueScaping = true;
    
    // Parse base URL
    const urlObj = new URL(baseUrl);
    
    try {
        while (continueScaping && currentPage <= 100) { // Max 100 pages as safety
            // Build URL for current page
            urlObj.searchParams.set('page', currentPage);
            const pageUrl = urlObj.toString();
            
            console.log(`\n📄 Page ${currentPage}`);
            console.log('------------------------');
            
            // Wait between requests
            if (currentPage > 1) {
                console.log(`⏳ Waiting ${RATE_LIMIT_MS}ms...`);
                await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
            }
            
            // Fetch page
            const html = await fetchPageSimple(pageUrl);
            
            // Extract apartments
            const apartments = extractApartmentsSimple(html);
            console.log(`🏠 Found ${apartments.length} apartments on this page`);
            
            if (apartments.length === 0) {
                console.log('⚠️  No apartments found, stopping');
                continueScaping = false;
            } else {
                allApartments.push(...apartments);
                
                // Check for next page
                if (!hasNextPage(html, currentPage)) {
                    console.log('📍 No next page found, stopping');
                    continueScaping = false;
                }
            }
            
            currentPage++;
            
            // Save intermediate results
            if (allApartments.length > 0 && allApartments.length % 50 === 0) {
                const tempFile = path.join(OUTPUT_DIR, `apartments_temp_${Date.now()}.json`);
                fs.writeFileSync(tempFile, JSON.stringify({
                    count: allApartments.length,
                    apartments: allApartments
                }, null, 2), 'utf8');
                console.log(`💾 Saved ${allApartments.length} apartments (intermediate)`);
            }
        }
        
        // Save final results
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputFile = path.join(OUTPUT_DIR, `apartments_final_${timestamp}.json`);
        
        const output = {
            metadata: {
                searchUrl: baseUrl,
                totalApartments: allApartments.length,
                pagesScraped: currentPage - 1,
                scrapedAt: new Date().toISOString()
            },
            apartments: allApartments
        };
        
        fs.writeFileSync(outputFile, JSON.stringify(output, null, 2), 'utf8');
        
        console.log('\n✅ Scraping Complete!');
        console.log('====================');
        console.log(`Total apartments: ${allApartments.length}`);
        console.log(`Pages scraped: ${currentPage - 1}`);
        console.log(`Output saved to: ${outputFile}`);
        
        // Show sample
        if (allApartments.length > 0) {
            console.log('\nSample results:');
            allApartments.slice(0, 3).forEach((apt, i) => {
                console.log(`${i + 1}. ID: ${apt.id}, Price: ¥${apt.price.toLocaleString()}, Size: ${apt.size}m²`);
            });
        }
        
        return output;
        
    } catch (error) {
        console.error('\n💥 Error:', error.message);
        
        // Save what we have
        if (allApartments.length > 0) {
            const errorFile = path.join(OUTPUT_DIR, `apartments_error_${Date.now()}.json`);
            fs.writeFileSync(errorFile, JSON.stringify({
                error: error.message,
                apartments: allApartments
            }, null, 2), 'utf8');
            console.log(`💾 Saved ${allApartments.length} apartments before error`);
        }
        
        throw error;
    }
}

// Test with a simple fetch first
async function testFetch(url) {
    console.log('🧪 Testing simple fetch...\n');
    
    try {
        const html = await fetchPageSimple(url);
        
        // Check if we got real content
        if (html.includes('realestate.co.jp') || html.includes('property') || html.includes('rent')) {
            console.log('✅ Fetch successful, got real estate content');
            
            // Try to find some indicators
            const hasProperties = html.includes('/rent/view/');
            const hasPrices = html.includes('円') || html.includes('¥');
            const hasSizes = html.includes('m²');
            
            console.log(`Has property links: ${hasProperties}`);
            console.log(`Has prices: ${hasPrices}`);
            console.log(`Has sizes: ${hasSizes}`);
            
            return true;
        } else {
            console.log('⚠️  Got HTML but doesn\'t look like property listings');
            return false;
        }
    } catch (error) {
        console.error('❌ Test fetch failed:', error);
        return false;
    }
}

// Command line interface
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('Usage: node scrape_apartments_simple.js <search_url>');
        console.log('\nExample:');
        console.log('node scrape_apartments_simple.js "https://realestate.co.jp/en/rent?prefecture=JP-13&max_price=160000&min_meter=25&page=1"');
        process.exit(1);
    }
    
    const searchUrl = args[0];
    
    // First test if we can fetch
    testFetch(searchUrl).then(success => {
        if (success) {
            console.log('\n🚀 Starting full scrape...\n');
            return scrapeWithSimpleApproach(searchUrl);
        } else {
            console.error('\n❌ Cannot proceed with scraping');
            process.exit(1);
        }
    }).catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { scrapeWithSimpleApproach, testFetch };