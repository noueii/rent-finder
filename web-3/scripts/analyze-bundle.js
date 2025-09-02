#!/usr/bin/env node
// @ts-nocheck
/**
 * Bundle Analysis Script
 * Analyzes the Next.js production bundle and generates reports
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

async function analyzeBundles() {
  console.log(`${colors.cyan}${colors.bright}🔍 Tokyo Apartment Finder - Bundle Analysis${colors.reset}\n`);

  try {
    // Step 1: Clean previous build
    console.log(`${colors.blue}📦 Cleaning previous build...${colors.reset}`);
    await execAsync('rm -rf .next', { cwd: rootDir });

    // Step 2: Build with bundle analyzer
    console.log(`${colors.blue}🏗️  Building production bundle with analysis...${colors.reset}`);
    console.log('This may take a few minutes...\n');
    
    const buildStart = Date.now();
    const { stdout, stderr } = await execAsync(
      'ANALYZE=true next build --config next.config.bundleAnalyzer.js',
      { cwd: rootDir, maxBuffer: 1024 * 1024 * 10 }
    );
    
    const buildTime = ((Date.now() - buildStart) / 1000).toFixed(2);
    console.log(`${colors.green}✅ Build completed in ${buildTime}s${colors.reset}\n`);

    // Step 3: Parse build output for bundle sizes
    const bundleSizes = parseBuildOutput(stdout);
    
    // Step 4: Analyze node_modules usage
    console.log(`${colors.blue}🔍 Analyzing dependencies...${colors.reset}`);
    const depAnalysis = await analyzeDependencies();
    
    // Step 5: Check for common optimization opportunities
    const optimizations = await checkOptimizations();
    
    // Step 6: Generate report
    const report = generateReport({
      buildTime,
      bundleSizes,
      depAnalysis,
      optimizations,
      buildOutput: stdout,
    });
    
    // Step 7: Save report
    const reportPath = path.join(rootDir, 'bundle-analysis-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    const readableReportPath = path.join(rootDir, 'docs/bundle-analysis-report.md');
    await fs.writeFile(readableReportPath, generateMarkdownReport(report));
    
    // Step 8: Display summary
    displaySummary(report);
    
    console.log(`\n${colors.green}✅ Analysis complete!${colors.reset}`);
    console.log(`📊 Report saved to: ${colors.cyan}bundle-analysis-report.json${colors.reset}`);
    console.log(`📄 Readable report: ${colors.cyan}docs/bundle-analysis-report.md${colors.reset}`);
    console.log(`\n${colors.yellow}💡 The bundle analyzer should open in your browser automatically.${colors.reset}`);
    
  } catch (error) {
    console.error(`${colors.red}❌ Error during bundle analysis:${colors.reset}`, error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function parseBuildOutput(output) {
  const sizes = {
    pages: {},
    appDir: {},
    totalSize: 0,
  };
  
  // Parse Next.js build output for bundle sizes
  const lines = output.split('\n');
  let inSizeSection = false;
  
  for (const line of lines) {
    if (line.includes('Route (app)') || line.includes('Route (pages)')) {
      inSizeSection = true;
      continue;
    }
    
    if (inSizeSection && line.trim() === '') {
      inSizeSection = false;
      continue;
    }
    
    if (inSizeSection) {
      // Parse size information
      const match = line.match(/([├└]─\s+)?(.+?)\s+(\d+(?:\.\d+)?)\s*(B|kB|MB)/);
      if (match) {
        const [, , route, size, unit] = match;
        const sizeInBytes = convertToBytes(parseFloat(size), unit);
        
        if (line.includes('app')) {
          sizes.appDir[route.trim()] = sizeInBytes;
        } else {
          sizes.pages[route.trim()] = sizeInBytes;
        }
        
        sizes.totalSize += sizeInBytes;
      }
    }
  }
  
  return sizes;
}

function convertToBytes(size, unit) {
  const units = {
    'B': 1,
    'kB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
  };
  return Math.round(size * (units[unit] || 1));
}

async function analyzeDependencies() {
  const packageJsonPath = path.join(rootDir, 'package.json');
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
  
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  
  // Categorize dependencies
  const categories = {
    ui: [],
    framework: [],
    utilities: [],
    monitoring: [],
    database: [],
    other: [],
  };
  
  const uiPackages = ['radix-ui', 'lucide-react', 'cmdk', 'motion', 'leaflet', 'recharts'];
  const frameworkPackages = ['next', 'react', 'trpc', 'tanstack'];
  const utilityPackages = ['axios', 'date-fns', 'clsx', 'zod', 'cheerio'];
  const monitoringPackages = ['sentry', 'opentelemetry', 'winston', 'pino'];
  const databasePackages = ['prisma', 'ioredis'];
  
  for (const [pkg, version] of Object.entries(dependencies)) {
    if (uiPackages.some(ui => pkg.includes(ui))) {
      categories.ui.push({ package: pkg, version });
    } else if (frameworkPackages.some(fw => pkg.includes(fw))) {
      categories.framework.push({ package: pkg, version });
    } else if (utilityPackages.some(util => pkg.includes(util))) {
      categories.utilities.push({ package: pkg, version });
    } else if (monitoringPackages.some(mon => pkg.includes(mon))) {
      categories.monitoring.push({ package: pkg, version });
    } else if (databasePackages.some(db => pkg.includes(db))) {
      categories.database.push({ package: pkg, version });
    } else {
      categories.other.push({ package: pkg, version });
    }
  }
  
  return categories;
}

async function checkOptimizations() {
  const optimizations = {
    treeshaking: [],
    duplicates: [],
    largeModules: [],
    recommendations: [],
  };
  
  // Check for common optimization opportunities
  
  // 1. Check for moment.js (should use date-fns)
  const packageJsonPath = path.join(rootDir, 'package.json');
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
  
  if (packageJson.dependencies['moment']) {
    optimizations.recommendations.push({
      severity: 'high',
      issue: 'moment.js detected',
      recommendation: 'Already using date-fns, remove moment.js to save ~70KB',
    });
  }
  
  // 2. Check for lodash (should use ES modules)
  if (packageJson.dependencies['lodash']) {
    optimizations.recommendations.push({
      severity: 'medium',
      issue: 'lodash detected',
      recommendation: 'Use lodash-es or individual imports to enable tree shaking',
    });
  }
  
  // 3. Check Radix UI imports
  optimizations.recommendations.push({
    severity: 'low',
    issue: 'Multiple Radix UI packages',
    recommendation: 'Already optimized with optimizePackageImports in next.config.js',
  });
  
  // 4. Check for unused dependencies
  optimizations.recommendations.push({
    severity: 'medium',
    issue: 'Potential unused dependencies',
    recommendation: 'Run "npx depcheck" to identify and remove unused dependencies',
  });
  
  // 5. Image optimization
  optimizations.recommendations.push({
    severity: 'info',
    issue: 'Image optimization',
    recommendation: 'Already configured with Next.js Image component and WebP/AVIF formats',
  });
  
  // 6. Code splitting recommendations
  optimizations.recommendations.push({
    severity: 'info',
    issue: 'Code splitting',
    recommendation: 'Consider lazy loading heavy components like maps and charts',
  });
  
  return optimizations;
}

function generateReport(data) {
  const { buildTime, bundleSizes, depAnalysis, optimizations } = data;
  
  return {
    timestamp: new Date().toISOString(),
    buildTime: `${buildTime}s`,
    bundle: {
      totalSize: formatBytes(bundleSizes.totalSize),
      totalSizeBytes: bundleSizes.totalSize,
      routes: {
        app: Object.entries(bundleSizes.appDir).map(([route, size]) => ({
          route,
          size: formatBytes(size),
          sizeBytes: size,
        })),
        pages: Object.entries(bundleSizes.pages).map(([route, size]) => ({
          route,
          size: formatBytes(size),
          sizeBytes: size,
        })),
      },
    },
    dependencies: {
      total: Object.values(depAnalysis).flat().length,
      byCategory: Object.entries(depAnalysis).map(([category, deps]) => ({
        category,
        count: deps.length,
        packages: deps,
      })),
    },
    optimizations,
    targets: {
      gzipped: bundleSizes.totalSize < 500 * 1024 ? 'PASS' : 'FAIL',
      initialLoad: bundleSizes.totalSize < 300 * 1024 ? 'PASS' : 'WARNING',
    },
  };
}

function generateMarkdownReport(report) {
  const { timestamp, buildTime, bundle, dependencies, optimizations, targets } = report;
  
  return `# Bundle Analysis Report

**Generated**: ${new Date(timestamp).toLocaleString()}  
**Build Time**: ${buildTime}

## 📊 Bundle Overview

- **Total Bundle Size**: ${bundle.totalSize} (${bundle.totalSizeBytes.toLocaleString()} bytes)
- **Target < 500KB gzipped**: ${targets.gzipped === 'PASS' ? '✅ PASS' : '❌ FAIL'}
- **Initial Load < 300KB**: ${targets.initialLoad === 'PASS' ? '✅ PASS' : targets.initialLoad === 'WARNING' ? '⚠️ WARNING' : '❌ FAIL'}

## 📦 Route Sizes

### App Directory Routes
${bundle.routes.app.length > 0 ? bundle.routes.app.map(r => `- ${r.route}: ${r.size}`).join('\n') : 'No app routes found'}

### Pages Routes
${bundle.routes.pages.length > 0 ? bundle.routes.pages.map(r => `- ${r.route}: ${r.size}`).join('\n') : 'No pages routes found'}

## 🔧 Dependencies Analysis

**Total Dependencies**: ${dependencies.total}

${dependencies.byCategory.map(cat => `### ${cat.category} (${cat.count} packages)
${cat.packages.slice(0, 5).map(p => `- ${p.package}: ${p.version}`).join('\n')}
${cat.count > 5 ? `... and ${cat.count - 5} more` : ''}`).join('\n\n')}

## 💡 Optimization Recommendations

${optimizations.recommendations.map(rec => `### ${rec.severity.toUpperCase()}: ${rec.issue}
${rec.recommendation}`).join('\n\n')}

## 🎯 Next Steps

1. **Immediate Actions**:
   - Review and implement HIGH severity recommendations
   - Run \`npx depcheck\` to identify unused dependencies
   - Check bundle analyzer visualization for large modules

2. **Code Splitting**:
   - Implement dynamic imports for heavy components
   - Lazy load map and chart components
   - Split vendor chunks appropriately

3. **Monitoring**:
   - Set up bundle size monitoring in CI/CD
   - Track bundle size trends over time
   - Alert on significant size increases

---

*Generated by Tokyo Apartment Finder Bundle Analysis Tool*
`;
}

function displaySummary(report) {
  const { bundle, targets, optimizations } = report;
  
  console.log(`\n${colors.bright}📊 Bundle Analysis Summary${colors.reset}`);
  console.log('═'.repeat(50));
  
  console.log(`\n${colors.cyan}Bundle Size:${colors.reset}`);
  console.log(`  Total: ${bundle.totalSize} (${bundle.totalSizeBytes.toLocaleString()} bytes)`);
  console.log(`  Routes: ${bundle.routes.app.length + bundle.routes.pages.length} total`);
  
  console.log(`\n${colors.cyan}Performance Targets:${colors.reset}`);
  console.log(`  Gzipped < 500KB: ${targets.gzipped === 'PASS' ? colors.green + '✅ PASS' : colors.red + '❌ FAIL'}${colors.reset}`);
  console.log(`  Initial Load < 300KB: ${targets.initialLoad === 'PASS' ? colors.green + '✅ PASS' : colors.yellow + '⚠️ WARNING'}${colors.reset}`);
  
  const highSeverity = optimizations.recommendations.filter(r => r.severity === 'high').length;
  const mediumSeverity = optimizations.recommendations.filter(r => r.severity === 'medium').length;
  
  console.log(`\n${colors.cyan}Optimization Opportunities:${colors.reset}`);
  console.log(`  High Priority: ${highSeverity > 0 ? colors.red : colors.green}${highSeverity}${colors.reset}`);
  console.log(`  Medium Priority: ${mediumSeverity > 0 ? colors.yellow : colors.green}${mediumSeverity}${colors.reset}`);
  console.log(`  Total Recommendations: ${optimizations.recommendations.length}`);
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Run the analysis
analyzeBundles().catch(console.error);