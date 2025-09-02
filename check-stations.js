const fs = require('fs');

const data = JSON.parse(fs.readFileSync('apt-dict-builder/unified_apartments_2025-07-15T14-05-25-173Z.json', 'utf8'));

let withStations = 0;
let withoutStations = 0;
let sampleWithStation = null;

// Check first 1000 apartments
for (let i = 0; i < Math.min(1000, data.apartments.length); i++) {
  const apt = data.apartments[i];
  if (apt.stations && apt.stations.length > 0) {
    withStations++;
    if (!sampleWithStation) {
      sampleWithStation = apt;
    }
  } else {
    withoutStations++;
  }
}

console.log(`Apartments with stations: ${withStations}`);
console.log(`Apartments without stations: ${withoutStations}`);

if (sampleWithStation) {
  console.log('\nSample apartment with stations:');
  console.log('ID:', sampleWithStation.id);
  console.log('Source:', sampleWithStation.source);
  console.log('Stations:', JSON.stringify(sampleWithStation.stations, null, 2));
}