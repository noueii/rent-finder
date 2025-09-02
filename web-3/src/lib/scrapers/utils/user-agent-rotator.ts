/**
 * User Agent Rotation Utility
 * Provides a collection of real browser user agents and methods to rotate between them
 * to help avoid detection when scraping
 */

interface BrowserVersion {
  name: string;
  userAgent: string;
  secChUa: string;
  secChUaPlatform: string;
}

// Collection of recent browser versions
const BROWSER_VERSIONS: BrowserVersion[] = [
  // Chrome Windows (expanded)
  {
    name: 'Chrome 121 Windows',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    secChUa: '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
    secChUaPlatform: '"Windows"',
  },
  {
    name: 'Chrome 120 Windows',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    secChUa: '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    secChUaPlatform: '"Windows"',
  },
  {
    name: 'Chrome 119 Windows',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    secChUa: '"Google Chrome";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
    secChUaPlatform: '"Windows"',
  },
  {
    name: 'Chrome 118 Windows',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    secChUa: '"Chromium";v="118", "Google Chrome";v="118", "Not=A?Brand";v="99"',
    secChUaPlatform: '"Windows"',
  },
  {
    name: 'Chrome 117 Windows',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
    secChUa: '"Google Chrome";v="117", "Not;A=Brand";v="8", "Chromium";v="117"',
    secChUaPlatform: '"Windows"',
  },
  
  // Chrome Mac (expanded)
  {
    name: 'Chrome 121 Mac',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    secChUa: '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
    secChUaPlatform: '"macOS"',
  },
  {
    name: 'Chrome 120 Mac',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    secChUa: '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    secChUaPlatform: '"macOS"',
  },
  {
    name: 'Chrome 119 Mac',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    secChUa: '"Google Chrome";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
    secChUaPlatform: '"macOS"',
  },
  {
    name: 'Chrome 118 Mac',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    secChUa: '"Chromium";v="118", "Google Chrome";v="118", "Not=A?Brand";v="99"',
    secChUaPlatform: '"macOS"',
  },
  
  // Chrome Linux
  {
    name: 'Chrome 121 Linux',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    secChUa: '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
    secChUaPlatform: '"Linux"',
  },
  {
    name: 'Chrome 120 Linux',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    secChUa: '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    secChUaPlatform: '"Linux"',
  },
  
  // Firefox Windows (expanded)
  {
    name: 'Firefox 122 Windows',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
    secChUa: '', // Firefox doesn't send this header
    secChUaPlatform: '',
  },
  {
    name: 'Firefox 121 Windows',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    secChUa: '',
    secChUaPlatform: '',
  },
  {
    name: 'Firefox 120 Windows',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
    secChUa: '',
    secChUaPlatform: '',
  },
  
  // Firefox Mac
  {
    name: 'Firefox 122 Mac',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15) Gecko/20100101 Firefox/122.0',
    secChUa: '',
    secChUaPlatform: '',
  },
  {
    name: 'Firefox 121 Mac',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15) Gecko/20100101 Firefox/121.0',
    secChUa: '',
    secChUaPlatform: '',
  },
  
  // Safari Mac (expanded)
  {
    name: 'Safari 17.2 Mac',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15',
    secChUa: '', // Safari doesn't send this header
    secChUaPlatform: '',
  },
  {
    name: 'Safari 17.1 Mac',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    secChUa: '',
    secChUaPlatform: '',
  },
  {
    name: 'Safari 16.6 Mac',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
    secChUa: '',
    secChUaPlatform: '',
  },
  
  // Edge Windows (expanded)
  {
    name: 'Edge 121 Windows',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0',
    secChUa: '"Not A(Brand";v="99", "Microsoft Edge";v="121", "Chromium";v="121"',
    secChUaPlatform: '"Windows"',
  },
  {
    name: 'Edge 120 Windows',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    secChUa: '"Not_A Brand";v="8", "Chromium";v="120", "Microsoft Edge";v="120"',
    secChUaPlatform: '"Windows"',
  },
  {
    name: 'Edge 119 Windows',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
    secChUa: '"Microsoft Edge";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
    secChUaPlatform: '"Windows"',
  },
  
  // Opera Windows
  {
    name: 'Opera 106 Windows',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0',
    secChUa: '"Not_A Brand";v="8", "Chromium";v="120", "Opera";v="106"',
    secChUaPlatform: '"Windows"',
  },
  
  // Brave Windows
  {
    name: 'Brave 1.61 Windows',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    secChUa: '"Not_A Brand";v="8", "Chromium";v="120", "Brave";v="120"',
    secChUaPlatform: '"Windows"',
  },
];

// Language variations (expanded)
const LANGUAGE_PREFERENCES = [
  'en-US,en;q=0.9,ja;q=0.8',
  'en-US,en;q=0.9',
  'ja-JP,ja;q=0.9,en;q=0.8',
  'en-GB,en;q=0.9,ja;q=0.8',
  'en,ja;q=0.9',
  'ja,en-US;q=0.9,en;q=0.8',
  'en-US,en;q=0.9,ja;q=0.7',
  'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
  'en-GB,en-US;q=0.9,en;q=0.8,ja;q=0.7',
  'en-CA,en;q=0.9,ja;q=0.8',
  'en-AU,en;q=0.9,ja;q=0.8',
  'ja;q=0.9,en;q=0.8',
];

// Screen resolutions for viewport variation
const SCREEN_RESOLUTIONS = [
  { width: 1920, height: 1080 }, // Full HD
  { width: 1366, height: 768 },  // Common laptop
  { width: 1536, height: 864 },  // Common laptop
  { width: 1440, height: 900 },  // Mac common
  { width: 1280, height: 720 },  // HD
  { width: 1600, height: 900 },  // Common desktop
  { width: 2560, height: 1440 }, // 2K
  { width: 1920, height: 1200 }, // WUXGA
];

export class UserAgentRotator {
  private currentIndex: number = 0;
  private lastRotation: number = Date.now();
  private rotationInterval: number = 300000; // 5 minutes default
  
  constructor(rotationInterval?: number) {
    if (rotationInterval) {
      this.rotationInterval = rotationInterval;
    }
    // Start with a random browser
    this.currentIndex = Math.floor(Math.random() * BROWSER_VERSIONS.length);
  }
  
  /**
   * Get a random browser version
   */
  getRandomBrowser(): BrowserVersion {
    const index = Math.floor(Math.random() * BROWSER_VERSIONS.length);
    return BROWSER_VERSIONS[index];
  }
  
  /**
   * Get the next browser in rotation
   */
  getNextBrowser(): BrowserVersion {
    this.currentIndex = (this.currentIndex + 1) % BROWSER_VERSIONS.length;
    this.lastRotation = Date.now();
    return BROWSER_VERSIONS[this.currentIndex];
  }
  
  /**
   * Get current browser (rotates if interval has passed)
   */
  getCurrentBrowser(): BrowserVersion {
    const now = Date.now();
    if (now - this.lastRotation > this.rotationInterval) {
      return this.getNextBrowser();
    }
    return BROWSER_VERSIONS[this.currentIndex];
  }
  
  /**
   * Get a random language preference
   */
  getRandomLanguage(): string {
    const index = Math.floor(Math.random() * LANGUAGE_PREFERENCES.length);
    return LANGUAGE_PREFERENCES[index];
  }
  
  /**
   * Get a random screen resolution
   */
  getRandomScreenResolution() {
    const index = Math.floor(Math.random() * SCREEN_RESOLUTIONS.length);
    return SCREEN_RESOLUTIONS[index];
  }
  
  /**
   * Build complete headers for a browser with enhanced randomization
   */
  buildHeaders(browser?: BrowserVersion, includeLanguageVariation: boolean = false): Record<string, string> {
    const selectedBrowser = browser || this.getCurrentBrowser();
    const language = includeLanguageVariation ? this.getRandomLanguage() : 'en-US,en;q=0.9,ja;q=0.8';
    const resolution = this.getRandomScreenResolution();
    
    const headers: Record<string, string> = {
      'User-Agent': selectedBrowser.userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': language,
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'max-age=0',
      'Upgrade-Insecure-Requests': '1',
      'DNT': '1',
      'Connection': 'keep-alive',
    };
    
    // Add Chrome/Edge specific headers
    if (selectedBrowser.secChUa) {
      headers['Sec-Ch-Ua'] = selectedBrowser.secChUa;
      headers['Sec-Ch-Ua-Mobile'] = '?0';
      headers['Sec-Ch-Ua-Platform'] = selectedBrowser.secChUaPlatform;
      headers['Sec-Fetch-Dest'] = 'document';
      headers['Sec-Fetch-Mode'] = 'navigate';
      headers['Sec-Fetch-Site'] = 'none';
      headers['Sec-Fetch-User'] = '?1';
      
      // Add viewport headers for Chrome-based browsers (random chance)
      if (Math.random() > 0.5) {
        headers['Sec-Ch-Viewport-Width'] = resolution.width.toString();
        headers['Sec-Ch-Ua-Full-Version-List'] = selectedBrowser.secChUa;
      }
    }
    
    return headers;
  }
  
  /**
   * Add random jitter to a delay
   */
  static addJitter(baseDelay: number, maxJitter: number = 500): number {
    const jitter = Math.random() * maxJitter * 2 - maxJitter; // ±maxJitter
    return Math.max(0, baseDelay + jitter);
  }
}

// Export a singleton instance for convenience
export const defaultUserAgentRotator = new UserAgentRotator();