import axios from 'axios';
import httpsProxyAgent from 'https-proxy-agent';

const { HttpsProxyAgent } = httpsProxyAgent;

async function test() {
  console.log('🚀 SIMPLE TEST - RealEstate with HTTP proxy\n');
  
  const proxy = 'http://156.242.43.120:3129';
  const url = 'https://realestate.co.jp/en/rent/view/1254309';
  
  try {
    const agent = new HttpsProxyAgent(proxy);
    
    console.log('URL:', url);
    console.log('Proxy:', proxy);
    console.log('Fetching...\n');
    
    const { data, status } = await axios.get(url, {
      httpsAgent: agent,
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en,ja;q=0.9',
      }
    });
    
    console.log('✅ SUCCESS!');
    console.log('Status:', status);
    console.log('Size:', data.length, 'bytes');
    console.log('\nHTTP PROXIES WORK FOR REALESTATE! 🎉');
    
  } catch (err) {
    console.log('❌ FAILED:', err.message);
  }
}

test();