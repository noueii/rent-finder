# Proxy Configuration Guide

This guide explains how to configure proxy servers for the Tokyo Apartment Finder scrapers to enhance reliability and avoid blocking.

## Overview

The proxy system supports:
- Multiple proxy servers
- Automatic proxy rotation
- Intelligent load balancing
- Automatic blacklisting of failed proxies
- Performance-based selection
- Support for HTTP, HTTPS, and SOCKS5 proxies

## Configuration Methods

### Method 1: Automatic Loading from proxilist.txt (Default)

By default, if no other proxy configuration is provided, the system will automatically load proxies from:
```
src/lib/scrapers/data/proxilist.txt
```

This file already contains 300+ free proxies that are automatically rotated.

**Proxy File Format:**
```
# Comments start with #
# Each proxy on a new line
# Supported formats:
72.10.160.170:3949              # Simple host:port
http://proxy.example.com:8080   # With protocol
socks5://user:pass@proxy:1080   # With authentication
```

### Method 2: Environment Variables

#### Option A: Custom Proxy File
```bash
# In your .env file
PROXY_FILE="path/to/your/proxy-list.txt"
```

#### Option B: Multiple Proxies List
```bash
# In your .env file
PROXY_LIST="http://proxy1.example.com:8080,https://user:pass@proxy2.example.com:3128,socks5://proxy3.example.com:1080"
```

#### Option C: Single Proxy
```bash
# In your .env file
PROXY_HOST="proxy.example.com"
PROXY_PORT="8080"
PROXY_USERNAME="your_username"  # Optional
PROXY_PASSWORD="your_password"  # Optional
PROXY_PROTOCOL="http"           # http, https, or socks5
```

### Method 2: Programmatic Configuration

```typescript
// In your scraper configuration
const scraper = new WagayaJapanScraper({
  proxies: [
    {
      host: 'proxy1.example.com',
      port: 8080,
      protocol: 'http'
    },
    {
      host: 'proxy2.example.com',
      port: 1080,
      username: 'user',
      password: 'pass',
      protocol: 'socks5'
    }
  ]
});
```

## Proxy Rotation Strategies

Configure via `PROXY_ROTATION_STRATEGY` environment variable:

### 1. Round-Robin (Default)
```bash
PROXY_ROTATION_STRATEGY="round-robin"
```
- Cycles through proxies in order
- Ensures even distribution
- Best for equal-quality proxies

### 2. Random
```bash
PROXY_ROTATION_STRATEGY="random"
```
- Randomly selects proxies
- Good for avoiding patterns
- Suitable for large proxy pools

### 3. Performance-Based
```bash
PROXY_ROTATION_STRATEGY="performance"
```
- Selects fastest, most reliable proxies
- Adapts based on success rate and response time
- Best for mixed-quality proxy pools

### 4. Least-Used
```bash
PROXY_ROTATION_STRATEGY="least-used"
```
- Prioritizes least recently used proxies
- Helps distribute load over time
- Good for rate-limited proxies

## Advanced Settings

### Blacklisting Configuration
```bash
# How long to blacklist failed proxies (milliseconds)
PROXY_BLACKLIST_DURATION="300000"  # 5 minutes

# Number of failures before blacklisting
PROXY_MAX_FAILURES="3"
```

### Monitoring Proxy Performance

The proxy manager tracks:
- Success/failure rates
- Average response times
- Error messages
- Blacklist status

Access statistics programmatically:
```typescript
const stats = scraper.proxyManager.getStats();
console.log('Proxy performance:', stats);
```

## Proxy Providers

### Recommended Free Proxies (for testing only)
- **ProxyScrape**: https://proxyscrape.com/free-proxy-list
- **Free Proxy List**: https://free-proxy-list.net/
- **ProxyNova**: https://www.proxynova.com/

### Premium Proxy Services (Recommended for Production)
1. **Bright Data** (formerly Luminati)
   - Residential proxies
   - High success rate
   - Global coverage

2. **Smartproxy**
   - Affordable residential proxies
   - Good for web scraping
   - Easy integration

3. **Oxylabs**
   - Enterprise-grade proxies
   - Advanced rotation
   - 99.9% uptime

4. **IPRoyal**
   - Budget-friendly
   - Good for small projects
   - Decent success rates

## Example Configurations

### Development Setup (Free Proxies)
```bash
# .env
PROXY_LIST="http://proxy1.free.com:8080,http://proxy2.free.com:3128"
PROXY_ROTATION_STRATEGY="random"
PROXY_MAX_FAILURES="2"
```

### Production Setup (Premium Proxies)
```bash
# .env
PROXY_LIST="http://user123:pass456@residential.brightdata.com:22225,http://user123:pass456@residential2.brightdata.com:22225"
PROXY_ROTATION_STRATEGY="performance"
PROXY_BLACKLIST_DURATION="600000"  # 10 minutes
PROXY_MAX_FAILURES="5"
```

### High-Security Setup (SOCKS5)
```bash
# .env
PROXY_LIST="socks5://secure-user:secure-pass@socks.provider.com:1080"
PROXY_ROTATION_STRATEGY="least-used"
```

## Troubleshooting

### Common Issues

1. **All proxies blacklisted**
   - Check proxy credentials
   - Verify proxy server status
   - Reduce `PROXY_MAX_FAILURES`
   - Increase `PROXY_BLACKLIST_DURATION`

2. **Slow scraping performance**
   - Use `performance` rotation strategy
   - Remove slow proxies from list
   - Consider premium proxy service

3. **Authentication errors**
   - Verify username/password
   - Check proxy protocol (http vs https)
   - Ensure proper URL encoding for special characters

### Testing Proxies

Test your proxy configuration:
```bash
# Create a test script
node -e "
const axios = require('axios');
const proxy = {
  host: 'your-proxy.com',
  port: 8080,
  auth: { username: 'user', password: 'pass' }
};
axios.get('https://api.ipify.org?format=json', { proxy })
  .then(res => console.log('Proxy IP:', res.data.ip))
  .catch(err => console.error('Proxy failed:', err.message));
"
```

## Security Considerations

1. **Never commit proxy credentials**
   - Use environment variables
   - Add `.env` to `.gitignore`

2. **Rotate credentials regularly**
   - Change proxy passwords monthly
   - Monitor for unauthorized usage

3. **Use HTTPS/SOCKS5 for sensitive data**
   - HTTP proxies can see your data
   - SOCKS5 provides better security

4. **Respect rate limits**
   - Even with proxies, respect site limits
   - Configure appropriate delays

## Integration with User Agent Rotation

Proxies work seamlessly with user agent rotation:
- Each request gets a unique browser fingerprint
- Combined with proxy rotation = maximum anonymity
- 288 user agents × N proxies = N×288 unique combinations

## Disabling Proxies

To disable proxy usage temporarily:

```typescript
// In your code
scraper.enableProxyRotation = false;
```

Or remove/comment out proxy configuration in `.env`.

## Best Practices

1. **Start with 3-5 reliable proxies**
   - Quality over quantity
   - Test each proxy before adding

2. **Monitor proxy performance**
   - Check success rates regularly
   - Remove consistently failing proxies

3. **Use appropriate rotation strategy**
   - Round-robin for testing
   - Performance for production
   - Random for avoiding detection

4. **Combine with other anti-blocking measures**
   - User agent rotation (already implemented)
   - Request delays (already implemented)
   - Respect robots.txt

5. **Have backup options**
   - Keep some proxies in reserve
   - Consider multiple proxy providers
   - Implement fallback to no-proxy mode

## Conclusion

Proper proxy configuration significantly improves scraping reliability and reduces the chance of IP-based blocking. Combined with user agent rotation and request delays, your scrapers will be highly resilient to anti-scraping measures.