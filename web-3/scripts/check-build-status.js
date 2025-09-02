#!/usr/bin/env node
// @ts-nocheck
/**
 * Build Status Checker
 * Quick verification of build readiness without full build
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

async function checkBuildStatus() {
  console.log(`${colors.cyan}${colors.bright}🔍 Checking Build Status${colors.reset}\n`);
  
  const issues = {
    typescript: [],
    dependencies: [],
    configuration: [],
    critical: [],
  };
  
  let canBuild = true;
  
  // 1. Check TypeScript compilation (excluding tests)
  console.log(`${colors.blue}📝 Checking TypeScript compilation...${colors.reset}`);
  try {
    await execAsync('npx tsc --noEmit --excludeFiles "**/*.test.ts" --excludeFiles "**/*.test.tsx"', { cwd: rootDir });
    console.log(`${colors.green}✅ TypeScript: No errors in source files${colors.reset}`);
  } catch (error) {
    // Parse TypeScript errors
    const output = error.stdout || error.message;
    const lines = output.split('\n');
    const testErrors = lines.filter(line => line.includes('.test.ts'));
    const sourceErrors = lines.filter(line => !line.includes('.test.ts') && line.includes('.ts'));
    
    if (sourceErrors.length > 0) {
      console.log(`${colors.red}❌ TypeScript: ${sourceErrors.length} errors in source files${colors.reset}`);
      issues.typescript = sourceErrors.slice(0, 5); // Show first 5 errors
      canBuild = false;
    } else if (testErrors.length > 0) {
      console.log(`${colors.yellow}⚠️  TypeScript: ${testErrors.length} errors in test files (non-blocking)${colors.reset}`);
    }
  }
  
  // 2. Check for missing dependencies
  console.log(`\n${colors.blue}📦 Checking dependencies...${colors.reset}`);
  try {
    const packageJson = JSON.parse(await fs.readFile(path.join(rootDir, 'package.json'), 'utf-8'));
    const nodeModulesExists = await fs.access(path.join(rootDir, 'node_modules')).then(() => true).catch(() => false);
    
    if (!nodeModulesExists) {
      console.log(`${colors.red}❌ Dependencies: node_modules not found${colors.reset}`);
      issues.dependencies.push('Run "npm install" to install dependencies');
      canBuild = false;
    } else {
      // Check for common missing peer dependencies
      const { stdout } = await execAsync('npm ls --depth=0 --json', { cwd: rootDir });
      const npmList = JSON.parse(stdout);
      
      if (npmList.problems && npmList.problems.length > 0) {
        console.log(`${colors.yellow}⚠️  Dependencies: ${npmList.problems.length} warnings${colors.reset}`);
        issues.dependencies = npmList.problems.slice(0, 3);
      } else {
        console.log(`${colors.green}✅ Dependencies: All installed${colors.reset}`);
      }
    }
  } catch (error) {
    console.log(`${colors.yellow}⚠️  Dependencies: Could not verify${colors.reset}`);
  }
  
  // 3. Check environment configuration
  console.log(`\n${colors.blue}⚙️  Checking configuration...${colors.reset}`);
  const envExists = await fs.access(path.join(rootDir, '.env')).then(() => true).catch(() => false);
  const envLocalExists = await fs.access(path.join(rootDir, '.env.local')).then(() => true).catch(() => false);
  
  if (!envExists && !envLocalExists) {
    console.log(`${colors.yellow}⚠️  Configuration: No .env file found${colors.reset}`);
    issues.configuration.push('Create .env or .env.local file with required variables');
  } else {
    console.log(`${colors.green}✅ Configuration: Environment file found${colors.reset}`);
  }
  
  // 4. Check for critical files
  console.log(`\n${colors.blue}📂 Checking critical files...${colors.reset}`);
  const criticalFiles = [
    'next.config.js',
    'tsconfig.json',
    'tailwind.config.ts',
    'src/app/layout.tsx',
  ];
  
  for (const file of criticalFiles) {
    const exists = await fs.access(path.join(rootDir, file)).then(() => true).catch(() => false);
    if (!exists) {
      console.log(`${colors.red}❌ Missing: ${file}${colors.reset}`);
      issues.critical.push(`Missing critical file: ${file}`);
      canBuild = false;
    }
  }
  
  if (issues.critical.length === 0) {
    console.log(`${colors.green}✅ Critical files: All present${colors.reset}`);
  }
  
  // Summary
  console.log(`\n${colors.bright}📊 Build Status Summary${colors.reset}`);
  console.log('═'.repeat(50));
  
  if (canBuild) {
    console.log(`\n${colors.green}✅ Build Status: READY${colors.reset}`);
    console.log('The project should be able to build successfully.\n');
    
    if (issues.dependencies.length > 0 || issues.configuration.length > 0) {
      console.log(`${colors.yellow}⚠️  Warnings:${colors.reset}`);
      if (issues.dependencies.length > 0) {
        console.log('  - Some dependency warnings (non-critical)');
      }
      if (issues.configuration.length > 0) {
        console.log('  - Environment configuration may need attention');
      }
    }
  } else {
    console.log(`\n${colors.red}❌ Build Status: NOT READY${colors.reset}`);
    console.log('The following issues must be resolved:\n');
    
    if (issues.typescript.length > 0) {
      console.log(`${colors.red}TypeScript Errors:${colors.reset}`);
      issues.typescript.forEach(error => console.log(`  ${error}`));
    }
    
    if (issues.critical.length > 0) {
      console.log(`\n${colors.red}Critical Issues:${colors.reset}`);
      issues.critical.forEach(issue => console.log(`  - ${issue}`));
    }
    
    if (issues.dependencies.filter(d => d.includes('not found')).length > 0) {
      console.log(`\n${colors.red}Missing Dependencies:${colors.reset}`);
      console.log('  Run: npm install');
    }
  }
  
  // Save detailed report
  const report = {
    timestamp: new Date().toISOString(),
    canBuild,
    issues,
    summary: {
      typescriptErrors: issues.typescript.length,
      dependencyIssues: issues.dependencies.length,
      configurationIssues: issues.configuration.length,
      criticalIssues: issues.critical.length,
    },
  };
  
  await fs.writeFile(
    path.join(rootDir, 'build-status-report.json'),
    JSON.stringify(report, null, 2)
  );
  
  return canBuild;
}

// Run the checker
checkBuildStatus()
  .then(canBuild => {
    process.exit(canBuild ? 0 : 1);
  })
  .catch(error => {
    console.error(`${colors.red}Error checking build status:${colors.reset}`, error);
    process.exit(1);
  });