# Fast Scrapers Quick Start Guide

## 🚀 Overview

The app has been upgraded to use **Fast Scrapers** that are **15x faster** than the standard scrapers. This guide shows you how to enable and use them.

## ⚡ Quick Setup

### 1. Update Your .env File

Add these lines to your `.env` file:

```bash
# Enable Fast Scrapers
USE_FAST_SCRAPERS=true
ENABLE_FAST_MODE=true

# Use Optimized Proxy Configuration
PROXY_FILE=src/lib/scrapers/data/fast-socks-proxies.txt
PROXY_ROTATION_STRATEGY=performance
PROXY_BLACKLIST_DURATION=60000
PROXY_MAX_FAILURES=2
```

### 2. Generate Fast Proxy List (Optional)

If you want to refresh the optimized proxy list:

```bash
npx tsx optimize-proxy-config.ts
```

This will:
- Test all proxies for speed
- Create `fast-socks-proxies.txt` with the fastest proxies
- Show optimal configuration settings

### 3. Test the Setup

Verify fast scrapers are working:

```bash
npx tsx test-fast-scrapers.ts
```

## 📊 Performance Improvements

### Before (Standard Scrapers)
- **Speed**: ~0.8 requests/second
- **Concurrency**: Sequential only
- **Proxy Selection**: Round-robin
- **Rate Limit**: 1 second between requests

### After (Fast Scrapers)
- **Speed**: 12.2 requests/second (15x faster!)
- **Concurrency**: Up to 5 parallel requests
- **Proxy Selection**: Performance-based (fastest first)
- **Rate Limit**: 200ms between requests

## 🔧 How It Works

### 1. Fast Base Scraper
- Supports concurrent requests
- Batch fetching for multiple pages
- Proxy pre-warming for instant connections

### 2. Fast Proxy Manager
- Health checking and scoring
- Automatic blacklisting of slow proxies
- Performance-based selection

### 3. Optimized Configuration
- Reduced timeouts (10s vs 30s)
- Fewer retries (2 vs 3)
- Faster rate limits (200ms vs 1000ms)

## 🎯 Using Fast Search API

The app now includes a fast search endpoint that searches multiple sources concurrently:

```typescript
// In your component
const fastSearch = api.search.fastSearch.useMutation();

const results = await fastSearch.mutateAsync({
  filters: {
    priceMax: 200000,
    sizeMin: 25,
    sources: ['wagaya-japan', 'yolo-japan'] // Optional: specific sources
  },
  limit: 100
});
```

## 📈 Monitoring Performance

### Admin Panel
Navigate to `/admin/monitoring` and click the **Performance** tab to see:
- Current scraper mode (Fast/Standard)
- Proxy health statistics
- Performance metrics per scraper
- Optimization tips

### Key Metrics to Watch
- **Healthy Proxies**: Should be > 80% of total
- **Average Latency**: Should be < 1.5 seconds
- **Success Rate**: Should be > 95%

## 🛠️ Troubleshooting

### Fast Scrapers Not Working?

1. **Check Environment Variables**
   ```bash
   echo $USE_FAST_SCRAPERS  # Should output: true
   ```

2. **Verify Proxy File Exists**
   ```bash
   ls src/lib/scrapers/data/fast-socks-proxies.txt
   ```

3. **Test Individual Scrapers**
   ```bash
   npx tsx test-speed-comparison.ts
   ```

### Performance Not Improved?

1. **Regenerate Fast Proxies**
   ```bash
   npx tsx optimize-proxy-config.ts
   ```

2. **Check Proxy Health**
   - Go to Admin Panel > Monitoring > Performance
   - Look for blacklisted proxies
   - If > 20% are blacklisted, regenerate list

3. **Adjust Concurrency**
   - Default is 5 concurrent requests
   - Can be adjusted based on server capacity

## 🎉 Benefits

With fast scrapers enabled, you can:
- Search apartments 15x faster
- Get real-time results from multiple sources
- Handle more user requests
- Reduce server load with efficient proxy usage

## 📝 Notes

- Fast scrapers are automatically used in production (`NODE_ENV=production`)
- SOCKS5 proxies work better than HTTP proxies for HTTPS sites
- The system automatically falls back to standard scrapers if fast ones fail
- Proxy health is continuously monitored and optimized

Happy scraping! 🏠✨