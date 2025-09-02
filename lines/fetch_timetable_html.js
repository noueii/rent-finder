const https = require('https');
const fs = require('fs');

const url = 'https://japantravel.navitime.com/en/area/jp/timetable/00006668/00000176/';

https.get(url, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    fs.writeFile('navitime_train_html.html', data, 'utf8', (err) => {
      if (err) {
        console.error('Error writing file:', err);
      } else {
        console.log('HTML saved to navitime_train_html.html');
        console.log(`File size: ${data.length} bytes`);
      }
    });
  });
}).on('error', (err) => {
  console.error('Error fetching URL:', err);
});