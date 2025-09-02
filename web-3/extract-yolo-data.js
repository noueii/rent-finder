// Extract and parse the window.__NUXT__ data from the Yolo Japan HTML file
import fs from 'fs';

const html = fs.readFileSync('/home/noueii/workspace/github.com/noueii/rent-finder/web-3/debug/html-responses/yolo-japan/yolo-japan_2025-07-19T11-55-03-379Z__en_property_1467713.html', 'utf8');

// Find the window.__NUXT__ part
const match = html.match(/window\.__NUXT__=\((.*?)\)\(.*?\)<\/script>/s);

if (match) {
  // Extract the function body
  const funcBody = match[1];
  
  // Try to find the actual data (this is a minified function)
  console.log('Found NUXT data function, searching for property data...');
  
  // Look for specific patterns in the HTML
  const patterns = {
    images: html.match(/https:\/\/uploads\.home\.yolo-japan\.com\/images\/properties\/media\/[^"]+/g),
    fees: html.match(/Security deposit.*?yen|Key money.*?yen|deposit.*?\d+|key_money.*?\d+/gi),
    coordinates: html.match(/latitude.*?:.*?[\d.-]+|longitude.*?:.*?[\d.-]+|lat.*?:.*?[\d.-]+|lng.*?:.*?[\d.-]+/gi),
    stations: html.match(/station.*?walk.*?\d+\s*min|駅.*?徒歩.*?\d+分/gi)
  };
  
  console.log('\n=== EXTRACTED DATA ===\n');
  
  if (patterns.images) {
    console.log('IMAGES FOUND:');
    const uniqueImages = [...new Set(patterns.images)];
    uniqueImages.forEach((img, i) => console.log(`  ${i + 1}. ${img}`));
  }
  
  if (patterns.fees) {
    console.log('\nFEES FOUND:');
    patterns.fees.forEach(fee => console.log(`  - ${fee}`));
  }
  
  if (patterns.coordinates) {
    console.log('\nCOORDINATES FOUND:');
    patterns.coordinates.forEach(coord => console.log(`  - ${coord}`));
  }
  
  if (patterns.stations) {
    console.log('\nSTATIONS FOUND:');
    patterns.stations.forEach(station => console.log(`  - ${station}`));
  }
  
  // Look for the property ID
  const propertyId = html.match(/property.*?1467713|1467713/g);
  if (propertyId) {
    console.log('\nPROPERTY ID:', '1467713');
  }
  
} else {
  console.log('Could not find window.__NUXT__ data');
}