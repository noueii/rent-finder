
const fs = require('fs');

// Read your listings JSON file (replace 'input.json' with your filename)
const data = JSON.parse(fs.readFileSync('input.json', 'utf8'));

function extractListings(data) {
	const listings = [];
	data.properties.forEach(prop => {
		prop.rooms.forEach(room => {
			listings.push({
				building_name: prop.building_name,
				prefecture: prop.prefecture,
				city: prop.city,
				address: `${prop.address1} ${prop.address2}`,
				unit_number: room.unit_number,
				rent: room.rent,
				rawRent: room.rawRent,
				bedroom: room.bedroom,
				area_m2: room.area,
				area_ft2: room.area_ft2,
				station_name: prop.building_station?.station_name || "",
				station_distance_min: prop.building_station?.distance_in_minute || "",
				url: prop.room?.url || "",
				features: prop.room?.features || "",
			});
		});
	});
	return listings;
}

// Flatten the listings
const listings = extractListings(data);

// Write as JSON
fs.writeFileSync('listings.json', JSON.stringify(listings, null, 2));

// Convert to CSV
function toCSV(arr) {
	const keys = Object.keys(arr[0]);
	const lines = [keys.join(',')];
	for (const item of arr) {
		lines.push(keys.map(k => `"${(item[k] ?? '').toString().replace(/"/g, '""')}"`).join(','));
	}
	return lines.join('\n');
}

// Write as CSV
fs.writeFileSync('listings.csv', toCSV(listings));

console.log('Saved as listings.json and listings.csv!');
