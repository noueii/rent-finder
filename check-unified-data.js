const fs = require('fs');

const data = JSON.parse(fs.readFileSync('apt-dict-builder/unified_apartments_2025-07-15T14-05-25-173Z.json', 'utf8'));

console.log('Total apartments:', data.apartments.length);

// Count by source
const sourceCount = {};
const sampleApartments = { 'realestate.co.jp': null, 'yolo-home.com': null };

data.apartments.forEach((apt, index) => {
  sourceCount[apt.source] = (sourceCount[apt.source] || 0) + 1;
  
  // Get sample apartments
  if (!sampleApartments[apt.source] && (apt.source === 'realestate.co.jp' || apt.source === 'yolo-home.com')) {
    sampleApartments[apt.source] = { index, apartment: apt };
  }
});

console.log('\nApartments by source:', sourceCount);

// Show sample apartment structure
console.log('\n=== Sample realestate.co.jp apartment ===');
if (sampleApartments['realestate.co.jp']) {
  const apt = sampleApartments['realestate.co.jp'].apartment;
  console.log('Index:', sampleApartments['realestate.co.jp'].index);
  console.log('ID:', apt.id);
  console.log('Source:', apt.source);
  console.log('Stations:', apt.stations?.slice(0, 2));
}

console.log('\n=== Sample yolo-home.com apartment ===');
if (sampleApartments['yolo-home.com']) {
  const apt = sampleApartments['yolo-home.com'].apartment;
  console.log('Index:', sampleApartments['yolo-home.com'].index);
  console.log('ID:', apt.id);
  console.log('Source:', apt.source);
  console.log('Stations:', apt.stations?.slice(0, 2));
}