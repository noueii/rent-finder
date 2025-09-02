// Metro Residences API Browser Test
// Copy and paste this code into your browser's console

// API endpoint
const apiUrl = 'https://www.metroresidences.com/api/mbp/building';

// Request body
const requestBody = {
  price: "0,150000",
  size: "25,165",
  view: "grid-view",
  countryCode: "jp",
  languageCode: "en",
  distance: "2.5km",
  curPage: 1,
  perPage: 24
};

// Request headers
const headers = {
  "Content-Type": "application/json",
  "Accept": "application/json",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Origin": "https://www.metroresidences.com",
  "Referer": "https://www.metroresidences.com/jp-en/apartment-rental/",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin"
};

// Make the API request
fetch(apiUrl, {
  method: 'POST',
  headers: headers,
  body: JSON.stringify(requestBody)
})
.then(response => {
  console.log('Response Status:', response.status);
  console.log('Response Headers:', response.headers);
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
})
.then(data => {
  console.log('✅ API Response received!');
  console.log('Full Response:', data);
  
  // Extract units array
  const units = data.units || [];
  console.log(`\n📊 Found ${units.length} apartments`);
  
  // Display first 3 apartments
  console.log('\n🏠 First 3 apartments:');
  units.slice(0, 3).forEach((unit, index) => {
    console.log(`\n${index + 1}. ${unit.property_name.ms.en}`);
    console.log(`   Price: ¥${unit.price.toLocaleString()}`);
    console.log(`   Size: ${unit.layout.size.val} ${unit.layout.size.unit}`);
    console.log(`   Layout: ${unit.layout.bedroomLabel}`);
    console.log(`   Location: ${unit.location.district.en}, ${unit.location.city.en}`);
    console.log(`   Station: ${unit.stations[0]?.name.en} (${unit.stations[0]?.walkingTime.value} min walk)`);
    console.log(`   Floor: ${unit.floor}/${unit.stories}`);
    console.log(`   URL: https://www.metroresidences.com${unit.permalinks.en}`);
  });
  
  // Return data for further inspection
  return data;
})
.catch(error => {
  console.error('❌ Error:', error);
  console.error('This might be due to CORS if running from a different domain.');
  console.error('Try running this code from https://www.metroresidences.com website console.');
});

// Alternative: Using async/await syntax
async function testMetroResidencesAPI() {
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('API Response:', data);
    return data;
  } catch (error) {
    console.error('Error:', error);
  }
}

// Uncomment to run the async version
// testMetroResidencesAPI();