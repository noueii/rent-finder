#!/usr/bin/env node

/**
 * Debug script to test basic fetching from realestate.co.jp
 */

async function debugFetch() {
    const testUrl = 'https://realestate.co.jp/en/rent?prefecture=JP-13&city=13000&max_price=160000&min_meter=25&page=1';
    
    console.log('🔍 Debug Fetch Test');
    console.log('==================\n');
    console.log(`URL: ${testUrl}\n`);
    
    try {
        console.log('1️⃣ Testing basic fetch...');
        const response = await fetch(testUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        console.log(`   Status: ${response.status} ${response.statusText}`);
        console.log(`   Content-Type: ${response.headers.get('content-type')}`);
        console.log(`   Content-Length: ${response.headers.get('content-length')}`);
        
        if (!response.ok) {
            console.error('❌ Bad response status');
            return;
        }
        
        console.log('\n2️⃣ Getting response text...');
        const html = await response.text();
        console.log(`   Received ${html.length} characters`);
        
        console.log('\n3️⃣ Checking content...');
        
        // Check for common indicators
        const checks = [
            { name: 'HTML tag', pattern: /<html/i },
            { name: 'Title tag', pattern: /<title>/i },
            { name: 'Property links', pattern: /\/rent\/view\/\d+/g },
            { name: 'Price indicators', pattern: /円|¥|yen|price/i },
            { name: 'Size indicators', pattern: /m²|square|size/i },
            { name: 'Station info', pattern: /station|駅/i },
            { name: 'Pagination', pattern: /page=\d+/g },
            { name: 'JavaScript', pattern: /<script/i },
            { name: 'Cloudflare', pattern: /cloudflare/i },
            { name: 'Bot detection', pattern: /captcha|robot|bot/i }
        ];
        
        checks.forEach(check => {
            const found = check.pattern.test(html);
            const matches = html.match(check.pattern);
            const count = matches ? matches.length : 0;
            console.log(`   ${found ? '✅' : '❌'} ${check.name}: ${count > 0 ? `${count} matches` : 'Not found'}`);
        });
        
        console.log('\n4️⃣ Saving sample...');
        const fs = require('fs');
        const path = require('path');
        const debugDir = path.join(__dirname, 'debug_output');
        
        if (!fs.existsSync(debugDir)) {
            fs.mkdirSync(debugDir);
        }
        
        const debugFile = path.join(debugDir, 'sample_response.html');
        fs.writeFileSync(debugFile, html, 'utf8');
        console.log(`   Saved to: ${debugFile}`);
        
        // Extract first 500 characters of body content
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch) {
            console.log('\n5️⃣ Body preview:');
            console.log('   ' + bodyMatch[1].substring(0, 500).replace(/\s+/g, ' ').trim() + '...');
        }
        
        // Try to find apartment data patterns
        console.log('\n6️⃣ Looking for apartment patterns...');
        
        const propertyPattern = /href="\/en\/rent\/view\/(\d+)"[^>]*>([^<]+)</g;
        const properties = [];
        let propMatch;
        
        while ((propMatch = propertyPattern.exec(html)) !== null) {
            properties.push({
                id: propMatch[1],
                text: propMatch[2].trim()
            });
        }
        
        if (properties.length > 0) {
            console.log(`   Found ${properties.length} property links:`);
            properties.slice(0, 3).forEach(prop => {
                console.log(`   - ID: ${prop.id}, Text: ${prop.text}`);
            });
        } else {
            console.log('   No property links found with standard pattern');
        }
        
    } catch (error) {
        console.error('\n💥 Error:', error.message);
        if (error.cause) {
            console.error('   Cause:', error.cause);
        }
    }
}

// Run the debug
debugFetch();