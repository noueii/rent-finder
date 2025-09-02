# Using SOCKS Proxies with the Scrapers

## Why SOCKS Proxies are Better for HTTPS

Your current proxies are HTTP proxies that have issues with HTTPS sites because:
- HTTP proxies need to support the CONNECT method for HTTPS tunneling
- Many free HTTP proxies don't implement this properly
- They operate at the HTTP protocol level and need to understand the traffic

SOCKS proxies work better because:
- They operate at a lower TCP/IP level
- They can relay any TCP traffic without understanding it
- SOCKS5 supports authentication and UDP
- They work seamlessly with HTTPS traffic

## Proxy File Format

Update your `src/lib/scrapers/data/proxilist.txt` to include SOCKS proxies:

```txt
# SOCKS5 proxies - these work with HTTPS
socks5://192.168.1.100:1080
socks5://user:pass@proxy.example.com:1080
socks5://45.123.45.67:1080

# SOCKS4 proxies - older but still work
socks4://192.168.1.101:1080

# HTTP proxies - your current ones
157.242.43.120:3129
154.213.195.16:3129
```

## Environment Variables

You can also specify proxy type via environment:

```bash
# Use SOCKS5 proxy
export PROXY_LIST="socks5://proxy1.com:1080,socks5://proxy2.com:1080"

# Or mixed types
export PROXY_LIST="socks5://proxy1.com:1080,http://proxy2.com:3128"
```

## Testing SOCKS Proxy

```typescript
import { WagayaJapanScraper } from './src/lib/scrapers/sources/wagaya-japan-scraper';

// Set SOCKS proxy
process.env.PROXY_LIST = "socks5://your-socks-proxy:1080";

const scraper = new WagayaJapanScraper({
  rateLimit: 1000,
  maxRetries: 2,
  timeout: 30000,
});

const result = await scraper.search({
  maxPrice: 200000,
  minSize: 20,
  limit: 5,
});
```

## Finding SOCKS Proxies

### Free SOCKS Proxy Lists (Use with caution)
- https://www.proxy-list.download/SOCKS5
- https://www.socks-proxy.net/
- https://spys.one/en/socks-proxy-list/

### Setting up your own SOCKS proxy
1. **SSH Tunnel** (if you have a VPS):
   ```bash
   ssh -D 1080 -f -C -q -N user@your-vps.com
   # Now you have a SOCKS5 proxy at localhost:1080
   ```

2. **Shadowsocks** - Popular SOCKS5 proxy software
3. **Dante** - Open source SOCKS server

### Professional SOCKS Proxy Services
- **NordVPN** - Provides SOCKS5 proxies with VPN subscription
- **IPVanish** - SOCKS5 included
- **Private Internet Access** - SOCKS5 proxy included
- **Proxy-Seller** - Dedicated SOCKS proxies

## Converting HTTP Proxies to SOCKS

Unfortunately, you cannot convert HTTP proxies to SOCKS proxies. They are different protocols. You need actual SOCKS proxy servers.

## Testing Your Current HTTP Proxies

If you want to keep using your HTTP proxies, they might work for HTTP-only sites or sites that don't enforce HTTPS. You can test them:

```typescript
// Test HTTP site (if available)
const httpUrl = 'http://example.com'; // Replace with actual HTTP site

// Some sites might have both HTTP and HTTPS versions
```

## Recommendation

For web scraping HTTPS sites, I recommend:
1. Get a few reliable SOCKS5 proxies
2. Use a VPS and create SSH tunnels for SOCKS5
3. Consider a professional proxy service
4. Or run without proxies but with respectful rate limiting

The HTTP proxies in your list (port 3129) appear to be from a specific proxy network that might require special configuration or authentication that's not documented in the file.