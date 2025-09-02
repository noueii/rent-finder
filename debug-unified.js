const fs = require('fs');

try {
  const data = JSON.parse(fs.readFileSync('apt-dict-builder/unified_apartments_2025-07-15T14-05-25-173Z.json', 'utf8'));
  
  console.log('File structure:');
  console.log('Keys:', Object.keys(data));
  
  if (data.apartments && data.apartments.length > 0) {
    console.log('\nFirst apartment:');
    console.log(JSON.stringify(data.apartments[0], null, 2));
    
    // Find a realestate apartment
    const realEstateApt = data.apartments.find(apt => apt.source === 'realestate.co.jp');
    if (realEstateApt) {
      console.log('\nSample realestate.co.jp apartment:');
      console.log(JSON.stringify(realEstateApt, null, 2));
    }
  }
} catch (error) {
  console.error('Error:', error.message);
}