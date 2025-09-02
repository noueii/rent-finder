# Performance Optimization Guide

## 📊 Bundle Optimization Strategy

This document outlines the performance optimization strategies implemented for Tokyo Apartment Finder.

## 🎯 Performance Targets

- **Initial Bundle**: < 300KB (gzipped)
- **Total Bundle**: < 500KB (gzipped)
- **Time to Interactive**: < 3s
- **First Contentful Paint**: < 1.5s

## 🔧 Implemented Optimizations

### 1. Code Splitting

#### Route-based Splitting
Next.js automatically code-splits at the route level. Each page only loads its required JavaScript.

#### Dynamic Imports
Heavy components are loaded on-demand:

```typescript
// Map component - loaded only when needed
const Map = dynamic(() => import('@/components/apartment/Map'), {
  loading: () => <MapSkeleton />,
  ssr: false,
});

// Chart components - loaded on-demand
const StationChart = dynamic(() => import('@/components/charts/StationChart'), {
  loading: () => <ChartSkeleton />,
});
```

### 2. Bundle Optimization

#### Package Import Optimization
Configured in `next.config.js`:

```javascript
experimental: {
  optimizePackageImports: [
    "lucide-react",
    "@radix-ui/react-*",
    "recharts",
    "date-fns",
  ],
}
```

#### Chunk Splitting Strategy
- **Framework**: React, React-DOM in separate chunk
- **Libraries**: Large libraries (>150KB) in individual chunks
- **Commons**: Shared code between routes
- **Runtime**: Webpack runtime in separate chunk

### 3. Image Optimization

#### Next.js Image Component
- Automatic format conversion (WebP, AVIF)
- Responsive image generation
- Lazy loading by default
- Blur-up placeholders for better UX

#### CDN Support
Optional CDN configuration for image delivery:

```javascript
images: {
  loader: process.env.NEXT_PUBLIC_IMAGE_CDN_URL ? 'custom' : 'default',
  formats: ['image/webp', 'image/avif'],
}
```

### 4. Tree Shaking

#### ES Modules
Using ES module imports for better tree shaking:

```typescript
// Good - only imports what's needed
import { format, parseISO } from 'date-fns';

// Avoid - imports entire library
import * as dateFns from 'date-fns';
```

#### Radix UI Optimization
Individual component imports with tree shaking:

```typescript
// Good - specific imports
import * as Dialog from '@radix-ui/react-dialog';

// Configured for optimization in next.config.js
```

### 5. Lazy Loading Strategies

#### Component-level Lazy Loading
```typescript
// Heavy components loaded on interaction
const PropertyDetails = lazy(() => import('./PropertyDetails'));

// Suspense boundary for loading state
<Suspense fallback={<PropertyDetailsSkeleton />}>
  <PropertyDetails />
</Suspense>
```

#### Data Fetching Optimization
- Parallel data fetching with Promise.all
- Incremental data loading
- Optimistic updates for better perceived performance

### 6. Performance Monitoring

#### Web Vitals Tracking
Automatic tracking of Core Web Vitals:
- Largest Contentful Paint (LCP)
- First Input Delay (FID)
- Cumulative Layout Shift (CLS)

#### Custom Performance Metrics
- Time to First Search Result
- Map Load Time
- Property Details Load Time

## 📦 Bundle Analysis

### Running Bundle Analysis

```bash
# Generate comprehensive bundle analysis
npm run analyze

# Just view bundle analyzer
npm run analyze:size
```

### Interpreting Results

The bundle analyzer shows:
- Module sizes and dependencies
- Duplicate modules
- Large dependencies
- Optimization opportunities

### Common Issues and Solutions

#### Large Dependencies
1. **Moment.js**: Already avoided, using date-fns
2. **Lodash**: Use individual imports or lodash-es
3. **Icon Libraries**: Using lucide-react with tree shaking

#### Duplicate Dependencies
Check for multiple versions of the same package:
```bash
npm ls [package-name]
```

## 🚀 Future Optimizations

### 1. Service Worker
- Offline support
- Background sync
- Push notifications

### 2. Edge Functions
- Move computation closer to users
- Reduce latency for API calls

### 3. Streaming SSR
- Progressive rendering
- Faster time to first byte

### 4. Resource Hints
```html
<!-- Preconnect to external domains -->
<link rel="preconnect" href="https://api.mapbox.com">

<!-- Prefetch critical resources -->
<link rel="prefetch" href="/api/stations">
```

## 📈 Performance Checklist

### Before Deploy
- [ ] Run bundle analyzer
- [ ] Check bundle size < 500KB
- [ ] Test on slow 3G network
- [ ] Verify lazy loading works
- [ ] Check for console errors

### Regular Maintenance
- [ ] Review bundle size trends
- [ ] Update dependencies
- [ ] Remove unused code
- [ ] Optimize new features

## 🔍 Debugging Performance

### Tools
1. **Chrome DevTools**: Performance tab
2. **Lighthouse**: Automated audits
3. **WebPageTest**: Real-world testing
4. **Bundle Analyzer**: Included in project

### Common Commands

```bash
# Check current bundle size
npm run build

# Analyze bundle composition
npm run analyze

# Test performance locally
npm run preview

# Check for unused dependencies
npx depcheck
```

## 📚 Resources

- [Next.js Performance](https://nextjs.org/docs/advanced/performance)
- [Web.dev Performance Guide](https://web.dev/performance/)
- [Bundle Phobia](https://bundlephobia.com/) - Check package sizes
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/)

---

*Last Updated: 2025-01-25*
*Part of Tokyo Apartment Finder Refactoring Project*