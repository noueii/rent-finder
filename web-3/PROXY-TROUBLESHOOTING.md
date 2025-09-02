# Proxy Troubleshooting Summary

## Issue
The proxies in `src/lib/scrapers/data/proxilist.txt` are not working with the scrapers when making HTTPS requests.

## Findings

1. **Direct requests work**: The target sites (wagaya-japan.com, realestate.co.jp) are accessible without proxies
2. **Proxy loading works**: The proxy manager correctly loads all 1000 proxies from the file
3. **Proxy format is correct**: Proxies are in `host:port` format (e.g., `157.242.43.120:3129`)
4. **HTTPS tunneling fails**: When trying to use these proxies for HTTPS sites, connections time out

## Root Cause

The proxies appear to be HTTP-only proxies that don't support HTTPS tunneling (CONNECT method). This is common with free/public proxy lists.

## Solutions

### Option 1: Use HTTP-only Sites
Some scrapers might work with HTTP versions of the sites (if available).

### Option 2: Get HTTPS-capable Proxies
You need proxies that support:
- HTTPS tunneling (CONNECT method)
- No authentication or provide credentials

### Option 3: Test and Filter Working Proxies
Create a script to test each proxy and save only the working ones:

```typescript
// See test-filter-working-proxies.ts
```

### Option 4: Use a Proxy Service
Consider using a professional proxy service that provides:
- HTTPS support
- Reliable uptime
- Proper authentication
- API access

Popular services:
- Bright Data (formerly Luminati)
- Smartproxy
- Oxylabs
- ProxyMesh

### Option 5: Run Without Proxies (Development)
For development/testing, you can disable proxy rotation:

```typescript
const scraper = new WagayaJapanScraper({
  rateLimit: 2000, // Increase rate limit to be respectful
});

// Or set environment variable
process.env.PROXY_FILE = ''; // Empty to disable proxy loading
```

## Testing Proxy Support

To test if a proxy supports HTTPS:

1. Check if it accepts CONNECT requests
2. Test with a simple HTTPS site first (e.g., https://httpbin.org/ip)
3. Verify the response contains the expected content

## Current Workaround

The scrapers will work without proxies. The proxy manager will automatically skip proxy usage if none are available or working.

## Next Steps

1. Find proxies that explicitly support HTTPS
2. Test proxies before adding to the list
3. Consider implementing automatic proxy health checking
4. Add proxy authentication support if needed