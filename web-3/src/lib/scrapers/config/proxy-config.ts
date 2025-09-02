/**
 * Proxy configuration for different scrapers
 * Allows using different proxy types (HTTP/SOCKS5) for different sites
 */

export interface ProxyTypeConfig {
  type: 'http' | 'socks5';
  file: string;
  username?: string;
  password?: string;
}

export interface ScraperProxyConfig {
  [scraperName: string]: ProxyTypeConfig;
}

/**
 * Get proxy configuration for a specific scraper
 */
export function getScraperProxyConfig(scraperName: string): ProxyTypeConfig | null {
  // Check environment variables first
  const envProxyType = process.env[`${scraperName.toUpperCase()}_PROXY_TYPE`];
  const envProxyFile = process.env[`${scraperName.toUpperCase()}_PROXY_FILE`];
  
  if (envProxyType && envProxyFile) {
    return {
      type: envProxyType as 'http' | 'socks5',
      file: envProxyFile,
      username: process.env[`${scraperName.toUpperCase()}_PROXY_USERNAME`],
      password: process.env[`${scraperName.toUpperCase()}_PROXY_PASSWORD`],
    };
  }
  
  // Default configurations
  const defaultConfigs: ScraperProxyConfig = {
    'realestate': {
      type: 'http',
      file: process.env.HTTP_PROXY_FILE || 'src/lib/scrapers/data/proxyscrape_premium_http_proxies.txt',
    },
    'realestate.co.jp': {
      type: 'http',
      file: process.env.HTTP_PROXY_FILE || 'src/lib/scrapers/data/proxyscrape_premium_http_proxies.txt',
    },
    'fastrealestate': {
      type: 'http',
      file: process.env.HTTP_PROXY_FILE || 'src/lib/scrapers/data/proxyscrape_premium_http_proxies.txt',
    },
    'fast realestate.co.jp': {
      type: 'http',
      file: process.env.HTTP_PROXY_FILE || 'src/lib/scrapers/data/proxyscrape_premium_http_proxies.txt',
    },
    'wagaya-japan': {
      type: 'socks5',
      file: process.env.PROXY_FILE || 'src/lib/scrapers/data/proxyscrape_premium_socks_proxies.txt',
    },
    'wagaya japan': {
      type: 'socks5',
      file: process.env.PROXY_FILE || 'src/lib/scrapers/data/proxyscrape_premium_socks_proxies.txt',
    },
    'fastwagayajapan': {
      type: 'http',
      file: process.env.HTTP_PROXY_FILE || 'src/lib/scrapers/data/proxyscrape_premium_http_proxies.txt',
    },
    'yolo-japan': {
      type: 'socks5',
      file: process.env.PROXY_FILE || 'src/lib/scrapers/data/proxyscrape_premium_socks_proxies.txt',
    },
    'yolo japan': {
      type: 'socks5',
      file: process.env.PROXY_FILE || 'src/lib/scrapers/data/proxyscrape_premium_socks_proxies.txt',
    },
    'fastyolojapan': {
      type: 'http',
      file: process.env.HTTP_PROXY_FILE || 'src/lib/scrapers/data/proxyscrape_premium_http_proxies.txt',
    },
  };
  
  // Check if there's a specific config for this scraper
  const config = defaultConfigs[scraperName.toLowerCase()];
  if (config) {
    return config;
  }
  
  // Fall back to general proxy configuration
  const generalProxyFile = process.env.PROXY_FILE;
  if (generalProxyFile) {
    // Determine type based on file content or default to socks5
    const isHttpProxy = generalProxyFile.includes('http') || process.env.PROXY_TYPE === 'http';
    return {
      type: isHttpProxy ? 'http' : 'socks5',
      file: generalProxyFile,
    };
  }
  
  return null;
}

/**
 * Parse proxy string based on type
 */
export function parseProxyString(proxyString: string, type: 'http' | 'socks5'): any {
  const parts = proxyString.trim().split(':');
  
  if (parts.length >= 2) {
    const [host, port] = parts;
    
    return {
      host,
      port: parseInt(port, 10),
      type,
      protocol: type === 'http' ? 'http' : 'socks5',
    };
  }
  
  // Handle username:password@host:port format
  const match = proxyString.match(/^(.+):(.+)@(.+):(\d+)$/);
  if (match) {
    const [, username, password, host, port] = match;
    return {
      host,
      port: parseInt(port, 10),
      username,
      password,
      type,
      protocol: type === 'http' ? 'http' : 'socks5',
    };
  }
  
  return null;
}