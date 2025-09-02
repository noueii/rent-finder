#!/usr/bin/env node

/**
 * Test script to show all available user agent variants
 */

// Count unique browser versions
const browserVersions = 24; // From the code inspection
const languagePreferences = 12; // From the code inspection
const screenResolutions = 8; // From the code inspection

console.log('Wagaya Japan Scraper - Randomization Variants\n');
console.log('==============================================\n');

console.log('📊 Current Randomization Stats:');
console.log(`- Browser versions: ${browserVersions}`);
console.log(`  • Chrome: 11 versions (Windows: 5, Mac: 4, Linux: 2)`);
console.log(`  • Firefox: 5 versions (Windows: 3, Mac: 2)`);
console.log(`  • Safari: 3 versions (Mac only)`);
console.log(`  • Edge: 3 versions (Windows)`);
console.log(`  • Opera: 1 version (Windows)`);
console.log(`  • Brave: 1 version (Windows)`);
console.log(`\n- Language preferences: ${languagePreferences}`);
console.log(`  • English primary: 6 variants`);
console.log(`  • Japanese primary: 6 variants`);
console.log(`\n- Screen resolutions: ${screenResolutions}`);
console.log(`  • From 1280x720 to 2560x1440`);
console.log(`\n- Additional variations:`);
console.log(`  • Viewport headers: 50% chance (Chrome/Edge only)`);
console.log(`  • Rate limiting jitter: ±800ms`);
console.log(`  • Rotation interval: Every 5 minutes`);

console.log('\n📈 Total possible combinations:');
const totalCombinations = browserVersions * languagePreferences;
console.log(`- Base combinations: ${totalCombinations} (browser × language)`);
console.log(`- With viewport variations: ~${totalCombinations * 1.5} effective combinations`);

console.log('\n🔄 Randomization features:');
console.log('- User agent rotates every 5 minutes automatically');
console.log('- Language preference randomly selected per rotation');
console.log('- Request timing varies by ±800ms (1.7s to 3.3s between requests)');
console.log('- Headers include modern browser features (Sec-Ch-Ua, Sec-Fetch-*)');
console.log('- Random viewport width for Chrome/Edge browsers');

console.log('\n✅ Summary:');
console.log(`From 9 browsers → ${browserVersions} browser versions`);
console.log(`From 5 languages → ${languagePreferences} language variants`);
console.log(`From 45 combinations → ${totalCombinations}+ unique fingerprints`);
console.log('\nThis represents a ~6.4x increase in randomization!');