// Metro Residences API Bookmarklet
// Save this as a bookmark to test the API from their website

javascript:(function(){
  const apiUrl = 'https://www.metroresidences.com/api/mbp/building';
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

  fetch(apiUrl, {
    method: 'POST',
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify(requestBody)
  })
  .then(r => r.json())
  .then(data => {
    const units = data.units || [];
    console.clear();
    console.log('%c🏠 Metro Residences API Test', 'font-size: 20px; color: blue;');
    console.log(`Found ${units.length} apartments`);
    console.table(units.slice(0, 5).map((/** @type {any} */ u) => ({
      Name: u.property_name.ms.en,
      Price: `¥${u.price.toLocaleString()}`,
      Size: `${u.layout.size.val}${u.layout.size.unit}`,
      Layout: u.layout.bedroomLabel,
      Area: u.location.district.en,
      Station: `${u.stations[0]?.name.en} (${u.stations[0]?.walkingTime.value}min)`
    })));
    console.log('Full response:', data);
  })
  .catch(err => {
    console.error('Error:', err);
    alert('API request failed. Check console for details.');
  });
})();