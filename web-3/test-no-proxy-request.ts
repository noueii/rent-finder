import axios from 'axios';

async function testNoProxyRequest() {
  console.log('🔍 Testing Direct Request WITHOUT Proxy');
  console.log('=======================================\n');
  
  const targetUrl = 'https://wagaya-japan.com/en/rent/tokyo/list/?sort=0&room_kei=0&upperprice=200000&heibeimin=20';
  
  console.log(`Target: ${targetUrl}\n`);
  
  try {
    console.log('Making direct request...');
    const startTime = Date.now();
    
    const response = await axios.get(targetUrl, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Referer': 'https://wagaya-japan.com/en/'
      },
      maxRedirects: 5,
      validateStatus: function (status) {
        return status >= 200 && status < 400;
      }
    });
    
    const responseTime = Date.now() - startTime;
    
    console.log(`\n✅ SUCCESS!`);
    console.log(`Response time: ${responseTime}ms`);
    console.log(`Status: ${response.status}`);
    console.log(`Content length: ${response.data.length} characters`);
    console.log(`Content type: ${response.headers['content-type']}`);
    
    // Check if we got the right content
    const hasApartments = response.data.includes('estateDataFromPHP') || response.data.includes('property-list');
    console.log(`Contains apartment data: ${hasApartments ? 'YES' : 'NO'}`);
    
  } catch (error) {
    console.log(`\n❌ FAILED!`);
    console.log(`Error: ${error.message}`);
    if (error.code) {
      console.log(`Error code: ${error.code}`);
    }
  }
}

testNoProxyRequest().catch(console.error);