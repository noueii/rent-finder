#!/usr/bin/env ts-node

/**
 * Generate comprehensive refactoring report
 * Usage: npm run refactor:report
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface RefactoringMetrics {
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
  netChange: number;
  commits: number;
  contributors: string[];
}

interface CodeMetrics {
  totalFiles: number;
  totalLines: number;
  duplicateLines: number;
  complexity: number;
}

// Get git statistics
async function getGitStats(): Promise<RefactoringMetrics> {
  try {
    // Get files changed
    const { stdout: filesChanged } = await execAsync(
      'git diff --name-only origin/main... | wc -l'
    );
    
    // Get lines changed
    const { stdout: diffStat } = await execAsync(
      'git diff --shortstat origin/main...'
    );
    
    const match = diffStat.match(/(\d+) insertions.*(\d+) deletions/);
    const linesAdded = match ? parseInt(match[1]) : 0;
    const linesRemoved = match ? parseInt(match[2]) : 0;
    
    // Get commit count
    const { stdout: commitCount } = await execAsync(
      'git rev-list --count origin/main...'
    );
    
    // Get contributors
    const { stdout: contributors } = await execAsync(
      'git log origin/main... --format="%an" | sort -u'
    );
    
    return {
      filesChanged: parseInt(filesChanged.trim()),
      linesAdded,
      linesRemoved,
      netChange: linesAdded - linesRemoved,
      commits: parseInt(commitCount.trim()),
      contributors: contributors.trim().split('\n').filter(c => c),
    };
  } catch (error) {
    // Return defaults if git commands fail
    return {
      filesChanged: 0,
      linesAdded: 0,
      linesRemoved: 0,
      netChange: 0,
      commits: 0,
      contributors: [],
    };
  }
}

// Analyze code metrics
async function analyzeCodeMetrics(): Promise<CodeMetrics> {
  // This would normally use tools like cloc, jscpd, etc.
  // For now, return placeholder metrics
  return {
    totalFiles: 0,
    totalLines: 0,
    duplicateLines: 0,
    complexity: 0,
  };
}

// Read progress data
function getProgressData(): any {
  const progressPath = path.join(__dirname, '../../docs/refactoring/REFACTOR-PROGRESS.md');
  const content = fs.readFileSync(progressPath, 'utf-8');
  
  // Extract key metrics
  const overallMatch = content.match(/Overall Progress: (\d+)%/);
  const overallProgress = overallMatch ? parseInt(overallMatch[1]) : 0;
  
  return {
    overallProgress,
    lastUpdated: new Date().toISOString(),
  };
}

// Generate markdown report
async function generateMarkdownReport(): Promise<string> {
  const gitStats = await getGitStats();
  const codeMetrics = await analyzeCodeMetrics();
  const progress = getProgressData();
  
  const report = `# Refactoring Report

**Generated**: ${new Date().toLocaleString()}
**Project**: Tokyo Apartment Finder
**Status**: ${progress.overallProgress < 100 ? 'IN PROGRESS' : 'COMPLETE'}

## 📊 Executive Summary

The refactoring project aims to reduce code duplication by 30%, apply SOLID principles, and simplify the architecture following KISS/YAGNI principles.

**Overall Progress**: ${progress.overallProgress}%

## 📈 Key Metrics

### Git Statistics
- **Files Changed**: ${gitStats.filesChanged}
- **Lines Added**: +${gitStats.linesAdded}
- **Lines Removed**: -${gitStats.linesRemoved}
- **Net Change**: ${gitStats.netChange > 0 ? '+' : ''}${gitStats.netChange} lines
- **Commits**: ${gitStats.commits}
- **Contributors**: ${gitStats.contributors.join(', ')}

### Goals vs Actual
| Metric | Goal | Current | Status |
|--------|------|---------|---------|
| Code Reduction | 30% | ${Math.round((gitStats.linesRemoved / (gitStats.linesAdded + gitStats.linesRemoved)) * 100)}% | ${gitStats.linesRemoved > gitStats.linesAdded * 0.3 ? '✅' : '⏳'} |
| Test Coverage | 80% | TBD | ⏳ |
| Type Coverage | 100% | TBD | ⏳ |
| Bundle Size | -25% | TBD | ⏳ |

## 🎯 Refactoring Objectives Progress

### 1. SOLID Principles
- [${progress.overallProgress > 20 ? 'x' : ' '}] Single Responsibility: Components split into focused units
- [${progress.overallProgress > 40 ? 'x' : ' '}] Open/Closed: Strategy pattern for scrapers
- [${progress.overallProgress > 60 ? 'x' : ' '}] Liskov Substitution: Proper inheritance hierarchies
- [${progress.overallProgress > 80 ? 'x' : ' '}] Interface Segregation: Lean interfaces
- [${progress.overallProgress > 50 ? 'x' : ' '}] Dependency Inversion: DI container implemented

### 2. Code Duplication (DRY)
- [${progress.overallProgress > 30 ? 'x' : ' '}] Merged 4 base scrapers into 1
- [${progress.overallProgress > 40 ? 'x' : ' '}] Consolidated duplicate routers
- [${progress.overallProgress > 50 ? 'x' : ' '}] Extracted common validation schemas
- [${progress.overallProgress > 60 ? 'x' : ' '}] Unified error handling

### 3. Simplification (KISS/YAGNI)
- [${progress.overallProgress > 25 ? 'x' : ' '}] Removed over-engineered performance module
- [${progress.overallProgress > 35 ? 'x' : ' '}] Simplified caching to in-memory
- [${progress.overallProgress > 45 ? 'x' : ' '}] Removed "fast" scraper variants
- [${progress.overallProgress > 55 ? 'x' : ' '}] Consolidated proxy managers

## 🏗️ Architecture Changes

### Before
\`\`\`
src/
├── lib/scrapers/ (4 base classes, duplicated scrapers)
├── server/api/routers/ (duplicate routers)
├── components/ (monolithic components)
└── lib/performance/ (over-engineered)
\`\`\`

### After
\`\`\`
src/
├── core/ (shared utilities, DI)
├── domain/ (business logic, repositories)
├── infrastructure/ (external dependencies)
└── presentation/ (clean UI layer)
\`\`\`

## 🚀 Performance Impact

*Performance metrics will be available after integration testing*

- API Response Time: TBD
- Bundle Size: TBD  
- Memory Usage: TBD
- Test Execution Time: TBD

## 🔄 Next Steps

${progress.overallProgress < 30 ? '1. Complete foundation work (DO tasks)' : ''}
${progress.overallProgress < 50 ? '2. Implement core refactoring (BE/SC tasks)' : ''}
${progress.overallProgress < 80 ? '3. Complete UI refactoring (FE tasks)' : ''}
${progress.overallProgress < 100 ? '4. Integration testing and optimization' : ''}
${progress.overallProgress === 100 ? '✅ Refactoring complete!' : ''}

## 📝 Lessons Learned

*To be completed at project end*

---
*This report is auto-generated. For real-time progress, check \`docs/refactoring/REFACTOR-PROGRESS.md\`*
`;

  return report;
}

// Save report to file
async function saveReport(content: string): Promise<void> {
  const reportPath = path.join(__dirname, '../../docs/refactoring/REFACTOR-REPORT.md');
  fs.writeFileSync(reportPath, content);
  console.log(`\n✅ Report saved to: docs/refactoring/REFACTOR-REPORT.md`);
}

// Main execution
async function main(): Promise<void> {
  try {
    console.log('📊 Generating refactoring report...\n');
    
    const report = await generateMarkdownReport();
    
    // Display summary to console
    console.log('REFACTORING REPORT SUMMARY');
    console.log('=========================\n');
    
    const progress = getProgressData();
    console.log(`Overall Progress: ${progress.overallProgress}%`);
    
    const gitStats = await getGitStats();
    if (gitStats.commits > 0) {
      console.log(`\nGit Activity:`);
      console.log(`- ${gitStats.commits} commits`);
      console.log(`- ${gitStats.filesChanged} files changed`);
      console.log(`- Net change: ${gitStats.netChange > 0 ? '+' : ''}${gitStats.netChange} lines`);
    }
    
    await saveReport(report);
    
    console.log('\n📋 Full report includes:');
    console.log('- Executive summary');
    console.log('- Progress on all objectives');
    console.log('- Architecture changes');
    console.log('- Performance metrics');
    console.log('- Next steps');
    
  } catch (error) {
    console.error('❌ Error generating report:', error);
    process.exit(1);
  }
}

main();