import httpsProxyAgent from 'https-proxy-agent';
import httpProxyAgent from 'http-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import type { ProxyConfig } from '~/types/scraper';
import type { AxiosRequestConfig } from 'axios';

const { HttpsProxyAgent } = httpsProxyAgent;
const { HttpProxyAgent } = httpProxyAgent;

/**
 * Create appropriate proxy agents for axios based on the target URL and proxy config
 */
export function createProxyAgents(targetUrl: string, proxy: ProxyConfig): Partial<AxiosRequestConfig> {
  // Build proxy URL
  let proxyUrl: string;
  
  if (proxy.username && proxy.password) {
    proxyUrl = `${proxy.protocol || 'http'}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
  } else {
    proxyUrl = `${proxy.protocol || 'http'}://${proxy.host}:${proxy.port}`;
  }
  
  const isTargetHttps = targetUrl.startsWith('https://');
  
  // Handle SOCKS proxies
  if (proxy.protocol === 'socks5' || proxy.protocol === 'socks4') {
    const socksAgent = new SocksProxyAgent(proxyUrl);
    socksAgent.timeout = 10000; // 10 second timeout
    return {
      httpsAgent: socksAgent,
      httpAgent: socksAgent,
      proxy: false, // Disable axios's built-in proxy to use our agent
    };
  }
  
  // Handle HTTP/HTTPS proxies
  if (isTargetHttps) {
    // For HTTPS targets, use HttpsProxyAgent
    const httpsAgent = new HttpsProxyAgent(proxyUrl);
    // Set connection timeout
    httpsAgent.timeout = 10000; // 10 second timeout
    return {
      httpsAgent,
      proxy: false, // Disable axios's built-in proxy to use our agent
    };
  } else {
    // For HTTP targets, use HttpProxyAgent
    const httpAgent = new HttpProxyAgent(proxyUrl);
    // Set connection timeout
    httpAgent.timeout = 10000; // 10 second timeout
    return {
      httpAgent,
      proxy: false, // Disable axios's built-in proxy to use our agent
    };
  }
}

/**
 * Test if a proxy string is valid
 */
export function isValidProxyString(proxyString: string): boolean {
  // Check for host:port format
  const simpleFormat = /^[\d.]+:\d+$/;
  if (simpleFormat.test(proxyString)) {
    return true;
  }
  
  // Check for protocol://host:port format
  try {
    new URL(proxyString);
    return true;
  } catch {
    return false;
  }
}